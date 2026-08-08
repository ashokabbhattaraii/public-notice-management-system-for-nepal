"""In-memory ingestion progress registry, keyed by doc_id.

Tracks each document as it moves through extract -> chunk -> embed -> index,
so the API/UI can poll live progress while large documents are processed.
State is process-local; a restart clears it, which is fine because the
authoritative document status lives in the API's database.
"""

import threading
import time
from typing import Optional

# Terminal entries are kept for a while so a final poll can still see them.
_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 200

_lock = threading.Lock()
_progress: dict[str, dict] = {}

STAGES = ("extracting", "chunking", "embedding", "indexing", "done", "failed")

# Portion of the overall progress bar allotted to each stage.
_STAGE_BASE = {
    "extracting": (0, 15),
    "chunking": (15, 25),
    "embedding": (25, 85),
    "indexing": (85, 100),
}


def start(doc_id: str, filename: str) -> None:
    with _lock:
        _evict_locked()
        _progress[doc_id] = {
            "doc_id": doc_id,
            "filename": filename,
            "stage": "extracting",
            "percent": 0,
            "total_chunks": 0,
            "processed_chunks": 0,
            "message": "Extracting text...",
            "error": None,
            "started_at": time.time(),
            "updated_at": time.time(),
        }


def update(
    doc_id: str,
    stage: str,
    message: str = "",
    done: int = 0,
    total: int = 0,
) -> None:
    """Advance a document's progress. done/total are stage-local units
    (e.g. embedded chunks out of total chunks)."""
    with _lock:
        entry = _progress.get(doc_id)
        if entry is None:
            return
        entry["stage"] = stage
        if message:
            entry["message"] = message
        if stage in ("embedding", "indexing") and total:
            entry["total_chunks"] = total
            entry["processed_chunks"] = done
        lo, hi = _STAGE_BASE.get(stage, (0, 0))
        fraction = (done / total) if total else 0.0
        entry["percent"] = round(lo + (hi - lo) * min(fraction, 1.0))
        entry["updated_at"] = time.time()


def finish(doc_id: str, chunk_count: int) -> None:
    with _lock:
        entry = _progress.get(doc_id)
        if entry is None:
            return
        entry.update(
            stage="done",
            percent=100,
            total_chunks=chunk_count,
            processed_chunks=chunk_count,
            message=f"Indexed {chunk_count} chunks",
            updated_at=time.time(),
        )


def fail(doc_id: str, error: str) -> None:
    with _lock:
        entry = _progress.get(doc_id)
        if entry is None:
            return
        entry.update(
            stage="failed",
            message="Processing failed",
            error=error,
            updated_at=time.time(),
        )


def get(doc_id: str) -> Optional[dict]:
    with _lock:
        entry = _progress.get(doc_id)
        return dict(entry) if entry else None


def get_many(doc_ids: list[str]) -> dict[str, Optional[dict]]:
    with _lock:
        return {
            doc_id: dict(_progress[doc_id]) if doc_id in _progress else None
            for doc_id in doc_ids
        }


def clear(doc_id: str) -> None:
    with _lock:
        _progress.pop(doc_id, None)


def _evict_locked() -> None:
    now = time.time()
    stale = [
        k
        for k, v in _progress.items()
        if v["stage"] in ("done", "failed") and now - v["updated_at"] > _TTL_SECONDS
    ]
    for k in stale:
        del _progress[k]
    # Hard cap as a safety net against unbounded growth.
    if len(_progress) > _MAX_ENTRIES:
        oldest = sorted(_progress.items(), key=lambda kv: kv[1]["updated_at"])
        for k, _ in oldest[: len(_progress) - _MAX_ENTRIES]:
            del _progress[k]
