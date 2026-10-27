# test_gemini.py
from app.core.config import settings
from google import genai
from google.genai import types

key = settings.GEMINI_API_KEY.strip()
print("key:", key[:4] + "..." + key[-4:], "| length:", len(key))


def try_embed(label, client):
    print(f"\n=== {label} ===")
    try:
        r = client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=["hello"],
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY", output_dimensionality=768),
        )
        print("OK, dimensions:", len(r.embeddings[0].values))
    except Exception as e:
        print("FAILED:", type(e).__name__)
        print(str(e)[:800])


try_embed("Gemini API mode (AI Studio)", genai.Client(api_key=key))
try_embed("Vertex AI mode", genai.Client(vertexai=True, api_key=key))