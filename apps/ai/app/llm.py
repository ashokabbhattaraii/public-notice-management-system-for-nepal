import asyncio
import json
import random
import re
import time

import httpx
import numpy as np

from app import config
from app import embeddings
from app.logger import get_logger

logger = get_logger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

FALLBACK_SENTENCES = 4
_MIN_SENTENCE_CHARS = 25

SYSTEM_PROMPT = """You are Suchana AI, an assistant that answers questions about Nepalese public notices and government documents using ONLY the provided context.

Rules:
- Ground every claim in the context. Never invent facts, numbers, dates, or names.
- Cite sources inline with bracketed numbers matching the context blocks, e.g. [1] or [2][3]. Cite after the specific claim, not in a list at the end.
- Format the answer in Markdown. Use short paragraphs; use bullet points for enumerations (requirements, steps, allocations) and **bold** for key figures, dates, and names.
- Use a Markdown table when the answer covers several items sharing the same fields — schedules, fee or salary scales, per-category eligibility, comparisons, deadline lists. Only when there are at least two rows and two columns; a single fact never gets a table.
- Match the answer length to the question: a factual lookup gets 1-2 sentences; "explain"/"summarize" questions get a structured answer, still under ~200 words.
- Answer in the same language the question is asked in, unless instructed otherwise.
- IMPORTANT: When the source context is in Nepali (Devanagari) but the question is in English, TRANSLATE and explain the content fully in English. Do NOT leave raw Nepali/Devanagari text inline. You may include the original Nepali term in parentheses for proper nouns or official titles, but the main answer must be fluent in the question's language.
- Similarly, if the question is in Nepali but context is in English, answer in Nepali.
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

_STYLE_HINTS = [
    "Keep this reply especially brief — under 15 words.",
    "Open with something other than a greeting word this time.",
    "Use a slightly playful tone.",
    "Use a calm, professional tone.",
    "Lead with an offer to help.",
    "Reply as if continuing a friendly conversation.",
]

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

_CANNED_GREETINGS_EN = [
    "Hello! I'm Suchana AI. Ask me anything about the uploaded notices or documents.",
    "Hi there! How can I help you today? You can ask me about any uploaded document.",
    "Hey! I'm here to help you find information in your public notices — what would you like to know?",
]
_CANNED_GREETINGS_NE = [
    "नमस्ते! म सूचना AI हुँ। अपलोड गरिएका सूचना वा कागजातहरूबारे केही सोध्नुहोस्।",
    "नमस्कार! म तपाईंलाई कसरी सहयोग गर्न सक्छु? कुनै पनि कागजातबारे सोध्न सक्नुहुन्छ।",
]

# Greetings, thanks, farewells and filler — English, Devanagari and romanized
# Nepali, plus the textspeak people actually type.
_SMALL_TALK_WORDS = {
    "hi", "hii", "hiii", "hello", "helo", "hellow", "hey", "heya", "yo", "hola",
    "greetings", "sup", "wassup", "howdy", "morning", "afternoon", "evening",
    "night", "good", "gud", "mrng", "gm", "gn",
    "thanks", "thank", "thankyou", "thx", "tnx", "ty", "cheers",
    "bye", "goodbye", "byee", "cya", "later",
    "ok", "okay", "okey", "k", "kk", "cool", "nice", "great", "awesome", "wow",
    "please", "plz", "sorry", "yes", "no", "yeah", "yep", "nope",
    "how", "are", "you", "u", "r", "there", "doing", "up",
    "a", "lot", "much", "very", "so", "again", "welcome", "fine", "help",
    "friend", "buddy", "i", "im", "am",
    "namaste", "namaskar", "dhanyabad", "dhanyawad", "kasto", "cha", "xa",
    "chha", "sanchai", "hajur", "ji", "sir", "madam", "maam", "dai", "didi",
    "नमस्ते", "नमस्कार", "धन्यवाद", "कस्तो", "छ", "हजुर", "ठिक", "है",
}

# Whole-message patterns that are about the assistant rather than any content.
_SMALL_TALK_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"^(who|what)\s+(are|r)\s+(you|u)\b",
        r"^what\s+(can|do)\s+(you|u)\s+(do|can)\b",
        r"^(can|what)\s+you\s+help\b",
        r"^how\s+(are|r)\s+(you|u)\b",
        r"^(tapai|timi)\s+ko\s+ho",
        r"^ke\s+(garna|gar)\s+sak",
    )
]

_SMALL_TALK_MAX_WORDS = 5


def is_small_talk(message: str) -> bool:
    """True for greetings/thanks/pleasantries that carry no content question.

    Deterministic and free — it runs before any retrieval so "Hello" gets a
    hello back instead of "the content doesn't contain the answer". A message
    is only small talk when EVERY word is pleasantry vocabulary, so
    "hello, what is the deadline?" still goes to the normal answer path.
    """
    text = (message or "").strip()
    if not text:
        return False
    if any(p.search(text) for p in _SMALL_TALK_PATTERNS):
        return True

    words = [w for w in re.split(r"[^\wऀ-ॿ]+", text.lower()) if w]
    if not words or len(words) > _SMALL_TALK_MAX_WORDS:
        return False
    return all(w in _SMALL_TALK_WORDS for w in words)


async def generate_answer(
    question: str, context_chunks: list[dict], language: str = "en"
) -> str:
    if not any_provider_configured():
        logger.info("No LLM key configured; using extractive fallback")
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

    answer = await _llm_chat(messages, max_tokens=1024, temperature=0.7)
    if answer is None:
        return _extractive_fallback(question, context_chunks)
    return answer


async def generate_chat(
    message: str, language: str = "en", context_hint: str | None = None
) -> str:
    """Conversational reply. `context_hint` names what the user is looking at
    (e.g. a notice title) so the invitation to ask something fits the screen
    they're on."""
    if any_provider_configured():
        hint = (
            f"\n\nThe user is currently viewing {context_hint}. If you invite a "
            "question, make it about that."
            if context_hint
            else ""
        )
        messages = [
            {
                "role": "system",
                "content": f"{CHAT_SYSTEM_PROMPT}{hint}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": message},
        ]
        answer = await _llm_chat(messages, max_tokens=150, temperature=0.9)
        if answer:
            return answer

    canned = _CANNED_GREETINGS_NE if language == "ne" else _CANNED_GREETINGS_EN
    return random.choice(canned)


async def generate_no_results(question: str, language: str = "en") -> str:
    if any_provider_configured():
        messages = [
            {
                "role": "system",
                "content": f"{NO_RESULTS_PROMPT}\n\n{random.choice(_STYLE_HINTS)}",
            },
            {"role": "user", "content": question},
        ]
        answer = await _llm_chat(messages, max_tokens=150, temperature=0.9)
        if answer:
            return answer

    return random.choice(_CANNED_NO_RESULTS)


_INTENT_PROMPT = """Classify the user's message for a document Q&A assistant on a Nepalese public notice portal. Messages may be in English, Nepali, romanized Nepali, or sloppy textspeak ("gud mrng ji", "helo kasto xa").

Reply with exactly one word:
- "chat" — greeting, small talk, thanks, goodbye, or a question about the assistant itself
- "docs" — asking about the content of documents, notices, deadlines, policies, or any information lookup"""


async def classify_intent(message: str) -> str | None:
    if not any_provider_configured():
        return None
    result = await _llm_chat(
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


# ---------------------------------------------------------------------------
# Unified LLM dispatch: Gemini primary, Groq fallback
# ---------------------------------------------------------------------------


# One entry per supported provider. Keyed by the stable id used in
# config.LLM_PROVIDER_PRIORITY and in the admin settings panel, so the
# ordering an admin drags into place maps straight onto dispatch order here.
PROVIDERS: tuple[str, ...] = ("gemini", "groq", "opencode")

PROVIDER_LABELS: dict[str, str] = {
    "gemini": "Google Gemini",
    "groq": "Groq",
    "opencode": "OpenCode Zen",
}


def provider_api_key(provider: str) -> str:
    return {
        "gemini": config.GEMINI_API_KEY,
        "groq": config.GROQ_API_KEY,
        "opencode": config.OPENCODE_ZEN_API_KEY,
    }.get(provider, "")


def provider_model(provider: str) -> str:
    return {
        "gemini": config.GEMINI_MODEL,
        "groq": config.GROQ_MODEL,
        "opencode": config.OPENCODE_ZEN_MODEL,
    }.get(provider, "")


def _provider_call(provider: str):
    return {
        "gemini": _gemini_chat,
        "groq": _groq_chat,
        "opencode": _opencode_chat,
    }.get(provider)


def any_provider_configured() -> bool:
    """True when at least one enabled provider has an API key.

    Callers use this to decide between an LLM path and a non-LLM fallback
    (extractive answers, canned greetings). Checking the whole active order —
    rather than naming two providers inline, as this module used to — means a
    deployment configured with only the third-tier provider still gets real
    LLM answers instead of silently degrading to extractive output.
    """
    return any(provider_api_key(p) for p in active_provider_order())


def active_provider_order() -> list[str]:
    """Configured priority, filtered to providers that actually exist.

    An unknown id (typo in env, or a provider removed in a later version but
    still listed in a stale DB setting) is dropped rather than crashing
    dispatch. If that leaves nothing usable, fall back to the built-in order
    so a bad setting can never silently disable every LLM.
    """
    ordered = [p for p in config.LLM_PROVIDER_PRIORITY if p in PROVIDERS]
    return ordered or list(PROVIDERS)


async def _llm_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Try each configured provider in admin-defined priority order — the
    first non-empty answer wins. gpt-oss/deepseek-style reasoning models can
    return HTTP 200 with empty `content` if max_tokens is exhausted
    mid-reasoning, which must count as a failure here, not a blank
    "successful" answer.

    Providers with no API key are skipped silently (not an error — that's
    just an unconfigured tier), and a provider left out of the priority list
    is never called at all.
    """
    order = active_provider_order()
    attempted: list[str] = []

    for provider in order:
        if not provider_api_key(provider):
            continue
        call = _provider_call(provider)
        if call is None:
            continue

        attempted.append(provider)
        result = await call(messages, max_tokens, temperature)
        if result:
            return result

        remaining = [
            p for p in order[order.index(provider) + 1 :]
            if provider_api_key(p)
        ]
        logger.warning(
            "%s failed or returned empty; %s",
            PROVIDER_LABELS.get(provider, provider),
            f"falling back to {PROVIDER_LABELS.get(remaining[0], remaining[0])}"
            if remaining
            else "no fallback providers remain",
        )

    if not attempted:
        logger.info("No LLM provider is configured (priority=%s)", ",".join(order))
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
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(url, json=payload)
        except httpx.HTTPError as e:
            logger.error("Gemini request failed (attempt %d): %s", attempt + 1, e)
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
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as e:
            logger.error("Groq request failed (attempt %d): %s", attempt + 1, e)
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
# OpenCode Zen provider (free-tier fallback, tried after Gemini + Groq)
# ---------------------------------------------------------------------------


async def _opencode_chat(
    messages: list[dict], max_tokens: int, temperature: float
) -> str | None:
    """Call OpenCode Zen (OpenAI-compatible). Returns None on any failure."""
    payload = {
        "model": config.OPENCODE_ZEN_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    config.OPENCODE_ZEN_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {config.OPENCODE_ZEN_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as e:
            logger.error("OpenCode Zen request failed (attempt %d): %s", attempt + 1, e)
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

        logger.debug("OpenCode Zen answer generated with model=%s", config.OPENCODE_ZEN_MODEL)
        return _clean_answer(content)

    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clean_answer(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    return text.strip()


# ---------------------------------------------------------------------------
# Provider health probes (admin panel)
# ---------------------------------------------------------------------------

# Deliberately separate from the _*_chat functions above: those retry, rotate
# keys and swallow the HTTP status to return a clean str|None for callers. A
# health check wants the opposite — one attempt, no retry, and the actual
# failure reason surfaced so an admin can tell "bad key" (401) apart from
# "rate limited" (429) or "wrong model name" (404).
_HEALTH_TIMEOUT_SECONDS = 12.0
_HEALTH_MESSAGES = [{"role": "user", "content": "ping"}]


def _describe_http_failure(status: int, body: str) -> str:
    if status in (401, 403):
        return "Authentication failed — the API key is invalid or revoked."
    if status == 404:
        return "Model not found — check the model name for this provider."
    if status == 429:
        return "Rate limited — the key works but the quota is currently exhausted."
    if status >= 500:
        return f"Provider is having problems (HTTP {status})."
    return f"HTTP {status}: {body[:160]}"


async def _probe_gemini() -> tuple[bool, str | None]:
    url = GEMINI_API_URL.format(model=config.GEMINI_MODEL) + f"?key={config.GEMINI_API_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": "ping"}]}],
        "generationConfig": {"maxOutputTokens": 8, "temperature": 0.0},
    }
    async with httpx.AsyncClient(timeout=_HEALTH_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload)
    if response.status_code != 200:
        return False, _describe_http_failure(response.status_code, response.text)
    return True, None


async def _probe_openai_compatible(url: str, api_key: str, model: str) -> tuple[bool, str | None]:
    """Shared probe for Groq and OpenCode Zen — both speak the OpenAI schema."""
    payload = {
        "model": model,
        "messages": _HEALTH_MESSAGES,
        "max_tokens": 8,
        "temperature": 0.0,
    }
    async with httpx.AsyncClient(timeout=_HEALTH_TIMEOUT_SECONDS) as client:
        response = await client.post(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code != 200:
        return False, _describe_http_failure(response.status_code, response.text)
    return True, None


async def _probe_provider(provider: str) -> tuple[bool, str | None]:
    if provider == "gemini":
        return await _probe_gemini()
    if provider == "groq":
        return await _probe_openai_compatible(GROQ_API_URL, config.GROQ_API_KEY, config.GROQ_MODEL)
    if provider == "opencode":
        return await _probe_openai_compatible(
            config.OPENCODE_ZEN_BASE_URL, config.OPENCODE_ZEN_API_KEY, config.OPENCODE_ZEN_MODEL
        )
    return False, "Unknown provider."


async def health_snapshot() -> dict:
    """Live status of every provider, in the order dispatch would try them.

    Probes run concurrently — three sequential round-trips to external APIs
    would make the admin panel feel broken on a slow provider. Unconfigured
    providers are reported without a network call at all, so a partially
    configured install still returns fast.
    """
    order = active_provider_order()
    disabled = [p for p in PROVIDERS if p not in order]

    async def one(provider: str) -> dict:
        base = {
            "provider": provider,
            "label": PROVIDER_LABELS.get(provider, provider),
            "model": provider_model(provider),
            "enabled": True,
            "configured": bool(provider_api_key(provider)),
        }
        if not base["configured"]:
            return {**base, "ok": False, "latencyMs": None, "error": "No API key configured."}

        started = time.perf_counter()
        try:
            ok, error = await _probe_provider(provider)
        except httpx.HTTPError as e:
            return {
                **base,
                "ok": False,
                "latencyMs": round((time.perf_counter() - started) * 1000),
                "error": f"Could not reach the provider: {e}",
            }
        except Exception as e:  # never let one provider's failure break the panel
            logger.exception("Health probe crashed for %s", provider)
            return {
                **base,
                "ok": False,
                "latencyMs": round((time.perf_counter() - started) * 1000),
                "error": f"Probe failed: {e}",
            }
        return {
            **base,
            "ok": ok,
            "latencyMs": round((time.perf_counter() - started) * 1000),
            "error": error,
        }

    results = list(await asyncio.gather(*(one(p) for p in order)))

    # Providers the admin has switched off still appear, so the panel shows
    # the full picture rather than silently hiding a key that exists but is
    # deliberately never used.
    for provider in disabled:
        results.append(
            {
                "provider": provider,
                "label": PROVIDER_LABELS.get(provider, provider),
                "model": provider_model(provider),
                "enabled": False,
                "configured": bool(provider_api_key(provider)),
                "ok": False,
                "latencyMs": None,
                "error": "Disabled — not in the active provider priority.",
            }
        )

    active = next((r for r in results if r["enabled"] and r["ok"]), None)
    return {
        "priority": order,
        "providers": results,
        # Which provider a real request would actually land on right now.
        "activeProvider": active["provider"] if active else None,
        "healthy": active is not None,
    }


def _split_sentences(text: str) -> list[str]:
    """Splits `text` into standalone, rankable units for the extractive
    fallback. Processes line-by-line rather than collapsing the whole block
    first: a "- label: value" fact line has no terminal period, so joining it
    onto neighbouring lines before splitting on punctuation used to glue
    several unrelated facts into one unreadable run-on sentence (only
    breaking wherever the *next* period happened to land). Each bullet line
    is already one atomic fact and is kept as-is; section headers (e.g.
    "NOTICE FACTS:") aren't answerable content and are dropped; everything
    else is prose and gets real sentence splitting.
    """
    units: list[str] = []
    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            continue

        stripped_bullet = re.sub(r"^[-•●▪]\s*", "", line)
        if stripped_bullet != line:
            if len(stripped_bullet) >= _MIN_SENTENCE_CHARS:
                units.append(stripped_bullet)
            continue

        # A bare section header ("NOTICE FACTS:", "AI SUMMARY (Nepali):",
        # "ATTACHED FILES (1) — ... notice page:") carries no fact of its
        # own — the lines under it do.
        if line.endswith(":"):
            continue

        for sentence in re.split(r"(?<=[.!?।])\s+", line):
            sentence = sentence.strip()
            if len(sentence) >= _MIN_SENTENCE_CHARS and not sentence[:1].islower():
                units.append(sentence)

    return units


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

        # Embeddings are normalized, so `scores` are cosine similarities. When
        # even the best-matching sentence falls short of the same bar used for
        # retrieval, nothing in this document actually answers the question —
        # forcing out the top-K anyway (e.g. file size, unrelated notice
        # titles) reads as an answer when it isn't one.
        if scores[ranked[0]] < config.RAG_SCORE_THRESHOLD:
            return "The provided documents do not contain this information."

        picked: list[int] = []
        seen: set[str] = set()
        for i in ranked:
            if scores[i] < config.RAG_SCORE_THRESHOLD:
                break
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

_ANALYZE_PROMPT = """You analyze a single Nepalese government/public notice or news item and produce a JSON summary for display on a notice detail page.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{"summary": "2-3 sentence plain-language summary in English", "summary_ne": "Same summary translated to Nepali (देवनागरी script)", "key_facts": ["short fact 1", "short fact 2", "..."], "tags": ["topic1", "topic2", "..."], "category": "<one of: NOTICE, NEWS, PRESS_RELEASE, CIRCULAR, TENDER, VACANCY, JOB, INTERNSHIP, OTHER>", "category_confidence": <0.0-1.0 float>}

Rules:
- summary: plain language English, no jargon, captures what the notice actually says and who it affects. If the content is in Nepali, translate and summarize in English.
- summary_ne: the same summary written in Nepali (देवनागरी). If the content is already in Nepali, summarize directly. If in English, translate to Nepali.
- key_facts: 3-6 short, concrete, standalone facts (dates, eligibility, amounts, deadlines, affected wards/groups, procedures) — each under ~12 words. Omit facts not actually stated in the content.
- tags: 2-5 short topical keywords (organization name, subject area, affected group) useful for filtering — not generic words like "notice" or "government".
- category: classify the notice type. JOB for job openings/career postings; INTERNSHIP for internship/trainee programs; VACANCY for generic openings with no clear job-vs-intern nature; CIRCULAR for internal directives; TENDER for procurement; PRESS_RELEASE for official statements; NEWS for general news; NOTICE for general public notices.
- category_confidence: how confident you are in the classification (0.0-1.0).
- Ground everything in the provided content. Never invent facts."""

_ASK_PROMPT = """You are Suchana AI, answering a question about ONE specific Nepalese public notice/news item using ONLY the context below.

The context may contain several labelled sections — NOTICE FACTS, STRUCTURED METADATA, ATTACHED FILES, AI SUMMARY, KEY POINTS and NOTICE TEXT. Every section is factual information about this same notice; use whichever ones answer the question.

Rules:
- Ground every claim in the context. Never invent facts, dates, or numbers not present.
- Questions about attachments, PDFs, documents or downloads are answered from the ATTACHED FILES section — list the file names. Only say there is no attachment when that section says "none".
- NOTICE TEXT is machine-extracted and is sometimes garbled or empty (scanned pages, legacy Nepali fonts). When it is unusable, answer from the summary, key points and metadata instead. Never describe encoding or formatting problems to the user, and never call the notice unreadable while other sections still have content.
- Answer in Markdown, short paragraphs or bullet points, under ~150 words.
- Use a Markdown table when the answer covers several items sharing the same fields (dates, fees, eligibility per category, a list of attachments with their types). At least two rows and two columns, otherwise prose or bullets.
- Match the shape of the answer to the question: a yes/no or lookup question gets a direct short answer, an "explain"/"summarize" question gets structure.
- Answer in the same language the question is asked in. If the notice content is in Nepali but the question is in English, translate/explain in English.
- If none of the sections contain the answer, say so plainly in one sentence — do not guess.
- Answer directly, no filler like "Based on the notice...\""""


async def analyze_notice(title: str, content: str) -> dict | None:
    if not any_provider_configured():
        return None

    trimmed_content = content[:8000]

    messages = [
        {"role": "system", "content": _ANALYZE_PROMPT},
        {"role": "user", "content": f"Title: {title}\n\nContent:\n{trimmed_content}"},
    ]

    raw = await _llm_chat(messages, max_tokens=600, temperature=0.2)
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
        "NOTICE", "NEWS", "PRESS_RELEASE", "CIRCULAR", "TENDER", "VACANCY",
        "JOB", "INTERNSHIP", "OTHER"
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


async def answer_notice_question(title: str, content: str, question: str) -> str:
    """`content` is the assembled context block built by the API layer — it may
    hold labelled sections (facts, attachments, summary, key points, text)."""
    if not any_provider_configured():
        return _extractive_fallback(question, [{"content": content, "title": title}])

    # Generous cap: the block leads with the reliable sections, so a long
    # extracted body is what gets cut, not the summary or attachment list.
    trimmed_content = content[:12000]
    messages = [
        {"role": "system", "content": _ASK_PROMPT},
        {
            "role": "user",
            "content": f"Notice title: {title}\n\nContext:\n{trimmed_content}\n\nQuestion: {question}",
        },
    ]

    answer = await _llm_chat(messages, max_tokens=500, temperature=0.4)
    if answer is None:
        return _extractive_fallback(question, [{"content": content, "title": title}])
    return answer
