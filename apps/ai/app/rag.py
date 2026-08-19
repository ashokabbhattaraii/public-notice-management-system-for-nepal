import re
import time
from typing import Optional

import numpy as np

from app import config
from app import embeddings
from app import llm
from app.metrics import metrics  # the registry instance, not the module
from app import store
from app.logger import get_logger

logger = get_logger(__name__)

# Over-fetch factor: retrieve extra candidates so filtering/dedup can drop
# weak or redundant chunks and still return top_k good ones.
_CANDIDATE_MULTIPLIER = 3
_MAX_CANDIDATES = 20

# Greetings/pleasantries in English, romanized Nepali, and Devanagari.
# Matched only against short messages so document questions never hit this.
_SMALL_TALK_PHRASES = [
    "hi", "hii", "hey", "hello", "yo", "sup", "wassup", "whats up", "howdy",
    "hi there", "hello there", "hey there", "hi bro", "hello bro",
    "namaste", "namaskar", "नमस्ते", "नमस्कार",
    "good morning", "good afternoon", "good evening", "good day", "good night",
    "how are you", "how r u", "how are u", "how do you do",
    "thank you", "thanks", "thankyou", "thanku", "thx", "ty",
    "dhanyabad", "dhanyawad", "धन्यवाद",
    "ok", "okay", "k", "hmm", "nice", "cool", "great",
    "bye", "goodbye", "bye bye", "see you", "see ya", "tata",
]


def _squeeze(text: str) -> str:
    """Collapse letter runs so 'Helllloooooo' and 'hello' both become 'helo'."""
    return re.sub(r"(.)\1+", r"\1", text)


# Pre-squeezed lookup set; input is squeezed the same way before comparing.
_SMALL_TALK = {_squeeze(p) for p in _SMALL_TALK_PHRASES}


def _is_small_talk(question: str) -> bool:
    if len(question) > 40:
        return False
    text = question.strip().lower()
    # Drop punctuation/emoji, keep latin words and Devanagari; normalize spaces.
    text = re.sub(r"[^a-zऀ-ॿ\s]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return bool(text) and _squeeze(text) in _SMALL_TALK


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

    # Unambiguous pleasantries skip the embedding comparison (and its possible
    # LLM tiebreak) entirely — same verdict, no compute.
    if llm.is_small_talk(question):
        logger.info("Intent (small talk): chat for %.40r", question)
        return True

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


def _select_context(results: list[dict], top_k: int) -> list[dict]:
    """Filter candidates: drop low-score hits and near-duplicate chunks.
    Then merge adjacent chunks from the same document/page/section for
    coherent citations with page-range output."""
    selected: list[dict] = []
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
        selected.append(r)
        if len(selected) >= top_k:
            break

    # Merge adjacent chunks from same document/page/section
    return _merge_adjacent_chunks(selected)


def _merge_adjacent_chunks(chunks: list[dict]) -> list[dict]:
    """Merge adjacent chunks from the same document/page/section.
    Returns merged chunks with page_range metadata for citations."""
    if not chunks:
        return chunks

    merged: list[dict] = []
    current = chunks[0].copy()

    for next_chunk in chunks[1:]:
        # Check if chunks are from same doc and adjacent (chunk_index diff <= 1)
        same_doc = current["doc_id"] == next_chunk["doc_id"]
        adjacent = next_chunk["chunk_index"] - current["chunk_index"] <= 1
        same_section = current.get("metadata", {}).get("section_path") == next_chunk.get("metadata", {}).get("section_path")

        if same_doc and adjacent and same_section:
            # Merge: concatenate content, update ranges
            current["content"] += "\n\n" + next_chunk["content"]
            current["char_end"] = next_chunk.get("char_end") or current.get("char_end")
            current["chunk_index"] = current["chunk_index"]  # keep first index
            # Track page range
            if "page_range" not in current:
                current["page_range"] = [current.get("page_num"), current.get("page_num")]
            next_page = next_chunk.get("page_num")
            if next_page is not None:
                if current["page_range"][1] != next_page:
                    current["page_range"][1] = next_page
        else:
            # Finalize current, start new
            if "page_range" not in current:
                current["page_range"] = [current.get("page_num"), current.get("page_num")]
            merged.append(current)
            current = next_chunk.copy()

    # Don't forget the last chunk
    if "page_range" not in current:
        current["page_range"] = [current.get("page_num"), current.get("page_num")]
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
        answer = await llm.generate_chat(question, language)
        return {
            "answer": answer,
            "sources": [],
            "model_used": config.GROQ_MODEL if config.GROQ_API_KEY else None,
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

    results = _select_context(candidates["results"], top_k)
    search_mode = candidates["mode"]
    logger.info(
        "Retrieved %d candidates, kept %d after threshold/dedup (mode=%s)",
        len(candidates["results"]),
        len(results),
        search_mode,
    )

    if not results:
        return {
            "answer": await llm.generate_no_results(question, language),
            "sources": [],
            "model_used": config.GROQ_MODEL if config.GROQ_API_KEY else None,
        }

    context_chunks = [
        {"content": r["content"], "title": r["metadata"].get("title", "")}
        for r in results
    ]

    answer = await llm.generate_answer(question, context_chunks, language)

    model_used = config.GROQ_MODEL if config.GROQ_API_KEY else "extractive"
    logger.info(
        "RAG query answered from %d sources (model=%s)", len(results), model_used
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
