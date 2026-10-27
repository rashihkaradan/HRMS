"""Persistent ChromaDB collection used by the HR policy assistant."""

import chromadb

from app.core.config import settings

_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def get_collection():
    """Return the Gemini-embedded HR policy collection (cosine distance).

    No embedding_function is attached: embeddings are created with Gemini
    in gemini_client.embed_texts() and passed to Chroma manually.
    """
    return _client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def get_candidate_collection():
    """Separate persistent collection for recruiting profiles and applications."""
    return _client.get_or_create_collection(
        name=settings.CHROMA_CANDIDATE_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
