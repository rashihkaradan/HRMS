"""
Ingestion pipeline: PDF -> text -> chunks -> ChromaDB (embeddings handled
automatically by the collection's embedding function on .add()).
"""
import uuid
from pathlib import Path
import re

from pypdf import PdfReader

from app.rag.chroma_client import get_collection
from app.rag.gemini_client import embed_texts


def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 80) -> list[str]:
    """
    Make compact, overlapping passages and prefer a nearby sentence, line, or
    word boundary so retrieval keeps enough context without cutting words.
    """
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("chunk_size must be positive and overlap must be smaller than chunk_size")
    chunks = []
    start = 0
    while start < len(text):
        target = min(start + chunk_size, len(text))
        end = target
        if target < len(text):
            floor = start + chunk_size * 2 // 3
            boundaries = [text.rfind(token, floor, target) for token in ("\n", ". ", "; ", " ")]
            boundary = max(boundaries)
            if boundary >= floor:
                end = boundary + (1 if text[boundary] == "\n" else 2 if text.startswith((". ", "; "), boundary) else 0)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
        while start < len(text) and text[start].isspace():
            start += 1
    return [c.strip() for c in chunks if c.strip()]


def ingest_document(
    file_path: str,
    doc_title: str,
    category: str = "general",
    source_name: str | None = None,
) -> int:
    """
    Reads a PDF, chunks it, and adds each chunk to ChromaDB with metadata
    so results can cite which document/category they came from.

    Returns the number of chunks ingested.
    """
    text = extract_text_from_pdf(file_path)
    chunks = chunk_text(text)

    if not chunks:
        return 0

    collection = get_collection()
    embeddings = embed_texts(chunks, task_type="RETRIEVAL_DOCUMENT")
    ids = [str(uuid.uuid4()) for _ in chunks]
    source = source_name or Path(file_path).name
    previous = collection.get(where={"$and": [{"source": source}, {"title": doc_title}]}, include=["metadatas"])
    if previous.get("ids"):
        collection.delete(ids=previous["ids"])
    metadatas = [
        {
            "source": source,
            "title": doc_title,
            "category": category,
        }
        for _ in chunks
    ]

    collection.add(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    return len(chunks)


def ingest_directory(directory: str, category: str = "general") -> dict[str, int]:
    """Ingest every PDF in a directory. Returns {filename: chunk_count}."""
    results = {}
    for pdf_path in Path(directory).glob("*.pdf"):
        count = ingest_document(str(pdf_path), doc_title=pdf_path.stem, category=category)
        results[pdf_path.name] = count
    return results
