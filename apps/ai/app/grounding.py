"""Post-generation checks that an answer is actually supported by its context.

The prompts instruct the model to ground every claim, but instructions are not
guarantees — and the failure mode that matters most here is specific and
checkable. Users act on the concrete tokens in these answers: a deadline, a
fee, a reference number. A fabricated *number* is far more damaging than
loosely-worded prose, and unlike prose it can be verified mechanically by
checking that it appears in the retrieved context.

This module does not rewrite answers. It reports what it found, so the API can
attach a confidence signal and the UI can show the user when to double-check
against the source.
"""

import re
from typing import Iterable

from app.logger import get_logger

logger = get_logger(__name__)

# Devanagari digits appear throughout Nepali notices and must normalize to
# ASCII before comparison, or every Nepali date reads as unsupported.
_DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Numbers worth verifying: standalone integers/decimals with optional
# thousands separators. Deliberately excludes 1-digit numbers, which are
# usually list markers or ordinary prose ("one of the three offices").
_NUMBER_RE = re.compile(r"\d[\d,.]{1,}\d|\d{2,}")

# Citation markers the answer contract asks for, e.g. [2] or [1][3].
_CITATION_RE = re.compile(r"\[(\d{1,2})\]")

# Numbers inside markdown structure rather than claims (list numbering,
# heading levels) would produce false "unsupported" hits.
_MARKDOWN_NOISE_RE = re.compile(r"^\s*\d+[.)]\s", re.MULTILINE)


def _normalize(text: str) -> str:
    return text.translate(_DEVANAGARI_DIGITS)


def _numbers(text: str) -> list[str]:
    cleaned = _MARKDOWN_NOISE_RE.sub(" ", _normalize(text))
    found = []
    for match in _NUMBER_RE.findall(cleaned):
        # Compare on digits alone so "1,000" in the answer matches "1000" in
        # the source, and "2082." at the end of a sentence matches "2082".
        digits = re.sub(r"[^\d]", "", match)
        if len(digits) >= 2:
            found.append(digits)
    return found


def unsupported_numbers(answer: str, context: str) -> list[str]:
    """Numbers asserted in the answer that appear nowhere in the context."""
    context_digits = set(_numbers(context))
    # Also index the raw digit stream, so a context figure written as
    # "Rs. 1,00,000" (Nepali grouping) still matches "100000" in the answer.
    context_stream = re.sub(r"[^\d]", "", _normalize(context))

    missing = []
    for number in dict.fromkeys(_numbers(answer)):
        if number in context_digits:
            continue
        if number in context_stream:
            continue
        missing.append(number)
    return missing


def citations(answer: str, source_count: int) -> tuple[list[int], list[int]]:
    """Split the answer's citation markers into valid and out-of-range.

    An out-of-range marker ([7] when only 5 sources were supplied) means the
    model invented a source slot, which is a reliable signal that it drifted
    from the provided context.
    """
    valid, invalid = [], []
    for raw in _CITATION_RE.findall(answer):
        number = int(raw)
        if 1 <= number <= source_count:
            if number not in valid:
                valid.append(number)
        elif number not in invalid:
            invalid.append(number)
    return valid, invalid


# Phrases the prompts instruct the model to use when the context falls short.
# Their presence is a *positive* signal — the model correctly declined — so
# such answers are labelled "none" rather than scored as weakly grounded.
_ABSTAIN_MARKERS = (
    "does not contain",
    "doesn't contain",
    "does not mention",
    "doesn't mention",
    "no information",
    "not specified",
    "not stated",
    "couldn't find",
    "could not find",
    "उल्लेख छैन",
    "जानकारी छैन",
    "भेटिएन",
)


def _looks_like_abstention(answer: str) -> bool:
    lowered = answer.lower()
    return any(marker in lowered for marker in _ABSTAIN_MARKERS)


def assess(
    answer: str,
    context: str,
    source_count: int,
    retrieval_scores: Iterable[float] = (),
) -> dict:
    """Grade how well an answer is supported.

    Returns {confidence, unsupported_numbers, citations, invalid_citations}.
    Confidence is deliberately coarse — "high/medium/low" is what a user can
    act on, and a false precision like 0.87 would imply a calibration this
    heuristic does not have.
    """
    if not answer.strip():
        return {
            "confidence": "none",
            "unsupported_numbers": [],
            "citations": [],
            "invalid_citations": [],
        }

    if _looks_like_abstention(answer) and source_count == 0:
        return {
            "confidence": "none",
            "unsupported_numbers": [],
            "citations": [],
            "invalid_citations": [],
        }

    missing = unsupported_numbers(answer, context)
    valid, invalid = citations(answer, source_count)
    scores = [s for s in retrieval_scores if isinstance(s, (int, float))]
    best_score = max(scores) if scores else 0.0

    if missing or invalid:
        confidence = "low"
    elif valid and best_score > 0:
        confidence = "high"
    elif valid or source_count > 0:
        confidence = "medium"
    else:
        confidence = "low"

    if missing:
        logger.warning(
            "Answer contains %d number(s) absent from context: %s",
            len(missing),
            ", ".join(missing[:5]),
        )
    if invalid:
        logger.warning("Answer cites non-existent sources: %s", invalid)

    return {
        "confidence": confidence,
        "unsupported_numbers": missing,
        "citations": valid,
        "invalid_citations": invalid,
    }
