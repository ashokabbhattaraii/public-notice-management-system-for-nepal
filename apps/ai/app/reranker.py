"""Cross-encoder reranking for retrieved notices and document chunks.

Bi-encoder retrieval (the e5 embeddings in `embeddings.py`) scores a query and
a passage independently, so it can only measure coarse topical similarity — it
routinely ranks a passage *about* the right subject above the one that actually
answers the question. A cross-encoder reads query and passage together and is
markedly better at that final ordering, which is why it is worth the extra
forward pass over a shortlist.

The model is optional: if it can't be loaded (not installed, no disk space, no
network on first run), retrieval falls back to the fused retrieval order rather
than failing the request.
"""

import time
from typing import Optional, Sequence

from app import config
from app.logger import get_logger

logger = get_logger(__name__)

_model: Optional[object] = None
_unavailable = False


def _load_model():
    global _model, _unavailable
    if _model is not None or _unavailable:
        return _model

    try:
        from sentence_transformers import CrossEncoder

        logger.info("Loading reranker model '%s'...", config.RERANKER_MODEL)
        t0 = time.perf_counter()
        _model = CrossEncoder(config.RERANKER_MODEL, max_length=512)
        logger.info(
            "Reranker loaded in %.1fs", time.perf_counter() - t0
        )
    except Exception:
        _unavailable = True
        logger.exception(
            "Could not load reranker '%s'; falling back to retrieval order "
            "(set RERANK_ENABLED=false to silence this)",
            config.RERANKER_MODEL,
        )
    return _model


def is_available() -> bool:
    return config.RERANK_ENABLED and _load_model() is not None


def warm_up() -> None:
    """Load the model ahead of first use so no user request pays the cost."""
    if config.RERANK_ENABLED:
        _load_model()


def rerank(
    query: str,
    passages: Sequence[str],
    top_k: Optional[int] = None,
) -> list[tuple[int, float]]:
    """Score `passages` against `query`.

    Returns (original_index, score) pairs sorted best-first, truncated to
    `top_k`. On any failure returns the input order with neutral scores, so
    callers can treat the result as authoritative either way.
    """
    limit = top_k if top_k is not None else len(passages)
    identity = [(i, 0.0) for i in range(len(passages))][:limit]

    if not passages or not config.RERANK_ENABLED:
        return identity

    model = _load_model()
    if model is None:
        return identity

    try:
        t0 = time.perf_counter()
        scores = model.predict(
            [(query, passage) for passage in passages],
            batch_size=config.RERANK_BATCH_SIZE,
            show_progress_bar=False,
        )
        ranked = sorted(
            ((i, float(score)) for i, score in enumerate(scores)),
            key=lambda pair: pair[1],
            reverse=True,
        )
        logger.info(
            "Reranked %d passages in %.0fms (top score %.3f)",
            len(passages),
            (time.perf_counter() - t0) * 1000,
            ranked[0][1] if ranked else 0.0,
        )
        return ranked[:limit]
    except Exception:
        logger.exception("Reranking failed; keeping retrieval order")
        return identity


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Sequence[str]],
    weights: Optional[Sequence[float]] = None,
    k: int = 60,
) -> dict[str, float]:
    """Fuse several ranked ID lists into one score map via RRF.

    RRF combines rankings without needing their scores to be comparable — the
    keyword leg's lexical score and the vector leg's cosine similarity live on
    completely different scales, so averaging them directly would let whichever
    scale happens to be larger dominate. `k` damps the influence of top ranks;
    60 is the standard value from the original RRF paper.
    """
    if weights is None:
        weights = [1.0] * len(ranked_lists)

    scores: dict[str, float] = {}
    for ranked, weight in zip(ranked_lists, weights):
        for rank, item_id in enumerate(ranked):
            scores[item_id] = scores.get(item_id, 0.0) + weight / (k + rank + 1)
    return scores
