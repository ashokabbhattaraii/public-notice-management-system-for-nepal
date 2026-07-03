import asyncio
import random
import re

import httpx
import numpy as np

from app import config
from app import embeddings
from app.logger import get_logger

logger = get_logger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Number of sentences the extractive fallback returns (kept short + precise).
FALLBACK_SENTENCES = 4
# Fallback sentences shorter than this are usually headings/fragments.
_MIN_SENTENCE_CHARS = 25

SYSTEM_PROMPT = """You are Suchana AI, an assistant that answers questions about Nepalese public notices and government documents using ONLY the provided context.

Rules:
- Ground every claim in the context. Never invent facts, numbers, dates, or names.
- Cite sources inline with bracketed numbers matching the context blocks, e.g. [1] or [2][3]. Cite after the specific claim, not in a list at the end.
- Format the answer in Markdown. Use short paragraphs; use bullet points for enumerations (requirements, steps, allocations) and **bold** for key figures, dates, and names.
- Match the answer length to the question: a factual lookup gets 1-2 sentences; "explain"/"summarize" questions get a structured answer, still under ~200 words.
- Answer in the same language the question is asked in, unless instructed otherwise.
- If the context does not contain the answer, say so plainly in one sentence and, if partially relevant material exists, state what IS covered. Do not pad.
- Answer directly — never open with filler like "According to the context" or "Based on the provided documents", and do not restate the question.
- Vary your wording naturally between answers; never sound like a template."""

CHAT_SYSTEM_PROMPT = """You are Suchana AI, the assistant for a Nepalese public notice portal where users upload and ask questions about government notices and documents.

The user sent a conversational message (a greeting, thanks, goodbye, or similar) — not a document question. Reply naturally:
- Respond to what they actually said: greet a greeting, acknowledge thanks, wish farewell to a goodbye.
- 1-2 short sentences, warm and human. No headers, no lists.
- Match the user's language and script (English, Nepali/Devanagari, or romanized Nepali).
- You may briefly mention that they can ask about their uploaded documents, but only when it fits — never as a stock closing line.
- Never claim to know document contents, and never repeat the same canned phrasing."""

# A rotating style nudge keeps repeated greetings from converging on one
# template phrase, even at high temperature.
_STYLE_HINTS = [
    "Keep this reply especially brief — under 15 words.",
    "Open with something other than a greeting word this time.",
    "Use a slightly playful tone.",
    "Use a calm, professional tone.",
    "Lead with an offer to help.",
    "Reply as if continuing a friendly conversation.",
]

# Same idea for answers: a rotating structural directive makes the same
# question produce genuinely different (but equally grounded) answers.
_ANSWER_STYLE_HINTS = [
    "Lead with the single most important fact, then add supporting detail.",
    "If the material allows it, structure the answer as brief bullet points.",
    "Answer in flowing prose without bullet points this time.",
    "Be as concise as accuracy allows.",
    "Add one sentence of helpful surrounding context from the sources after the direct answer.",
    "Frame the answer as if briefing a colleague quickly.",
]

NO_RESULTS_PROMPT = """You are Suchana AI, an assistant for a Nepalese public notice portal. The user asked a question, but a search of the uploaded documents found nothing relevant.

Tell them so in 1-2 sentences, in the same language as their question. Optionally suggest rephrasing or asking about another topic from their documents. Be honest — do not guess an answer. Vary your wording; never sound like a template."""

_CANNED_NO_RESULTS = [
    "I couldn't find anything in the uploaded documents about that. Try rephrasing, or ask about a different topic from the notices.",
    "The uploaded documents don't seem to cover that. Could you rephrase the question or ask about something else in them?",
    "I didn't find relevant content for that question in the indexed documents — feel free to try different wording.",
]

# Used when no LLM key is configured; picked at random for variety.
_CANNED_GREETINGS_EN = [
    "Hello! I'm Suchana AI. Ask me anything about the uploaded notices or documents.",
    "Hi there! How can I help you today? You can ask me about any uploaded document.",
    "Hey! I'm here to help you find information in your public notices — what would you like to know?",
]
_CANNED_GREETINGS_NE = [
    "नमस्ते! म सूचना AI हुँ। अपलोड गरिएका सूचना वा कागजातहरूबारे केही सोध्नुहोस्।",
    "नमस्कार! म तपाईंलाई कसरी सहयोग गर्न सक्छु? कुनै पनि कागजातबारे सोध्न सक्नुहुन्छ।",
]


async def generate_answer(
    question: str, context_chunks: list[dict], language: str = "en"
) -> str:
    """Generate an answer from retrieved chunks.

    context_chunks: [{"content": str, "title": str}, ...] in relevance order.
    """
    if not config.GROQ_API_KEY:
        logger.info("GROQ_API_KEY not set; using extractive fallback")
        return _extractive_fallback(question, context_chunks)

    context = "\n\n".join(
        f"[{i + 1}] (from “{chunk.get('title') or 'Untitled document'}”)\n{chunk['content']}"
        for i, chunk in enumerate(context_chunks)
    )

    lang_instruction = ""
    if language == "ne":
        lang_instruction = "\nRespond in Nepali (Devanagari script)."

    style_hint = f"\n\nFor this answer: {random.choice(_ANSWER_STYLE_HINTS)}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + lang_instruction + style_hint},
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {question}",
        },
    ]

    # Temperature 0.7 keeps answers grounded in context (the prompt enforces
    # that) while letting repeated questions get naturally varied phrasing.
    answer = await _groq_chat(messages, max_tokens=1024, temperature=0.7)
    if answer is None:
        return _extractive_fallback(question, context_chunks)
    return answer


async def generate_chat(message: str, language: str = "en") -> str:
    """Answer small talk (greetings, thanks) without document retrieval."""
    if config.GROQ_API_KEY:
        messages = [
            {
                "role": "system",
                "content": f"{CHAT_SYSTEM_PROMPT}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": message},
        ]
        answer = await _groq_chat(messages, max_tokens=150, temperature=0.9)
        if answer:
            return answer

    canned = _CANNED_GREETINGS_NE if language == "ne" else _CANNED_GREETINGS_EN
    return random.choice(canned)


async def generate_no_results(question: str, language: str = "en") -> str:
    """Generate a unique 'nothing found' reply; canned only without an LLM."""
    if config.GROQ_API_KEY:
        messages = [
            {
                "role": "system",
                "content": f"{NO_RESULTS_PROMPT}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": question},
        ]
        answer = await _groq_chat(messages, max_tokens=150, temperature=0.9)
        if answer:
            return answer

    return random.choice(_CANNED_NO_RESULTS)


_INTENT_PROMPT = """Classify the user's message for a document Q&A assistant on a Nepalese public notice portal. Messages may be in English, Nepali, romanized Nepali, or sloppy textspeak ("gud mrng ji", "helo kasto xa").

Reply with exactly one word:
- "chat" — greeting, small talk, thanks, goodbye, or a question about the assistant itself
- "docs" — asking about the content of documents, notices, deadlines, policies, or any information lookup"""


async def classify_intent(message: str) -> str | None:
    """Classify a message as 'chat' or 'docs'. None if no LLM is available."""
    if not config.GROQ_API_KEY:
        return None
    result = await _groq_chat(
        [
            {"role": "system", "content": _INTENT_PROMPT},
            {"role": "user", "content": message},
        ],
        max_tokens=5,
        temperature=0.0,
    )
    if result is None:
        return None
    return "chat" if "chat" in result.lower() else "docs"


async def _groq_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Call Groq chat completions; returns None on any failure.

    Retries once on transient failures (rate limit, upstream 5xx, network).
    """
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {config.GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as e:
            logger.error("Groq request failed (attempt %d): %s", attempt + 1, e)
            if attempt == 0:
                await asyncio.sleep(1.5)
                continue
            return None

        if response.status_code in (429, 500, 502, 503) and attempt == 0:
            logger.warning("Groq returned %d; retrying once", response.status_code)
            await asyncio.sleep(2.0)
            continue

        if response.status_code != 200:
            logger.error(
                "Groq returned %d: %.200s", response.status_code, response.text
            )
            return None

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            logger.error("Groq response missing choices: %.200s", response.text)
            return None

        logger.debug("Groq answer generated with model=%s", config.GROQ_MODEL)
        return _clean_answer(content)

    return None


def _clean_answer(text: str) -> str:
    # Reasoning models leak <think> blocks; they must never reach the UI.
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    # Bullets/numbering read as noise once sentences are re-assembled.
    text = re.sub(r"[•●▪]|\s[-–]\s", " ", text.replace("\n", " "))
    text = re.sub(r"\s{2,}", " ", text)
    # Split on sentence terminators, including the Devanagari danda (।).
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    return [
        s.strip()
        for s in sentences
        if len(s.strip()) >= _MIN_SENTENCE_CHARS
        # Drop fragments that start mid-word/mid-sentence (lowercase latin).
        and not s.strip()[0].islower()
    ]


def _extractive_fallback(question: str, context_chunks: list[dict]) -> str:
    """Return the few sentences most relevant to the question.

    Sentences are ranked by cosine similarity to the question using the same
    embedding model as retrieval, so the answer stays short and on-point
    instead of dumping whole chunks.
    """
    if not context_chunks:
        return "The provided documents do not contain this information."

    sentences: list[str] = []
    for chunk in context_chunks:
        sentences.extend(_split_sentences(chunk["content"]))

    if not sentences:
        return context_chunks[0]["content"].strip()

    try:
        q_vec = np.array(embeddings.get_embedding(question))
        sent_vecs = np.array(embeddings.get_embeddings(sentences))
        # Embeddings are L2-normalized, so a dot product is cosine similarity.
        scores = sent_vecs @ q_vec
        ranked = np.argsort(scores)[::-1]

        # Take the top sentences, skipping near-duplicates (overlapping chunks
        # repeat their boundary sentences).
        picked: list[int] = []
        seen: set[str] = set()
        for i in ranked:
            key = sentences[i][:60].lower()
            if key in seen:
                continue
            seen.add(key)
            picked.append(int(i))
            if len(picked) >= FALLBACK_SENTENCES:
                break

        # Preserve original reading order among the top matches.
        best = [sentences[i] for i in sorted(picked)]
        if len(best) == 1:
            return best[0]
        return "The most relevant points from the documents:\n\n" + "\n".join(
            f"- {s}" for s in best
        )
    except Exception:
        logger.exception("Extractive ranking failed; returning first sentence")
        return sentences[0]
