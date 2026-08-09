import time
from typing import Optional

import numpy as np

from app import config
from app import embeddings
from app import llm
from app import reranker
from app import smalltalk
from app import store
from app.logger import get_logger
from app.metrics import metrics

logger = get_logger(__name__)

# Over-fetch factor: retrieve extra candidates so filtering/dedup can drop
# weak or redundant chunks and still return top_k good ones. With reranking
# enabled the over-fetch is what makes reordering worthwhile — a wider net
# gives the cross-encoder something to actually improve on.
_CANDIDATE_MULTIPLIER = 4
_MAX_CANDIDATES = 24

# The lexical greeting check lives in `smalltalk` so the notice chatbot shares
# it; this module layers the embedding classifier below on top.
_is_small_talk = smalltalk.is_small_talk


# --- Semantic intent routing ---------------------------------------------
# The lexical match above only catches known phrases. For everything else
# short, the question's embedding (computed anyway for retrieval) is compared
# against prototype examples of chit-chat vs. document questions, so free-form
# human typing ("yo wassup my friend", "u there??") routes correctly.

_CHAT_EXAMPLES = [
    "hi", "hello there", "hey how are you doing", "good morning",
    "yo wassup my friend", "u there?", "are you a robot",
    "who are you", "what can you do", "what is your name",
    "nice to meet you", "lol ok cool", "haha nice one",
    "thanks a lot man", "thank you so much", "ok bye see you later",
    "how is your day going", "hows the weather today bro",
    "can you help me", "i need some help",
    "good morning ji", "hello ji", "thanks yaar", "thank u",
    "cya later", "bye cya", "ok bye",
    "नमस्ते", "तपाईं को हुनुहुन्छ", "तपाईंलाई कस्तो छ", "धन्यवाद",
    "k cha", "kasto cha", "sanchai hunuhunchha", "timro naam k ho",
    "k cha khabar", "khabar k cha", "sanchai chau",
]
_DOC_EXAMPLES = [
    "what does the notice say about the deadline",
    "when is the application deadline",
    "summarize this document",
    "what are the eligibility requirements",
    "how much budget was allocated for education",
    "who published this notice and when",
    "what documents are required for registration",
    "explain the main provisions of the policy",
    "what technologies are mentioned in the report",
    "list the key findings",
    "सूचनामा के लेखिएको छ",
    "आवेदनको म्याद कहिले सम्म हो",
    "यो कागजातको मुख्य बुँदाहरू के के हुन्",
    "notice ma k lekheko cha",
    "suchana ma k cha",
    "myad kahile samma ho",
    "budget kati chuttyaieko cha",
    "yo document ma k bhaneko cha",
    "kun technology use bhaeko cha",
]

# Similarity-difference band: outside it the embedding verdict is trusted;
# inside it (heavy textspeak, mixed-language) the LLM breaks the tie.
_INTENT_MARGIN = 0.04
_INTENT_MAX_LEN = 60

_chat_vecs: Optional[np.ndarray] = None
_doc_vecs: Optional[np.ndarray] = None


async def _detect_chat_intent(question: str, query_embedding: list[float]) -> bool:
    if len(question) > _INTENT_MAX_LEN:
        return False

    global _chat_vecs, _doc_vecs
    if _chat_vecs is None:
        _chat_vecs = np.array(embeddings.get_embeddings(_CHAT_EXAMPLES, kind="query"))
        _doc_vecs = np.array(embeddings.get_embeddings(_DOC_EXAMPLES, kind="query"))

    q_vec = np.array(query_embedding)
    chat_sim = float(np.max(_chat_vecs @ q_vec))
    doc_sim = float(np.max(_doc_vecs @ q_vec))
    diff = chat_sim - doc_sim

    if abs(diff) >= _INTENT_MARGIN:
        is_chat = diff > 0
        logger.info(
            "Intent (embedding): %s (chat=%.3f, doc=%.3f) for %.40r",
            "chat" if is_chat else "document",
            chat_sim,
            doc_sim,
            question,
        )
        return is_chat

    verdict = await llm.classify_intent(question)
    logger.info(
        "Intent (LLM tiebreak): %s (chat=%.3f, doc=%.3f) for %.40r",
        verdict or "unavailable->document",
        chat_sim,
        doc_sim,
        question,
    )
    return verdict == "chat"


def _select_context(question: str, results: list[dict], top_k: int) -> list[dict]:
    """Filter candidates, rerank them against the question, then merge adjacent
    chunks from the same document/page/section for coherent citations."""
    deduped: list[dict] = []
    seen_keys: set[str] = set()

    for r in results:
        if r["score"] < config.RAG_SCORE_THRESHOLD:
            continue
        # Overlapping chunks share their boundary text; a normalized prefix is
        # a cheap near-duplicate signal.
        key = " ".join(r["content"].split())[:120].lower()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(r)

    # Reorder by cross-encoder before truncating to top_k. Truncating first (as
    # this did previously) throws away the chunks reranking exists to promote:
    # the embedding order decides what survives, and the passage that actually
    # answers the question is frequently ranked 6th-10th by embeddings alone.
    if reranker.is_available() and len(deduped) > 1:
        order = reranker.rerank(question, [r["content"] for r in deduped], top_k=top_k)
        selected = []
        for index, score in order:
            chunk = deduped[index]
            chunk["rerank_score"] = round(score, 4)
            selected.append(chunk)
    else:
        selected = deduped[:top_k]

    # Citations read better in document order than in relevance order.
    selected.sort(key=lambda c: (c["doc_id"], c["chunk_index"]))
    return _merge_adjacent_chunks(selected)


def _merge_adjacent_chunks(chunks: list[dict]) -> list[dict]:
    """Merge adjacent chunks from the same document/page/section.
    Returns merged chunks with page_range metadata for citations."""

    def _page_of(chunk: dict) -> int | None:
        return chunk.get("metadata", {}).get("page_num")

    def _section_of(chunk: dict) -> str | None:
        return chunk.get("metadata", {}).get("section_path")

    def _char_end(chunk: dict) -> int | None:
        return chunk.get("metadata", {}).get("char_end")

    if not chunks:
        return chunks

    merged: list[dict] = []
    current = chunks[0].copy()
    last_index = current["chunk_index"]
    current["page_range"] = [_page_of(current), _page_of(current)]

    for next_chunk in chunks[1:]:
        # Check if chunks are from same doc and adjacent (chunk_index diff <= 1)
        same_doc = current["doc_id"] == next_chunk["doc_id"]
        adjacent = next_chunk["chunk_index"] - last_index <= 1
        same_section = _section_of(current) == _section_of(next_chunk)

        if same_doc and adjacent and same_section:
            # Merge: concatenate content, update ranges
            current["content"] += "\n\n" + next_chunk["content"]
            end = _char_end(next_chunk)
            if end is not None:
                current["metadata"]["char_end"] = end
            last_index = next_chunk["chunk_index"]
            # Track page range
            next_page = _page_of(next_chunk)
            if next_page is not None:
                current["page_range"][1] = next_page
        else:
            merged.append(current)
            current = next_chunk.copy()
            last_index = current["chunk_index"]
            current["page_range"] = [_page_of(current), _page_of(current)]

    merged.append(current)

    return merged


async def query(
    question: str,
    doc_id: Optional[str] = None,
    doc_ids: Optional[list[str]] = None,
    top_k: int = 5,
    language: str = "en",
) -> dict:
    logger.info(
        "RAG query (doc_id=%s, doc_ids=%s, top_k=%d, lang=%s): %.80s",
        doc_id,
        f"[{len(doc_ids)} ids]" if doc_ids else None,
        top_k,
        language,
        question,
    )

    async def _chat_reply() -> dict:
        answer, model_used = await llm.generate_chat(question, language)
        return {
            "answer": answer,
            "sources": [],
            "model_used": model_used,
        }

    if _is_small_talk(question):
        logger.info("Small talk detected (lexical); skipping retrieval")
        return await _chat_reply()

    query_embedding = embeddings.get_embedding(question, kind="query")

    if await _detect_chat_intent(question, query_embedding):
        logger.info("Small talk detected (semantic); skipping retrieval")
        return await _chat_reply()

    search_start = time.perf_counter()
    candidates = store.search(
        query_embedding=query_embedding,
        query_text=question,
        top_k=min(top_k * _CANDIDATE_MULTIPLIER, _MAX_CANDIDATES),
        filter_doc_id=doc_id,
        filter_doc_ids=doc_ids,
    )
    metrics.histogram("search_latency").observe(time.perf_counter() - search_start)
    metrics.counter("searches_total").inc()

    results = _select_context(question, candidates["results"], top_k)
    search_mode = candidates["mode"]
    logger.info(
        "Retrieved %d candidates, kept %d after threshold/dedup (mode=%s)",
        len(candidates["results"]),
        len(results),
        search_mode,
    )

    if not results:
        no_results_answer, no_results_model = await llm.generate_no_results(question, language)
        return {
            "answer": no_results_answer,
            "sources": [],
            "model_used": no_results_model,
        }

    context_chunks = [
        {"content": r["content"], "title": r["metadata"].get("title", "")}
        for r in results
    ]

    answer, model_used = await llm.generate_answer(question, context_chunks, language)

    logger.info(
        "RAG query answered from %d sources (model=%s)", len(results), model_used or "extractive"
    )

    sources = [
        {
            "doc_id": r["doc_id"],
            "chunk_index": r["chunk_index"],
            "content": r["content"],
            "score": r["score"],
            "title": r["metadata"].get("title", ""),
        }
        for r in results
    ]

    return {
        "answer": answer,
        "sources": sources,
        "model_used": model_used,
        "search_mode": search_mode,
    }
