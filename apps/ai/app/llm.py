import asyncio
import json
import random
import re
from typing import AsyncIterator, Optional

import httpx
import numpy as np

from app import config
from app import embeddings
from app.logger import get_logger

logger = get_logger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# DeepSeek via OpenCode Zen is a *reasoning* model: it emits an internal
# thinking trace before the answer, so time-to-last-byte is far higher than a
# standard chat model. Measured ~28s for a short notice; long notices (up to
# 8,000 chars of context) routinely exceed 60s. The previous shared 45s
# timeout meant attempt 1 nearly always hit ReadTimeout, burning 45s before
# retrying — the direct cause of /notices/analyze taking 56-103s and of
# spurious fallbacks to Groq/Gemini even while DeepSeek was healthy.
# Connect stays short (a real connection failure should fail fast); only the
# read budget is generous.
_DEEPSEEK_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
# Groq and Gemini are non-reasoning and respond quickly; keep them snappy so
# a hung provider doesn't stall the whole fallback chain.
_STANDARD_TIMEOUT = httpx.Timeout(45.0, connect=10.0)

FALLBACK_SENTENCES = 4
_MIN_SENTENCE_CHARS = 25

SYSTEM_PROMPT = """You are Suchana AI, answering questions about Nepalese public notices and government documents using ONLY the provided context.

ANSWER CONTRACT — follow exactly:
1. First line: the direct answer, in one sentence. No preamble, no restating the question, no "According to the context".
2. Then, only if the question needs it, supporting detail as short bullets.
3. Cite with bracketed numbers matching the context blocks, immediately after the claim they support: "The fee is **Rs. 1,000** [2]." Never group citations at the end.
4. **Bold** every date, deadline, amount, and reference number.
5. Match length to the question: a factual lookup is 1-2 sentences; "explain"/"summarize" gets structure but stays under 200 words. Do not pad.

ACCURACY — non-negotiable:
- Every claim must be traceable to the context. Never invent or infer facts, numbers, dates, or names.
- If the context answers only part of the question, answer that part and say plainly what is not covered.
- If it does not answer the question at all, say so in one sentence and state what the documents DO cover.

LANGUAGE:
- Answer in the language of the question.
- If the context is Nepali (Devanagari) and the question is English, TRANSLATE and explain fully in English. Do not leave raw Devanagari inline; proper nouns and official titles may appear in parentheses.
- If the question is Nepali and the context English, answer in Nepali."""

CHAT_SYSTEM_PROMPT = """You are Suchana AI, the assistant for a Nepalese public notice portal where users upload and ask questions about government notices and documents.

The user sent a conversational message (a greeting, thanks, goodbye, or similar) — not a document question. Reply naturally:
- Respond to what they actually said: greet a greeting, acknowledge thanks, wish farewell to a goodbye.
- 1-2 short sentences, warm and human. No headers, no lists.
- Match the user's language and script (English, Nepali/Devanagari, or romanized Nepali).
- You may briefly mention that they can ask about their uploaded documents, but only when it fits — never as a stock closing line.
- Never claim to know document contents, and never repeat the same canned phrasing."""

_STYLE_HINTS = [
    "Keep this reply especially brief — under 15 words.",
    "Open with something other than a greeting word this time.",
    "Use a slightly playful tone.",
    "Use a calm, professional tone.",
    "Lead with an offer to help.",
    "Reply as if continuing a friendly conversation.",
]

# NOTE: factual answer paths deliberately have no style randomization. An
# earlier version injected a random "style hint" into every answer prompt so
# replies would not sound templated. For greetings that is harmless, but on
# grounded answers it traded away exactly what this assistant is for: the same
# question could yield a bullet list, a prose paragraph, or an expanded
# "briefing" on consecutive asks, and the extra prose invited unsupported
# filler. Style variation now lives only in `_STYLE_HINTS`, used for small talk.

NO_RESULTS_PROMPT = """You are Suchana AI, an assistant for a Nepalese public notice portal. The user asked a question, but a search of the uploaded documents found nothing relevant.

Tell them so in 1-2 sentences, in the same language as their question. Optionally suggest rephrasing or asking about another topic from their documents. Be honest — do not guess an answer. Vary your wording; never sound like a template."""

_CANNED_NO_RESULTS = [
    "I couldn't find anything in the uploaded documents about that. Try rephrasing, or ask about a different topic from the notices.",
    "The uploaded documents don't seem to cover that. Could you rephrase the question or ask about something else in them?",
    "I didn't find relevant content for that question in the indexed documents — feel free to try different wording.",
]

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
) -> tuple[str, Optional[str]]:
    """Returns (answer, model_used). model_used is None when the extractive
    fallback was used (no LLM configured, or all providers failed) — callers
    should surface that distinction rather than guessing a model name."""
    if not has_provider():
        logger.info("No LLM key configured; using extractive fallback")
        return _extractive_fallback(question, context_chunks), None

    context = "\n\n".join(
        f"[{i + 1}] (from “{chunk.get('title') or 'Untitled document'}”)\n{chunk['content']}"
        for i, chunk in enumerate(context_chunks)
    )

    lang_instruction = ""
    if language == "ne":
        lang_instruction = "\nRespond in Nepali (Devanagari script)."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + lang_instruction},
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {question}",
        },
    ]

    # Low temperature and fast-first routing: this is a grounded lookup, where
    # creativity is a liability and the user is watching a loading indicator.
    answer, model_used = await chat(
        messages, max_tokens=1024, temperature=0.15, prefer="fast"
    )
    if answer is None:
        return _extractive_fallback(question, context_chunks), None
    return answer, model_used


async def generate_chat(message: str, language: str = "en") -> tuple[str, Optional[str]]:
    if has_provider():
        messages = [
            {
                "role": "system",
                "content": f"{CHAT_SYSTEM_PROMPT}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": message},
        ]
        # Greetings are the one path where varied phrasing is the goal, so the
        # style hint and a high temperature stay.
        answer, model_used = await chat(
            messages, max_tokens=150, temperature=0.9, prefer="fast"
        )
        if answer:
            return answer, model_used

    canned = _CANNED_GREETINGS_NE if language == "ne" else _CANNED_GREETINGS_EN
    return random.choice(canned), None


async def generate_no_results(question: str, language: str = "en") -> tuple[str, Optional[str]]:
    if has_provider():
        messages = [
            {
                "role": "system",
                "content": f"{NO_RESULTS_PROMPT}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": question},
        ]
        answer, model_used = await chat(
            messages, max_tokens=150, temperature=0.7, prefer="fast"
        )
        if answer:
            return answer, model_used

    return random.choice(_CANNED_NO_RESULTS), None


_REWRITE_PROMPT = """Rewrite the user's latest message as a standalone search query for a Nepalese public notice database.

Rules:
- Resolve pronouns and ellipsis using the conversation: "what about the fee?" after a question about a vacancy notice becomes "application fee for the vacancy notice".
- Keep the user's own terminology, including Nepali or romanized-Nepali words. Do not translate.
- Output ONLY the rewritten query — no quotes, no explanation, no preamble.
- If the message is already self-contained, output it unchanged."""

# Signals that a message depends on earlier turns to be understood. Retrieval
# on the raw text of these fails badly: "what about the fee?" has no content
# words that match anything, so the keyword leg returns nothing and the vector
# leg matches whatever is vaguely fee-shaped across the whole corpus.
_CONTEXT_DEPENDENT_RE = re.compile(
    r"^\s*(and|what about|how about|ani|tyo|also|then)\b"
    r"|\b(it|its|it's|that|this|those|these|there|them|they|same|above)\b"
    r"|^\s*\w+\s*\??\s*$",
    re.IGNORECASE,
)


def needs_rewrite(question: str, history: list[dict] | None) -> bool:
    """Whether resolving this question against history is worth an LLM call."""
    if not history:
        return False
    if len(question) > 120:
        return False
    return bool(_CONTEXT_DEPENDENT_RE.search(question))


async def rewrite_query(question: str, history: list[dict] | None) -> str:
    """Expand a follow-up into a standalone query for retrieval.

    Only the retrieval query is rewritten — the answer prompt still receives
    the user's original wording, so the reply addresses what they actually
    asked rather than a paraphrase of it.
    """
    if not needs_rewrite(question, history) or not has_provider():
        return question

    transcript = "\n".join(
        f"{turn['role']}: {turn['content'][:300]}" for turn in _trim_history(history)
    )
    rewritten, _model = await chat(
        [
            {"role": "system", "content": _REWRITE_PROMPT},
            {"role": "user", "content": f"Conversation:\n{transcript}\n\nLatest message: {question}"},
        ],
        max_tokens=120,
        temperature=0.0,
        prefer="fast",
    )

    if not rewritten:
        return question

    cleaned = rewritten.strip().strip('"').split("\n")[0].strip()
    # A rewrite that collapses to almost nothing, or balloons into an
    # explanation, is a worse retrieval query than the original.
    if not cleaned or len(cleaned) > 300:
        return question

    if cleaned.lower() != question.strip().lower():
        logger.info("Rewrote query for retrieval: %.60r -> %.60r", question, cleaned)
    return cleaned


_INTENT_PROMPT = """Classify the user's message for a document Q&A assistant on a Nepalese public notice portal. Messages may be in English, Nepali, romanized Nepali, or sloppy textspeak ("gud mrng ji", "helo kasto xa").

Reply with exactly one word:
- "chat" — greeting, small talk, thanks, goodbye, or a question about the assistant itself
- "docs" — asking about the content of documents, notices, deadlines, policies, or any information lookup"""


async def classify_intent(message: str) -> str | None:
    if not has_provider():
        return None
    result, _model_used = await chat(
        [
            {"role": "system", "content": _INTENT_PROMPT},
            {"role": "user", "content": message},
        ],
        # 5 was enough for non-reasoning models but starves a reasoning model
        # (DeepSeek writes a reasoning trace before the one-word answer) —
        # this is a ceiling, not a target, so raising it doesn't cost more
        # tokens on models that answer directly.
        max_tokens=80,
        temperature=0.0,
        # This sits in front of every retrieval, so its latency is added to
        # every answer — it must use the fastest provider available.
        prefer="fast",
    )
    if result is None:
        return None
    return "chat" if "chat" in result.lower() else "docs"


# ---------------------------------------------------------------------------
# Unified LLM dispatch.
#
# Provider order depends on what the call is for, because the providers differ
# by an order of magnitude in latency:
#
#   prefer="fast"    — interactive chat. Groq answers in ~1-2s; DeepSeek via
#                      OpenCode Zen is a *reasoning* model that writes a
#                      thinking trace first and routinely takes 30-100s. A user
#                      waiting on a chat bubble cannot absorb that, so Groq
#                      leads and DeepSeek is the last resort.
#   prefer="quality" — background enrichment (notice analysis). Nobody is
#                      watching the clock, and the reasoning model produces
#                      better structured extraction, so it leads there.
#
# This ordering was previously fixed at DeepSeek-first for every call, which is
# why chat answers took ~30s in the common case.
# ---------------------------------------------------------------------------

_FAST_ORDER = ("groq", "gemini", "deepseek")
_QUALITY_ORDER = ("deepseek", "groq", "gemini")


def has_provider() -> bool:
    """True when at least one LLM provider is configured."""
    return bool(
        config.OPENCODE_ZEN_API_KEY or config.GEMINI_API_KEY or config.GROQ_API_KEY
    )


def _provider_available(name: str) -> bool:
    if name == "deepseek":
        return bool(config.OPENCODE_ZEN_API_KEY and config.OPENCODE_ZEN_BASE_URL)
    if name == "groq":
        return bool(config.GROQ_API_KEY)
    if name == "gemini":
        return bool(config.GEMINI_API_KEY)
    return False


def _provider_model(name: str) -> str:
    return {
        "deepseek": config.OPENCODE_ZEN_MODEL,
        "groq": config.GROQ_MODEL,
        "gemini": config.GEMINI_MODEL,
    }[name]


async def chat(
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    prefer: str = "quality",
) -> tuple[Optional[str], Optional[str]]:
    """Call the first working provider in the order implied by `prefer`.

    Returns (text, model_used) — model_used names the provider that actually
    answered, so callers report the real model rather than assuming whichever
    key happens to be configured.
    """
    order = _FAST_ORDER if prefer == "fast" else _QUALITY_ORDER
    handlers = {
        "deepseek": _deepseek_chat,
        "groq": _groq_chat,
        "gemini": _gemini_chat,
    }

    for name in order:
        if not _provider_available(name):
            continue
        result = await handlers[name](messages, max_tokens, temperature)
        if result is not None:
            return result, _provider_model(name)
        # Name the configured model, not a hardcoded one — the model env vars
        # are swappable, and a stale label sends you chasing the wrong model.
        logger.warning("%s (%s) failed; trying next provider", name, _provider_model(name))

    return None, None


# Back-compat alias: `_llm_chat` predates the prefer-aware dispatcher and is
# still referenced from other modules.
async def _llm_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> tuple[Optional[str], Optional[str]]:
    return await chat(messages, max_tokens, temperature, prefer="quality")


# ---------------------------------------------------------------------------
# Streaming
#
# Total generation time is unchanged by streaming, but *perceived* latency
# collapses: the user reads the first sentence while the rest is still being
# written, instead of watching a spinner for the whole answer. For a grounded
# answer whose first line is by contract the direct answer, that first token is
# usually all they needed.
# ---------------------------------------------------------------------------


async def stream(
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    prefer: str = "fast",
) -> AsyncIterator[tuple[str, Optional[str]]]:
    """Yield (text_delta, model_used) as the answer is generated.

    Providers are tried in `prefer` order, same as `chat`. Gemini is served
    through a non-streaming call emitted as a single chunk — it is the
    last-resort provider, so the added complexity of a second streaming wire
    format is not worth it; callers see an identical interface either way.
    """
    order = _FAST_ORDER if prefer == "fast" else _QUALITY_ORDER

    for name in order:
        if not _provider_available(name):
            continue
        model = _provider_model(name)

        if name in ("groq", "deepseek"):
            produced = False
            try:
                async for delta in _openai_stream(name, messages, max_tokens, temperature):
                    produced = True
                    yield delta, model
            except Exception:
                logger.exception("%s streaming failed", name)
                # Mid-stream failure: the client already has partial text, so
                # restarting with another provider would duplicate content.
                # Surfacing the truncation is the honest outcome.
                if produced:
                    return
                continue
            if produced:
                return
            logger.warning("%s produced no content; trying next provider", name)
            continue

        if name == "gemini":
            text = await _gemini_chat(messages, max_tokens, temperature)
            if text:
                yield text, model
                return

    return


async def _openai_stream(
    provider: str, messages: list[dict], max_tokens: int, temperature: float
) -> AsyncIterator[str]:
    """Consume an OpenAI-compatible SSE stream, yielding content deltas."""
    if provider == "groq":
        url = GROQ_API_URL
        api_key = _next_llm_groq_key()
        model = config.GROQ_MODEL
        timeout = _STANDARD_TIMEOUT
    else:
        url = config.OPENCODE_ZEN_BASE_URL
        api_key = config.OPENCODE_ZEN_API_KEY
        model = config.OPENCODE_ZEN_MODEL
        timeout = _DEEPSEEK_TIMEOUT

    if not api_key:
        return

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as response:
            if response.status_code != 200:
                body = (await response.aread())[:200]
                logger.error("%s stream returned %d: %.200s", provider, response.status_code, body)
                return

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    if data == "[DONE]":
                        break
                    continue
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content")
                except (ValueError, KeyError, IndexError, TypeError):
                    continue
                if delta:
                    yield delta


# ---------------------------------------------------------------------------
# DeepSeek provider (via OpenCode Zen — OpenAI-compatible chat completions)
# ---------------------------------------------------------------------------


async def _deepseek_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Call DeepSeek via OpenCode Zen. Returns None on any failure."""
    payload = {
        "model": config.OPENCODE_ZEN_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=_DEEPSEEK_TIMEOUT) as client:
                response = await client.post(
                    config.OPENCODE_ZEN_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {config.OPENCODE_ZEN_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.TimeoutException as e:
            # Already spent the full (generous) read budget — retrying would
            # double the wait for a caller that is very likely to have given
            # up, so fall through to the next provider instead.
            logger.error(
                "OpenCode Zen timed out after %.0fs (%s); not retrying, falling through",
                _DEEPSEEK_TIMEOUT.read,
                type(e).__name__,
            )
            return None
        except httpx.HTTPError as e:
            # str(e) is often empty for connection-level errors (resets,
            # DNS) — include the exception type so failures are still
            # diagnosable instead of logging "request failed: ''".
            logger.error("OpenCode Zen request failed (attempt %d): %s: %s", attempt + 1, type(e).__name__, e)
            if attempt == 0:
                await asyncio.sleep(1.0)
                continue
            return None

        if response.status_code in (429, 500, 502, 503) and attempt == 0:
            logger.warning("OpenCode Zen returned %d; retrying once", response.status_code)
            await asyncio.sleep(1.5)
            continue

        if response.status_code != 200:
            logger.error(
                "OpenCode Zen returned %d: %.200s", response.status_code, response.text
            )
            return None

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            logger.error("OpenCode Zen response missing choices: %.200s", response.text)
            return None

        # This model reasons internally before writing its final answer
        # (see `reasoning_content` in the response) — a too-tight max_tokens
        # budget can be entirely consumed by reasoning, leaving `content`
        # empty. Treat that as a failure so the caller falls through to the
        # next provider instead of "succeeding" with a blank answer.
        if not content or not content.strip():
            logger.warning("OpenCode Zen returned empty content (reasoning likely exhausted max_tokens)")
            return None

        logger.debug("OpenCode Zen answer generated with model=%s", config.OPENCODE_ZEN_MODEL)
        return _clean_answer(content)

    return None


# ---------------------------------------------------------------------------
# Gemini provider
# ---------------------------------------------------------------------------


async def _gemini_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Call Google Gemini API. Returns None on any failure."""
    system_parts = []
    contents = []

    for msg in messages:
        if msg["role"] == "system":
            system_parts.append(msg["content"])
        elif msg["role"] == "user":
            contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
        elif msg["role"] == "assistant":
            contents.append({"role": "model", "parts": [{"text": msg["content"]}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
        },
    }
    if system_parts:
        payload["systemInstruction"] = {
            "parts": [{"text": "\n\n".join(system_parts)}]
        }

    url = GEMINI_API_URL.format(model=config.GEMINI_MODEL) + f"?key={config.GEMINI_API_KEY}"

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=_STANDARD_TIMEOUT) as client:
                response = await client.post(url, json=payload)
        except httpx.HTTPError as e:
            logger.error("Gemini request failed (attempt %d): %s: %s", attempt + 1, type(e).__name__, e)
            if attempt == 0:
                await asyncio.sleep(1.0)
                continue
            return None

        if response.status_code in (429, 500, 502, 503) and attempt == 0:
            logger.warning("Gemini returned %d; retrying once", response.status_code)
            await asyncio.sleep(1.5)
            continue

        if response.status_code != 200:
            logger.error(
                "Gemini returned %d: %.200s", response.status_code, response.text
            )
            return None

        try:
            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
        except (ValueError, KeyError, IndexError, TypeError):
            logger.error("Gemini response missing content: %.200s", response.text)
            return None

        logger.debug("Gemini answer generated with model=%s", config.GEMINI_MODEL)
        return _clean_answer(content)

    return None


# ---------------------------------------------------------------------------
# Groq provider
# ---------------------------------------------------------------------------


_LLM_GROQ_KEY_INDEX = 0


def _next_llm_groq_key() -> str:
    """Round-robin through available Groq API keys for llm module."""
    global _LLM_GROQ_KEY_INDEX
    keys = config.GROQ_API_KEYS
    if not keys:
        return ""
    key = keys[_LLM_GROQ_KEY_INDEX % len(keys)]
    _LLM_GROQ_KEY_INDEX += 1
    return key


async def _groq_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Call Groq chat completions with key rotation; returns None on any failure."""
    payload = {
        "model": config.GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    num_keys = len(config.GROQ_API_KEYS)
    max_attempts = max(2, num_keys + 1)

    for attempt in range(max_attempts):
        api_key = _next_llm_groq_key()
        if not api_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=_STANDARD_TIMEOUT) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as e:
            logger.error("Groq request failed (attempt %d): %s: %s", attempt + 1, type(e).__name__, e)
            if attempt < max_attempts - 1:
                await asyncio.sleep(1.5)
                continue
            return None

        if response.status_code == 429 and attempt < max_attempts - 1:
            logger.info("Groq 429, rotating key (attempt %d/%d)", attempt + 1, max_attempts)
            if (attempt + 1) % num_keys == 0:
                await asyncio.sleep(2.0)
            continue

        if response.status_code in (500, 502, 503) and attempt < max_attempts - 1:
            logger.warning("Groq returned %d; retrying", response.status_code)
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clean_answer(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    text = re.sub(r"[•●▪]|\s[-–]\s", " ", text.replace("\n", " "))
    text = re.sub(r"\s{2,}", " ", text)
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    return [
        s.strip()
        for s in sentences
        if len(s.strip()) >= _MIN_SENTENCE_CHARS
        and not s.strip()[0].islower()
    ]


def _extractive_fallback(question: str, context_chunks: list[dict]) -> str:
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
        scores = sent_vecs @ q_vec
        ranked = np.argsort(scores)[::-1]

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

        best = [sentences[i] for i in sorted(picked)]
        if len(best) == 1:
            return best[0]
        return "The most relevant points from the documents:\n\n" + "\n".join(
            f"- {s}" for s in best
        )
    except Exception:
        logger.exception("Extractive ranking failed; returning first sentence")
        return sentences[0]


# --- Single-notice AI analysis (summary/key facts/tags) + Q&A ---

# Must stay in sync with CANONICAL_TAGS in apps/web/lib/types.ts — the web
# app's tag filter chips do an exact-match lookup against stored tags, so a
# tag the LLM invents that isn't in this list (e.g. "Ministry of Education"
# instead of "education") is permanently unfilterable. This was the root
# cause of tag filtering silently matching nothing: the prompt previously
# told the model to prefer specific/unique names over exactly this kind of
# controlled vocabulary.
_CANONICAL_TAGS = (
    "education, health, employment, procurement, infrastructure, environment, "
    "finance, legal, transport, technology, agriculture, tourism, culture, "
    "disaster, governance, social welfare, youth, women, senior citizens, "
    "disability, migration, foreign affairs, defense, energy, water, "
    "sanitation, housing, urban development, rural development, local "
    "government, federal affairs, constitution, election, budget, taxation, "
    "trade, industry, science, research, innovation, digital, cybersecurity, "
    "climate, biodiversity, forestry, mining, labor, skill development, "
    "vocational training, scholarship, exam, result, admission, recruitment, "
    "promotion, transfer, retirement, pension, insurance, banking, "
    "microfinance, cooperatives, ngo, civil society, human rights, gender, "
    "child protection"
)

_ANALYZE_PROMPT = f"""You analyze a single Nepalese government/public notice or news item and produce a JSON summary for display on a notice detail page.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{{"summary": "2-3 sentence plain-language summary in English", "summary_ne": "Same summary translated to Nepali (देवनागरी script)", "key_facts": ["short fact 1", "short fact 2", "..."], "tags": ["topic1", "topic2", "..."], "category": "<one of: NOTICE, NEWS, PRESS_RELEASE, CIRCULAR, TENDER, VACANCY, OTHER>", "category_confidence": <0.0-1.0 float>}}

Rules:
- summary: plain language English, no jargon, captures what the notice actually says and who it affects. If the content is in Nepali, translate and summarize in English.
- summary_ne: the same summary written in Nepali (देवनागरी). If the content is already in Nepali, summarize directly. If in English, translate to Nepali.
- key_facts: 3-6 short, concrete, standalone facts (dates, eligibility, amounts, deadlines, affected wards/groups, procedures) — each under ~12 words. Omit facts not actually stated in the content.
- tags: 2-4 tags, chosen from this exact controlled vocabulary (lowercase, verbatim, comma-separated below) — pick every one that genuinely applies, most relevant first: {_CANONICAL_TAGS}.
  You may add ONE additional specific tag after those (e.g. an organization name) only if it adds real filtering value beyond the canonical ones. Never invent a substitute for a canonical tag (e.g. write "education", not "Ministry of Education").
- category: classify the notice type. VACANCY for any open position (job, internship, traineeship, or otherwise — do not try to distinguish further); CIRCULAR for internal directives; TENDER for procurement; PRESS_RELEASE for official statements; NEWS for general news; NOTICE for general public notices.
- category_confidence: how confident you are in the classification (0.0-1.0).
- Ground everything in the provided content. Never invent facts."""

_ASK_PROMPT = """You are Suchana AI, answering a question about ONE specific Nepalese public notice using ONLY its content below.

ANSWER CONTRACT — follow exactly:
1. First line: the direct answer in one sentence. No preamble, no "Based on the notice...", no restating the question.
2. Then, only if needed, supporting detail as short bullets.
3. **Bold** every date, deadline, amount, reference number, and eligibility threshold.
4. Under 150 words. A factual lookup is 1-2 sentences.

ACCURACY — non-negotiable:
- Every claim must come from the notice content. Never infer or fill gaps from general knowledge.
- If the notice answers only part of the question, answer that part and say what it does not state.
- If the notice does not answer it, say exactly that in one sentence and name what the notice does cover. Do not guess.
- Do not treat the notice title as its content.

LANGUAGE: answer in the language of the question. If the notice is in Nepali and the question in English, translate and explain fully in English."""


async def analyze_notice(title: str, content: str) -> dict | None:
    if not has_provider():
        return None

    trimmed_content = content[:8000]

    messages = [
        {"role": "system", "content": _ANALYZE_PROMPT},
        {"role": "user", "content": f"Title: {title}\n\nContent:\n{trimmed_content}"},
    ]

    # 600 was enough for non-reasoning models but a reasoning model's
    # thinking trace plus a full bilingual JSON summary of a long notice
    # regularly exceeded it, silently truncating mid-JSON (observed cut off
    # mid-string at `"category": "`) and failing to parse. 2000 still wasn't
    # enough on denser notices — observed "OpenCode Zen returned empty
    # content" (reasoning alone ate the whole budget) in production logs.
    # This call asks for the most in one shot of any prompt here (bilingual
    # summary + key facts + tags + category), so it gets the most headroom.
    # This is a ceiling, not a target, so it doesn't cost more tokens on
    # models that answer directly.
    # prefer="quality": this runs during scraping, not while a user waits, so
    # the slower reasoning model's better structured extraction is worth it.
    raw, _model_used = await chat(
        messages, max_tokens=4000, temperature=0.2, prefer="quality"
    )
    if raw is None:
        return None

    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("analyze_notice: could not parse LLM JSON output")
        return None

    summary = data.get("summary")
    if not summary:
        return None

    # Validate category if present
    valid_categories = {
        "NOTICE", "NEWS", "PRESS_RELEASE", "CIRCULAR", "TENDER", "VACANCY", "OTHER"
    }
    llm_category = data.get("category")
    if llm_category and llm_category not in valid_categories:
        llm_category = None
    llm_confidence = float(data.get("category_confidence", 0.0)) if data.get("category_confidence") is not None else 0.0

    return {
        "summary": str(summary).strip(),
        "summary_ne": str(data.get("summary_ne") or "").strip() or None,
        "key_facts": [str(f).strip() for f in (data.get("key_facts") or []) if str(f).strip()][:6],
        "tags": [str(t).strip() for t in (data.get("tags") or []) if str(t).strip()][:5],
        "category": llm_category,
        "category_confidence": llm_confidence,
    }


async def answer_notice_question(
    title: str, content: str, question: str, history: list[dict] | None = None
) -> str:
    if not has_provider():
        return _extractive_fallback(question, [{"content": content, "title": title}])

    answer, _model_used = await chat(
        _notice_ask_messages(title, content, question, history),
        max_tokens=500,
        temperature=0.15,
        prefer="fast",
    )
    if answer is None:
        return _extractive_fallback(question, [{"content": content, "title": title}])
    return answer


def _notice_ask_messages(
    title: str, content: str, question: str, history: list[dict] | None
) -> list[dict]:
    return [
        {"role": "system", "content": _ASK_PROMPT},
        *_trim_history(history),
        {
            "role": "user",
            "content": (
                f"Notice title: {title}\n\nNotice content:\n{content[:8000]}"
                f"\n\nQuestion: {question}"
            ),
        },
    ]


async def answer_notice_question_stream(
    title: str, content: str, question: str, history: list[dict] | None = None
) -> AsyncIterator[tuple[str, Optional[str]]]:
    """Streaming counterpart of `answer_notice_question`."""
    if not has_provider():
        yield _extractive_fallback(question, [{"content": content, "title": title}]), None
        return

    produced = False
    async for delta, model in stream(
        _notice_ask_messages(title, content, question, history),
        max_tokens=500,
        temperature=0.15,
        prefer="fast",
    ):
        produced = True
        yield delta, model

    if not produced:
        yield _extractive_fallback(question, [{"content": content, "title": title}]), None


def _trim_history(history: list[dict] | None) -> list[dict]:
    """Prior turns for follow-up resolution ("what about the fee?").

    Capped at 6 turns and 600 characters each: history exists here to
    disambiguate references, not to be re-read in full, and unbounded history
    would crowd out the notice content that answers the question.
    """
    if not history:
        return []
    trimmed = []
    for turn in history[-6:]:
        role = turn.get("role")
        text = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and text:
            trimmed.append({"role": role, "content": text[:600]})
    return trimmed
