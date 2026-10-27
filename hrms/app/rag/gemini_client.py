"""Gemini API helpers shared by the RAG ingestion and answer pipelines."""

import logging
import time
from functools import lru_cache

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

RETRY_DELAYS = [2, 5, 10]  # seconds to wait between retries when Gemini is busy


class GeminiConfigurationError(RuntimeError):
    """Raised when Gemini credentials are missing or still a placeholder."""


class GeminiServiceError(RuntimeError):
    """Raised when a Gemini API request fails."""


@lru_cache(maxsize=1)
def get_gemini_client():
    api_key = (settings.GEMINI_API_KEY or "").strip().strip('"').strip("'")
    if not api_key or "your_gemini_api_key" in api_key.casefold() or "paste_your" in api_key.casefold():
        raise GeminiConfigurationError("Set a valid GEMINI_API_KEY in hrms/.env")
    return genai.Client(api_key=api_key)


def _status_code(exc: Exception) -> int | None:
    code = getattr(exc, "code", None)
    return code if isinstance(code, int) else None


def is_busy_error(exc: Exception) -> bool:
    """True for temporary overload / rate-limit errors worth retrying."""
    if _status_code(exc) in (429, 500, 503):
        return True
    text = str(exc).upper()
    return "UNAVAILABLE" in text or "RESOURCE_EXHAUSTED" in text


def explain_error(exc: Exception, what: str = "request") -> str:
    """Turn a raw Gemini/Google error into a message that says what to fix."""
    text = str(exc)
    code = _status_code(exc)
    upper = text.upper()

    if code == 403 or "PERMISSION_DENIED" in upper:
        return (
            "Gemini returned 403 PERMISSION_DENIED. The key is blocked, restricted, or its "
            f"project doesn't have Gemini API access. Details: {text}"
        )
    if code == 401 or "API_KEY_INVALID" in upper or "API KEY NOT VALID" in upper:
        return f"Gemini rejected the API key as invalid. Check GEMINI_API_KEY in .env. Details: {text}"
    if code == 404 or "NOT_FOUND" in upper:
        return (
            "Model not found or no longer available. Check GEMINI_EMBEDDING_MODEL / "
            f"GEMINI_CHAT_MODEL in .env. Details: {text}"
        )
    if code == 429 or "RESOURCE_EXHAUSTED" in upper:
        return f"Gemini quota/rate limit hit. Wait a bit or check your quota. Details: {text}"
    if code == 503 or "UNAVAILABLE" in upper:
        return f"Gemini is temporarily overloaded (503). Try again in a few minutes. Details: {text}"
    return f"Gemini {what} failed: {text}"


# ---------------------------------------------------------------- embeddings
def embed_texts(texts: list[str], task_type: str) -> list[list[float]]:
    """Embed text with Gemini in small batches for Chroma storage/retrieval."""
    if not texts:
        return []

    client = get_gemini_client()
    embeddings: list[list[float]] = []
    try:
        for start in range(0, len(texts), 100):
            batch = texts[start : start + 100]
            result = None
            for attempt in range(len(RETRY_DELAYS) + 1):
                try:
                    result = client.models.embed_content(
                        model=settings.GEMINI_EMBEDDING_MODEL,
                        contents=batch,
                        config=types.EmbedContentConfig(
                            task_type=task_type,
                            output_dimensionality=768,
                        ),
                    )
                    break
                except Exception as exc:
                    if is_busy_error(exc) and attempt < len(RETRY_DELAYS):
                        logger.warning("Gemini embedding busy, retry %d", attempt + 1)
                        time.sleep(RETRY_DELAYS[attempt])
                        continue
                    raise

            batch_embeddings = result.embeddings or []
            if len(batch_embeddings) != len(batch):
                raise GeminiServiceError("Gemini returned an incomplete embedding batch")
            embeddings.extend(list(e.values) for e in batch_embeddings)
    except GeminiServiceError:
        raise
    except Exception as exc:
        logger.exception("Gemini embedding request failed")
        raise GeminiServiceError(explain_error(exc, "embedding request")) from exc
    return embeddings


# ---------------------------------------------------------------- text generation
def _call_model(client, model: str, prompt: str, system_instruction: str | None) -> str:
    """One call to one model: Interactions API first, generate_content as backup."""
    if hasattr(client, "interactions"):
        full_input = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
        try:
            interaction = client.interactions.create(model=model, input=full_input)
            text = getattr(interaction, "output_text", None)
            if text:
                return text
        except Exception as exc:
            # Busy / key / model-not-found errors apply to generate_content too,
            # so let the caller handle them. Anything else: fall back below.
            if is_busy_error(exc) or _status_code(exc) in (401, 403, 404):
                raise
            logger.warning("Interactions API failed (%s), using generate_content: %s", model, exc)

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(system_instruction=system_instruction),
    )
    return response.text or ""


def generate_text(prompt: str, system_instruction: str | None = None) -> str:
    """Generate text with retries on overload, then the fallback model if set."""
    client = get_gemini_client()

    models = [settings.GEMINI_CHAT_MODEL]
    fallback = getattr(settings, "GEMINI_FALLBACK_MODEL", "") or ""
    if fallback and fallback != settings.GEMINI_CHAT_MODEL:
        models.append(fallback)

    last_exc: Exception | None = None
    for model in models:
        for attempt in range(len(RETRY_DELAYS) + 1):
            try:
                return _call_model(client, model, prompt, system_instruction)
            except Exception as exc:
                last_exc = exc
                if is_busy_error(exc) and attempt < len(RETRY_DELAYS):
                    logger.warning("Gemini busy (%s), retry %d", model, attempt + 1)
                    time.sleep(RETRY_DELAYS[attempt])
                    continue
                logger.warning("Gemini model %s failed: %s", model, exc)
                break  # move on to the fallback model

    logger.error("All Gemini models failed: %s", last_exc)
    raise GeminiServiceError(explain_error(last_exc, "answer generation")) from last_exc