"""Detection of conversational messages that should skip retrieval entirely.

"hello" is not a search query. Routing it through retrieval produces the worst
possible reply — "I couldn't find any notices matching that" — so greetings,
thanks and farewells are recognized before any search runs.

The lexical check here is exact and instant. `rag.py` layers an embedding-based
classifier on top of it for free-form phrasing; this module holds the part both
the document RAG and the notice chatbot need.
"""

import re

# Greetings/pleasantries in English, romanized Nepali, and Devanagari.
# Matched only against short messages, so a document question never hits this.
_SMALL_TALK_PHRASES = [
    "hi", "hii", "hey", "hello", "yo", "sup", "wassup", "whats up", "howdy",
    "hi there", "hello there", "hey there", "hi bro", "hello bro",
    "namaste", "namaskar", "नमस्ते", "नमस्कार",
    "good morning", "good afternoon", "good evening", "good day", "good night",
    "how are you", "how r u", "how are u", "how do you do",
    "thank you", "thanks", "thankyou", "thanku", "thx", "ty",
    "thanks a lot", "thank you so much", "thanks so much",
    "dhanyabad", "dhanyawad", "धन्यवाद",
    "ok", "okay", "k", "hmm", "nice", "cool", "great",
    "bye", "goodbye", "bye bye", "see you", "see ya", "tata",
    "who are you", "what are you", "what can you do", "what is your name",
    "kasto cha", "k cha", "sanchai", "namaste kasto cha",
]

_MAX_SMALL_TALK_LEN = 40


def _squeeze(text: str) -> str:
    """Collapse letter runs so 'Helllloooooo' and 'hello' both become 'helo'."""
    return re.sub(r"(.)\1+", r"\1", text)


# Pre-squeezed lookup set; input is squeezed the same way before comparing.
_SMALL_TALK = {_squeeze(p) for p in _SMALL_TALK_PHRASES}


def normalize(question: str) -> str:
    text = question.strip().lower()
    # Drop punctuation/emoji, keep latin words and Devanagari; normalize spaces.
    text = re.sub(r"[^a-zऀ-ॿ\s]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def is_small_talk(question: str) -> bool:
    if len(question) > _MAX_SMALL_TALK_LEN:
        return False
    text = normalize(question)
    return bool(text) and _squeeze(text) in _SMALL_TALK
