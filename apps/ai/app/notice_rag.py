"""RAG pipeline for the public notices chatbot.

Retrieval runs two legs in parallel rather than one-or-the-other:

  1. lexical — tokenized keyword hits ranked by the NestJS API and passed in
     as `pg_results` (exact names, reference numbers, office names)
  2. semantic — Qdrant vector search over notice embeddings (paraphrases,
     cross-language matches, "exam" ~ "परीक्षा")

Their rankings are fused with RRF, the shortlist is reordered by a
cross-encoder, and only then does the top slice become LLM context. The
previous implementation used the vector leg *only when the lexical leg was
empty*, which meant the two never corrected each other's blind spots.
"""

from typing import Any, AsyncIterator, Optional

from app import config
from app import grounding
from app import llm
from app import notice_store
from app import reranker
from app import smalltalk
from app.logger import get_logger

logger = get_logger(__name__)

# Weights for RRF. Lexical hits are slightly favoured because an exact term
# match on a notice title ("Lok Sewa Aayog") is a stronger signal than any
# embedding similarity, and because the vector index only embeds title+summary.
_RRF_WEIGHTS = (1.2, 1.0)

_NOTICES_SYSTEM_PROMPT = """You are Suchana AI, the assistant for a Nepalese public notice portal. Answer using ONLY the numbered notice context provided.

ANSWER CONTRACT — follow exactly:
1. First line: answer the question directly, in one sentence. No preamble, no restating the question, no "Based on the notices...".
2. Then, only if the question needs it, add supporting detail as short bullets — dates, amounts, eligibility, procedure.
3. Cite with bracketed numbers matching the context blocks, placed immediately after the claim they support: "Applications close on **15 Bhadra 2082** [2]." Never group citations at the end.
4. **Bold** every date, deadline, amount, and reference number.
5. Stay under 180 words. A factual lookup should be 1-2 sentences — do not pad it into a report.

ACCURACY — non-negotiable:
- Every fact must come from the context. Never infer, estimate, or fill gaps from general knowledge.
- If the context answers only part of the question, answer that part and state plainly what is not covered.
- If the context does not answer it at all, say so in one sentence and name the closest topic that IS covered.
- Never present a notice's title as if it were its content.
- Quote the notice title when you refer to a specific notice, so the user knows which one.

LANGUAGE:
- Answer in the language of the question. If the question is English and the notice is Nepali, translate fully — do not leave Devanagari text inline except for proper nouns, which may appear in parentheses.
- If the question is in Nepali, answer in Nepali (Devanagari)."""

_NO_RESULTS_PROMPT = """You are Suchana AI, an assistant for a Nepalese public notice portal. The user asked a question but no relevant notices were found.

Say so in 1-2 sentences, in the user's language. Suggest more specific keywords or browsing the notices page. Never invent notices or guess at an answer."""


def _text_for_ranking(source: dict) -> str:
    """The representation a reranker or embedder sees for a notice.

    Includes the body excerpt when the API supplied one — ranking on title and
    summary alone cannot tell which notice contains the deadline being asked
    about, because summaries systematically omit exactly those specifics.
    """
    parts = [
        source.get("title") or "",
        source.get("aiSummary") or "",
        source.get("excerpt") or "",
    ]
    return "\n".join(p for p in parts if p).strip()


def _filter_vector_hits(hits: list[dict]) -> list[dict]:
    """Apply an absolute floor plus a cutoff relative to the best hit.

    A single hard threshold (the old `score >= 0.75`) assumes every query has
    the same achievable similarity ceiling. Hard queries top out lower and lost
    all their results; easy queries kept a long tail of weak ones. Anchoring
    the cutoff to the top hit adapts to both.
    """
    usable = [h for h in hits if h["score"] >= config.NOTICE_SEARCH_MIN_SCORE]
    if not usable:
        return []
    best = usable[0]["score"]
    cutoff = best - config.NOTICE_SEARCH_RELATIVE_MARGIN
    return [h for h in usable if h["score"] >= cutoff]


def _normalize_vector_hit(hit: dict) -> dict:
    return {
        "id": hit["notice_id"],
        "title": hit["title"],
        "aiSummary": hit["ai_summary"],
        "excerpt": "",
        "category": hit["category"],
        "sourceLabel": hit["source_label"],
        "sourceUrl": hit["source_url"],
        "publishedAt": hit.get("published_at"),
        "deadline": None,
        "vectorScore": hit["score"],
    }


def _merge(primary: dict, secondary: dict) -> dict:
    """Combine the two legs' records for the same notice, preferring whichever
    field is actually populated — the lexical leg carries the body excerpt and
    deadline, the vector leg carries the similarity score."""
    merged = {**secondary, **{k: v for k, v in primary.items() if v not in (None, "")}}
    for score_key in ("keywordScore", "vectorScore"):
        if secondary.get(score_key) is not None and merged.get(score_key) is None:
            merged[score_key] = secondary[score_key]
    return merged


def _retrieve(
    question: str,
    pg_results: Optional[list[dict]],
    category: Optional[str],
    top_k: int,
) -> tuple[list[dict], dict[str, Any]]:
    """Run both retrieval legs, fuse, rerank, and return the top_k notices."""
    lexical = list(pg_results or [])

    try:
        raw_vector = notice_store.search(
            query_text=question,
            top_k=config.RERANK_CANDIDATES,
            category=category,
        )
        vector = [_normalize_vector_hit(h) for h in _filter_vector_hits(raw_vector)]
    except Exception:
        # Qdrant being down must not take the whole chatbot with it — the
        # lexical leg alone still answers most keyword-shaped questions.
        logger.exception("Vector leg failed; continuing with lexical results only")
        raw_vector, vector = [], []

    by_id: dict[str, dict] = {}
    for source in vector:
        by_id[source["id"]] = source
    for source in lexical:
        notice_id = source.get("id")
        if not notice_id:
            continue
        by_id[notice_id] = _merge(source, by_id.get(notice_id, {}))

    if not by_id:
        return [], {"lexical": 0, "vector": len(raw_vector), "fused": 0, "reranked": False}

    fused_scores = reranker.reciprocal_rank_fusion(
        [[s["id"] for s in lexical if s.get("id")], [s["id"] for s in vector]],
        weights=_RRF_WEIGHTS,
    )
    shortlist = sorted(
        by_id.values(),
        key=lambda s: fused_scores.get(s["id"], 0.0),
        reverse=True,
    )[: config.RERANK_CANDIDATES]

    reranked = False
    if reranker.is_available() and len(shortlist) > 1:
        order = reranker.rerank(
            question, [_text_for_ranking(s) for s in shortlist], top_k=top_k
        )
        selected = []
        for index, score in order:
            source = shortlist[index]
            source["rerankScore"] = round(score, 4)
            selected.append(source)
        reranked = True
    else:
        selected = shortlist[:top_k]

    stats = {
        "lexical": len(lexical),
        "vector": len(vector),
        "fused": len(by_id),
        "reranked": reranked,
    }
    return selected, stats


def _build_context(sources: list[dict]) -> str:
    blocks = []
    for i, source in enumerate(sources, start=1):
        lines = [f'[{i}] "{source.get("title") or "Untitled"}"']
        if source.get("category"):
            lines.append(f"Type: {source['category']}")
        if source.get("sourceLabel"):
            lines.append(f"Published by: {source['sourceLabel']}")
        if source.get("publishedAt"):
            lines.append(f"Published on: {source['publishedAt']}")
        if source.get("deadline"):
            lines.append(f"Deadline: {source['deadline']}")
        if source.get("aiSummary"):
            lines.append(f"Summary: {source['aiSummary']}")
        # The excerpt is the only place specifics like fees and eligibility
        # appear, so it goes last where recency-of-context effects favour it.
        if source.get("excerpt"):
            lines.append(f"Notice text: {source['excerpt']}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _public_source(index: int, source: dict) -> dict:
    """Shape returned to the web client. `citation` lets the UI wire the
    inline [n] markers in the answer to the correct card."""
    return {
        "citation": index,
        "id": source.get("id", ""),
        "title": source.get("title", ""),
        "category": source.get("category", ""),
        "sourceUrl": source.get("sourceUrl", ""),
        "publishedAt": source.get("publishedAt"),
        "score": source.get("rerankScore")
        or source.get("vectorScore")
        or source.get("keywordScore")
        or 0.0,
    }


async def search_and_answer(
    question: str,
    pg_results: list[dict] | None = None,
    category: str | None = None,
    language: str = "en",
    top_k: int = 5,
    history: list[dict] | None = None,
) -> dict:
    """Hybrid notice search + grounded answer generation.

    pg_results: ranked keyword matches from the NestJS API. Each dict has
                id, title, aiSummary, excerpt, category, sourceLabel,
                sourceUrl, publishedAt, deadline, keywordScore.
    history:    prior conversation turns [{role, content}], used for context
                only — retrieval runs on the rewritten standalone question.
    """
    if smalltalk.is_small_talk(question):
        # "hello" is not a search query. Running it through retrieval produces
        # "I couldn't find any notices matching that", which is the worst
        # possible reply to a greeting.
        logger.info("Small talk detected; skipping retrieval")
        answer, model_used = await llm.generate_chat(question, language)
        return {
            "answer": answer,
            "sources": [],
            "model_used": model_used,
            "confidence": "none",
        }

    # Retrieval runs on a standalone rewrite of the question ("what about the
    # fee?" -> "application fee for the vacancy notice"); the answer prompt
    # below still gets the user's original wording.
    search_query = await llm.rewrite_query(question, history)
    sources, stats = _retrieve(search_query, pg_results, category, top_k)
    logger.info(
        "Notice retrieval: lexical=%d vector=%d fused=%d reranked=%s -> %d sources | %.80s",
        stats["lexical"],
        stats["vector"],
        stats["fused"],
        stats["reranked"],
        len(sources),
        question,
    )

    if not sources:
        answer, model_used = await _generate_no_results(question, language)
        return {
            "answer": answer,
            "sources": [],
            "model_used": model_used,
            "confidence": "none",
            "retrieval": stats,
        }

    context = _build_context(sources)
    lang_instruction = (
        "\n\nRespond in Nepali (Devanagari script)." if language == "ne" else ""
    )
    messages = [
        {"role": "system", "content": _NOTICES_SYSTEM_PROMPT + lang_instruction},
        *_history_messages(history),
        {
            "role": "user",
            "content": f"Notice context:\n{context}\n\nQuestion: {question}",
        },
    ]

    # Low temperature: this is a factual lookup over supplied context, where
    # stylistic variation buys nothing and costs consistency.
    answer, model_used = await llm.chat(
        messages, max_tokens=700, temperature=0.15, prefer="fast"
    )
    if answer is None:
        answer = _extractive_fallback(sources)
        model_used = None

    public_sources = [_public_source(i, s) for i, s in enumerate(sources, start=1)]
    verdict = grounding.assess(
        answer,
        context,
        source_count=len(sources),
        retrieval_scores=[s["score"] for s in public_sources],
    )

    return {
        "answer": answer,
        "sources": public_sources,
        "model_used": model_used,
        "retrieval": stats,
        **verdict,
    }


async def search_and_answer_stream(
    question: str,
    pg_results: list[dict] | None = None,
    category: str | None = None,
    language: str = "en",
    top_k: int = 5,
    history: list[dict] | None = None,
) -> AsyncIterator[dict]:
    """Streaming counterpart of `search_and_answer`.

    Yields event dicts the transport layer serializes as SSE:
      {"type": "stage",  "stage": "searching"|"reading"|"answering"}
      {"type": "sources", "sources": [...]}      — emitted before generation,
                                                    so cards render immediately
      {"type": "delta",  "text": "..."}          — answer text as it arrives
      {"type": "done",   "confidence": ..., "model_used": ..., ...}
    """
    if smalltalk.is_small_talk(question):
        logger.info("Small talk detected; skipping retrieval")
        answer, model_used = await llm.generate_chat(question, language)
        yield {"type": "delta", "text": answer}
        yield {
            "type": "done",
            "sources": [],
            "model_used": model_used,
            "confidence": "none",
        }
        return

    yield {"type": "stage", "stage": "searching"}

    # Retrieval runs on a standalone rewrite of the question ("what about the
    # fee?" -> "application fee for the vacancy notice"); the answer prompt
    # below still gets the user's original wording.
    search_query = await llm.rewrite_query(question, history)
    sources, stats = _retrieve(search_query, pg_results, category, top_k)
    logger.info(
        "Notice retrieval (stream): lexical=%d vector=%d fused=%d reranked=%s -> %d sources | %.80s",
        stats["lexical"],
        stats["vector"],
        stats["fused"],
        stats["reranked"],
        len(sources),
        question,
    )

    if not sources:
        answer, model_used = await _generate_no_results(question, language)
        yield {"type": "delta", "text": answer}
        yield {
            "type": "done",
            "sources": [],
            "model_used": model_used,
            "confidence": "none",
            "retrieval": stats,
        }
        return

    public_sources = [_public_source(i, s) for i, s in enumerate(sources, start=1)]
    yield {"type": "sources", "sources": public_sources}
    yield {"type": "stage", "stage": "answering"}

    context = _build_context(sources)
    lang_instruction = (
        "\n\nRespond in Nepali (Devanagari script)." if language == "ne" else ""
    )
    messages = [
        {"role": "system", "content": _NOTICES_SYSTEM_PROMPT + lang_instruction},
        *_history_messages(history),
        {
            "role": "user",
            "content": f"Notice context:\n{context}\n\nQuestion: {question}",
        },
    ]

    collected: list[str] = []
    model_used: str | None = None
    async for delta, model in llm.stream(
        messages, max_tokens=700, temperature=0.15, prefer="fast"
    ):
        model_used = model
        collected.append(delta)
        yield {"type": "delta", "text": delta}

    answer = "".join(collected).strip()
    if not answer:
        # Every provider failed. The sources are already on screen, so show
        # them rather than leaving an empty bubble.
        answer = _extractive_fallback(sources)
        model_used = None
        yield {"type": "delta", "text": answer}

    # Grounding is assessed on the assembled answer: it needs the whole text,
    # so this necessarily lands after the last delta.
    verdict = grounding.assess(
        answer,
        context,
        source_count=len(sources),
        retrieval_scores=[s["score"] for s in public_sources],
    )
    yield {
        "type": "done",
        "sources": public_sources,
        "model_used": model_used,
        "retrieval": stats,
        **verdict,
    }


def _history_messages(history: list[dict] | None) -> list[dict]:
    """Prior turns, trimmed. Long assistant answers are truncated because their
    role here is only to disambiguate follow-ups, not to be re-read in full."""
    if not history:
        return []
    messages = []
    for turn in history[-6:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        messages.append({"role": role, "content": content[:600]})
    return messages


async def _generate_no_results(question: str, language: str) -> tuple[str, str | None]:
    if llm.has_provider():
        messages = [
            {"role": "system", "content": _NO_RESULTS_PROMPT},
            {"role": "user", "content": question},
        ]
        answer, model_used = await llm.chat(
            messages, max_tokens=150, temperature=0.6, prefer="fast"
        )
        if answer:
            return answer, model_used

    return (
        "I couldn't find any notices matching that. Try more specific keywords "
        "— an office name, a reference number, or the type of notice.",
        None,
    )


def _extractive_fallback(sources: list[dict]) -> str:
    """Used only when every LLM provider is unreachable: show what was found
    rather than claiming nothing exists."""
    lines = []
    for i, source in enumerate(sources[:3], start=1):
        title = source.get("title", "Untitled")
        summary = source.get("aiSummary") or source.get("excerpt", "")[:200]
        lines.append(f"{i}. **{title}**" + (f" — {summary}" if summary else ""))
    return (
        "I found these notices, but couldn't generate a summary just now:\n\n"
        + "\n\n".join(lines)
    )
