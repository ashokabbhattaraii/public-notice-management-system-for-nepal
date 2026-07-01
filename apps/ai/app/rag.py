from typing import Optional

from app import config
from app import embeddings
from app import llm
from app import store


async def query(
    question: str,
    doc_id: Optional[str] = None,
    top_k: int = 5,
    language: str = "en",
) -> dict:
    query_embedding = embeddings.get_embedding(question)

    results = store.search(
        query_embedding=query_embedding,
        top_k=top_k,
        filter_doc_id=doc_id,
    )

    if not results:
        return {
            "answer": "No relevant documents found for your question.",
            "sources": [],
            "model_used": None,
        }

    context_chunks = [r["content"] for r in results]

    answer = await llm.generate_answer(question, context_chunks, language)

    model_used = llm.MODEL if config.GROQ_API_KEY else "extractive"

    sources = [
        {
            "doc_id": r["doc_id"],
            "chunk_index": r["chunk_index"],
            "content": r["content"],
            "score": r["score"],
        }
        for r in results
    ]

    return {
        "answer": answer,
        "sources": sources,
        "model_used": model_used,
    }
