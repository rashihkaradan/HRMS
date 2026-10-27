"""Retrieve policy passages from ChromaDB and answer with Gemini."""

from app.rag.chroma_client import get_collection
from app.rag.gemini_client import embed_texts, generate_text

SYSTEM_PROMPT = (
    "You are an HR policy assistant. Answer the question using ONLY the "
    "provided context from company HR documents. If the context doesn't "
    "contain the answer, say you don't have that information in the "
    "company policies and suggest the employee contact HR directly. "
    "Keep answers concise."
)

# Cosine distance: 0 = identical, higher = less similar. Tune after testing.
MAX_DISTANCE = 0.6

NO_INFO = {
    "answer": "I don't have that information in the company policies. Please contact HR directly.",
    "sources": [],
}


def retrieve_chunks(question: str, top_k: int = 8) -> list[dict]:
    collection = get_collection()
    item_count = collection.count()
    if item_count == 0:
        return []
    query_embedding = embed_texts([question], task_type="RETRIEVAL_QUERY")[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, item_count),
    )

    chunks = []
    for doc, meta, distance in zip(
        results["documents"][0], results["metadatas"][0], results["distances"][0]
    ):
        chunks.append({"text": doc, "metadata": meta, "distance": distance})
    return chunks


def answer_policy_question(question: str, top_k: int = 8) -> dict:
    """Full RAG flow: retrieve, filter by relevance, generate a grounded answer."""
    chunks = retrieve_chunks(question, top_k=top_k)

    if not chunks:
        return {
            "answer": "I don't have any HR documents loaded yet to answer that.",
            "sources": [],
        }

    chunks = [c for c in chunks if c["distance"] <= MAX_DISTANCE]
    if not chunks:
        return NO_INFO

    context = "\n\n---\n\n".join(c["text"] for c in chunks)
    prompt = f"Context:\n{context}\n\nQuestion: {question}"

    answer = generate_text(prompt, system_instruction=SYSTEM_PROMPT) or (
        "I couldn't generate an answer from the available policy text. Please contact HR."
    )

    sources = sorted({c["metadata"]["title"] for c in chunks})
    return {"answer": answer, "sources": sources}
