"""In-memory scrape-run progress registry, keyed by run_id.

Mirrors app/progress.py's approach for document ingestion, but tracks a
rolling message log rather than a single percent bar — a scrape run's
useful status is "what page/detail fetch is happening right now", not a
smooth percentage. State is process-local; a restart clears it, which is
fine because the authoritative run result lives in the API's database.
"""

import threading
import time
from typing import Optional

_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 200
_MAX_MESSAGES = 200

_lock = threading.Lock()
_runs: dict[str, dict] = {}


def start(run_id: str) -> None:
    with _lock:
        _evict_locked()
        _runs[run_id] = {
            "run_id": run_id,
            "stage": "running",
            "messages": [],
            "error": None,
            "started_at": time.time(),
            "updated_at": time.time(),
        }


def log(run_id: str, message: str) -> None:
    with _lock:
        entry = _runs.get(run_id)
        if entry is None:
            return
        entry["messages"].append({"at": time.time(), "text": message})
        if len(entry["messages"]) > _MAX_MESSAGES:
            entry["messages"] = entry["messages"][-_MAX_MESSAGES:]
        entry["updated_at"] = time.time()


def finish(run_id: str, message: str) -> None:
    with _lock:
        entry = _runs.get(run_id)
        if entry is None:
            return
        entry["stage"] = "done"
        entry["messages"].append({"at": time.time(), "text": message})
        entry["updated_at"] = time.time()


def fail(run_id: str, error: str) -> None:
    with _lock:
        entry = _runs.get(run_id)
        if entry is None:
            return
        entry["stage"] = "failed"
        entry["error"] = error
        entry["messages"].append({"at": time.time(), "text": f"Failed: {error}"})
        entry["updated_at"] = time.time()


def get(run_id: str) -> Optional[dict]:
    with _lock:
        entry = _runs.get(run_id)
        return dict(entry) if entry else None


def clear(run_id: str) -> None:
    with _lock:
        _runs.pop(run_id, None)


def _evict_locked() -> None:
    now = time.time()
    stale = [
        k
        for k, v in _runs.items()
        if v["stage"] in ("done", "failed") and now - v["updated_at"] > _TTL_SECONDS
    ]
    for k in stale:
        del _runs[k]
    if len(_runs) > _MAX_ENTRIES:
        oldest = sorted(_runs.items(), key=lambda kv: kv[1]["updated_at"])
        for k, _ in oldest[: len(_runs) - _MAX_ENTRIES]:
            del _runs[k]
