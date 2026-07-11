"""RAG pipeline for the public notices chatbot — hybrid search with
PostgreSQL keyword results (passed from the NestJS API) + Qdrant semantic
fallback. The LLM synthesizes an answer from the retrieved context."""

import random

from app import config
from app import llm
from app import notice_store
from app.logger import get_logger

logger = get_logger(__name__)

_NOTICES_SYSTEM_PROMPT = """You are Suchana AI, an assistant for a Nepalese public notice portal. Answer the user's question using ONLY the provided notice context.

Rules:
- Ground every claim in the context. Never invent facts, numbers, dates, or names.
- If multiple notices are relevant, synthesize the key information from each.
- Use Markdown formatting: short paragraphs, bullet points for lists, **bold** for key facts/dates.
- Keep answers concise (under 200 words for factual lookups, up to 300 for broader questions).
- Answer in the same language the question is asked in. If the content is in Nepali but the question is in English, translate and explain in English.
- If the context doesn't contain the answer, say so plainly — do not guess.
- When citing a specific notice, mention its title in quotes so the user knows which one.
- Answer directly — no filler like "Based on the notices..." or "According to the context..."."""

_NO_RESULTS_PROMPT = """You are Suchana AI, an assistant for a Nepalese public notice portal. The user asked a question but no relevant notices were found in the database.

Tell them so in 1-2 sentences. Suggest they try different keywords or browse the notices page. Be honest — never fabricate information about notices. Vary your wording naturally."""

_STYLE_HINTS = [
    "Lead with the single most important fact.",
    "Use brief bullet points if multiple notices are relevant.",
    "Be as concise as accuracy allows.",
    "Frame the answer as a quick briefing.",
]


async def search_and_answer(
    question: str,
    pg_results: list[dict] | None = None,
    category: str | None = None,
    language: str = "en",
    top_k: int = 5,
) -> dict:
    """Hybrid notice search: use PG keyword results if provided, otherwise
    fall back to Qdrant semantic search. Then generate an LLM answer.

    pg_results: pre-fetched keyword search results from PostgreSQL (passed by
                the NestJS API). Each dict has: id, title, aiSummary, category,
                sourceLabel, sourceUrl, publishedAt.
    """
    logger.info(
        "Notice search (pg_results=%d, category=%s, top_k=%d): %.80s",
        len(pg_results) if pg_results else 0,
        category,
        top_k,
        question,
    )

    sources = []

    if pg_results and len(pg_results) > 0:
        sources = pg_results[:top_k]
        logger.info("Using %d PostgreSQL keyword results", len(sources))
    else:
        qdrant_results = notice_store.search(
            query_text=question,
            top_k=top_k,
            category=category,
        )
        sources = [
            {
                "id": r["notice_id"],
                "title": r["title"],
                "aiSummary": r["ai_summary"],
                "category": r["category"],
                "sourceLabel": r["source_label"],
                "sourceUrl": r["source_url"],
                "publishedAt": r.get("published_at"),
                "score": r["score"],
            }
            for r in qdrant_results
            if r["score"] >= 0.75
        ]
        logger.info(
            "Qdrant semantic search returned %d/%d results above threshold",
            len(sources),
            len(qdrant_results),
        )

    if not sources:
        no_result_answer = await _generate_no_results(question, language)
        return {
            "answer": no_result_answer,
            "sources": [],
            "model_used": _model_name(),
        }

    context = "\n\n".join(
        f"[{i+1}] Title: \"{s.get('title', 'Untitled')}\"\n"
        f"Category: {s.get('category', 'NOTICE')}\n"
        f"Source: {s.get('sourceLabel', '')}\n"
        f"Summary: {s.get('aiSummary', '') or 'No summary available'}"
        for i, s in enumerate(sources)
    )

    style = random.choice(_STYLE_HINTS)
    lang_instruction = ""
    if language == "ne":
        lang_instruction = "\nRespond in Nepali (Devanagari script)."

    messages = [
        {"role": "system", "content": f"{_NOTICES_SYSTEM_PROMPT}{lang_instruction}\n\nFor this answer: {style}"},
        {"role": "user", "content": f"Context (notices found):\n{context}\n\nQuestion: {question}"},
    ]

    answer = await llm._llm_chat(messages, max_tokens=800, temperature=0.5)
    if answer is None:
        answer = _extractive_fallback(sources)

    return {
        "answer": answer,
        "sources": [
            {
                "id": s.get("id", ""),
                "title": s.get("title", ""),
                "category": s.get("category", ""),
                "sourceUrl": s.get("sourceUrl", ""),
                "score": s.get("score", 1.0),
            }
            for s in sources
        ],
        "model_used": _model_name(),
    }


async def _generate_no_results(question: str, language: str) -> str:
    if config.GEMINI_API_KEY or config.GROQ_API_KEY:
        messages = [
            {"role": "system", "content": _NO_RESULTS_PROMPT},
            {"role": "user", "content": question},
        ]
        answer = await llm._llm_chat(messages, max_tokens=150, temperature=0.8)
        if answer:
            return answer

    return "I couldn't find any relevant notices for that question. Try different keywords or browse the notices page directly."


def _extractive_fallback(sources: list[dict]) -> str:
    lines = []
    for s in sources[:3]:
        title = s.get("title", "Untitled")
        summary = s.get("aiSummary", "")
        if summary:
            lines.append(f"**{title}**: {summary}")
        else:
            lines.append(f"**{title}**")
    return "Here are the most relevant notices:\n\n" + "\n\n".join(lines)


def _model_name() -> str | None:
    if config.GEMINI_API_KEY:
        return config.GEMINI_MODEL
    if config.GROQ_API_KEY:
        return config.GROQ_MODEL
    return None
