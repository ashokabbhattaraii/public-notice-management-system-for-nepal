#!/usr/bin/env python3
"""CPU-only benchmark of reranking backends for the notice chatbot.

Measures load time, warm per-query rerank latency (p50/p95), process peak RSS,
and ranking quality (Hit@k, MRR, NDCG@10) on the labeled task set
`rerank_tasks.json`, anchored to verbatim real-corpus passages from
`corpus_snapshot.json`.

Quality test: for each task the target passage is embedded in a candidate
list of 19 real corpus distractors at a fixed *degraded* retrieval rank
(index 6 — the "found by embedding but not #1" case reranking exists to fix);
the backend must promote it. Candidate lists are seeded deterministically, so
every backend grades identical inputs.

Each backend runs in its own subprocess so peak RSS is attributable to that
backend alone (the Oracle-free-tier RAM question must not charge one backend
with another's memory). All inference is CPU-only.

Usage:
    python3 eval/bench_rerankers.py --out /tmp/bench.json     # all backends
    python3 eval/bench_rerankers.py --backends onnx --out x.json
    python3 eval/bench_rerankers.py --backend none            # quick smoke

Backends: none (identity — no-rerank baseline), float (CrossEncoder,
RERANKER_MODEL), onnx (int8 onnx of the same model), mmarco (MiniLM
cross-encoder), llm (Groq LLM rerank, needs GROQ_API_KEY).
"""

import argparse
import json
import math
import os
import random
import re
import resource
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TASKS_PATH = ROOT / "rerank_tasks.json"
CORPUS_PATH = ROOT / "corpus_snapshot.json"
ONNX_DIR = ROOT.parent / "models" / "bge-reranker-v2-m3-int8"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

NUM_CANDIDATES = 20
HIDDEN_RANK = 6

BACKENDS = ("llm", "mmarco", "onnx", "ret")


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


def load_tasks() -> list[dict]:
    return json.loads(TASKS_PATH.read_text())["tasks"]


def load_corpus() -> list[str]:
    corpus = json.loads(CORPUS_PATH.read_text())
    return [(o.get("title") or "") + "\n" + (o.get("summary") or "") for o in corpus]


def build_candidate_sets() -> list[dict]:
    tasks = load_tasks()
    corpus = load_corpus()
    rng = random.Random(2026)
    cand_sets = []
    for task in tasks:
        target = task["target"]
        rest = [p for p in corpus if p != target]
        rng.shuffle(rest)
        distractors = rest[: NUM_CANDIDATES - 1]
        if len(distractors) < NUM_CANDIDATES - 1:
            raise SystemExit(f"corpus too small for task {task['id']}")
        passages = distractors.copy()
        passages.insert(HIDDEN_RANK, target)
        cand_sets.append(
            {
                "id": task["id"],
                "lang": task["lang"],
                "query": task["query"],
                "target_index": HIDDEN_RANK,
                "passages": passages,
            }
        )
    return cand_sets


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------

_crs: dict[str, object] = {}


def _cross_encoder(name: str):
    if name not in _crs:
        from sentence_transformers import CrossEncoder

        _crs[name] = CrossEncoder(name, max_length=512)
    return _crs[name]


def score_ret(cand: dict) -> tuple[list[float], dict]:
    model = _cross_encoder(os.environ.get("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3"))
    scores = model.predict(
        [(cand["query"], p) for p in cand["passages"]],
        batch_size=int(os.environ.get("RERANK_BATCH_SIZE", "16")),
        show_progress_bar=False,
    )
    return [float(s) for s in scores], {}


def score_mmarco(cand: dict) -> tuple[list[float], dict]:
    model = _cross_encoder("cross-encoder/mmarco-mMiniLMv2-L12-H384-v1")
    scores = model.predict(
        [(cand["query"], p) for p in cand["passages"]],
        batch_size=int(os.environ.get("RERANK_BATCH_SIZE", "16")),
        show_progress_bar=False,
    )
    return [float(s) for s in scores], {}


_onnx = {"session": None, "tok": None}


def _load_onnx():
    if _onnx["session"] is not None:
        return
    import onnxruntime as ort

    from transformers import AutoTokenizer

    _onnx["tok"] = AutoTokenizer.from_pretrained(str(ONNX_DIR))
    _onnx["session"] = ort.InferenceSession(
        str(ONNX_DIR / "model_int8.onnx"),
        providers=["CPUExecutionProvider"],
    )


def score_onnx(cand: dict) -> tuple[list[float], dict]:
    _load_onnx()
    encoded = _onnx["tok"](
        [cand["query"]] * len(cand["passages"]),
        cand["passages"],
        padding=True,
        max_length=512,
        truncation=True,
        return_tensors="np",
    )
    logits = _onnx["session"].run(
        ["logits"],
        {
            "input_ids": encoded["input_ids"],
            "attention_mask": encoded["attention_mask"],
        },
    )[0].ravel()
    return [float(x) for x in logits], {}


_LLM_SYSTEM = (
    "You are a search relevance judge for a Nepalese public-notice portal. "
    "The question and passages may be in English, Nepali (Devanagari), or "
    "romanized Nepali. Rank the passages by how well each one answers the question."
)

_JSON_ARRAY = re.compile(r"\[[\d,\s]+\]")


def _llm_scores(text: str, total: int) -> list[float] | None:
    m = _JSON_ARRAY.search(text or "")
    if not m:
        return None
    try:
        indices = json.loads(m.group())
    except (ValueError, TypeError):
        return None
    scores = [0.0] * total
    for rank, idx in enumerate(indices):
        if isinstance(idx, int) and 0 <= idx < total:
            scores[idx] = total - rank
    return scores


def score_llm(cand: dict) -> tuple[list[float], dict]:
    from app import config

    if not config.GROQ_API_KEY:
        return [0.0] * len(cand["passages"]), {"note": "no GROQ_API_KEY"}
    blocks = "\n".join(f"[{i}] {p[:280]}" for i, p in enumerate(cand["passages"]))
    prompt = (
        f"Question: {cand['query']}\n\nCandidate passages:\n{blocks}\n\n"
        "Reply with ONLY a JSON array of integers: the passage indices ordered "
        "from most to least relevant, e.g. [2, 0, 5, ...]. No prose."
    )
    payload = {
        "model": config.GROQ_MODEL,
        "max_tokens": 256,
        "temperature": 0.0,
        "messages": [
            {"role": "system", "content": _LLM_SYSTEM},
            {"role": "user", "content": prompt},
        ],
    }
    import httpx

    resp = httpx.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
        json=payload,
        timeout=45.0,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]
    scores = _llm_scores(text, len(cand["passages"]))
    if scores is None:
        return [0.0] * len(cand["passages"]), {"note": "unparseable_llm_output"}
    return scores, {}


SCORERS = {
    "none": lambda c: ([0.0] * len(c["passages"]), {}),
    "ret": score_ret,
    "mmarco": score_mmarco,
    "onnx": score_onnx,
    "llm": score_llm,
}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def _ranked(scores: list[float]) -> list[int]:
    return [i for i, _ in sorted(enumerate(scores), key=lambda p: (-p[1], p[0]))]


def _ndcg(r: float) -> float:
    # single relevant item; NDCG@k = 1/log2(r+1) truncated at k
    return 1.0 / math.log2(r + 1.0)


def compute_metrics(cand: dict, scores: list[float]) -> dict:
    ranked = _ranked(scores)
    pos = ranked.index(cand["target_index"]) if cand["target_index"] in ranked else None
    return {
        "hit_at_1": int(pos == 0),
        "hit_at_3": int(pos is not None and pos < 3),
        "hit_at_5": int(pos is not None and pos < 5),
        "mrr": (1.0 / (pos + 1)) if pos is not None else 0.0,
        "ndcg@10": _ndcg(pos + 1) if (pos is not None and pos < 10) else 0.0,
    }


def _pctl(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, int(round((len(s) - 1) * q / 100)))
    return s[idx]


def _rss_mb() -> float:
    try:
        ru = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        divisor = 1024 * 1024 if sys.platform == "darwin" else 1024
        return round(ru / divisor, 1)
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_one(backend: str, cand_sets: list[dict]) -> dict:
    scorer = SCORERS[backend]

    t_load = time.perf_counter()
    if backend in ("ret", "mmarco"):
        _cross_encoder(
            os.environ.get("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
            if backend == "ret"
            else "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
        )
    elif backend == "onnx":
        _load_onnx()
    load_s = time.perf_counter() - t_load

    lat_ms = []
    agg = {"hit_at_1": 0, "hit_at_3": 0, "hit_at_5": 0, "mrr": 0.0, "ndcg@10": 0.0}
    by_lang: dict[str, dict] = {}
    per_task = []

    for cand in cand_sets:
        t0 = time.perf_counter()
        scores, extra = scorer(cand)
        ms = (time.perf_counter() - t0) * 1000.0
        lat_ms.append(ms)
        m = compute_metrics(cand, scores)
        for k in ("hit_at_1", "hit_at_3", "hit_at_5", "mrr", "ndcg@10"):
            agg[k] += m[k]
        bucket = by_lang.setdefault(cand["lang"], {"n": 0, "hit_at_1": 0, "hit_at_3": 0, "mrr": 0.0})
        bucket["n"] += 1
        bucket["hit_at_1"] += m["hit_at_1"]
        bucket["hit_at_3"] += m["hit_at_3"]
        bucket["mrr"] += m["mrr"]
        per_task.append({"id": cand["id"], "lang": cand["lang"], "latency_ms": round(ms, 1), "extra": extra})

    n = len(cand_sets) or 1
    report = {
        "backend": backend,
        "tasks": len(cand_sets),
        "load_s": round(load_s, 2),
        "hit_at_1": round(agg["hit_at_1"] / n, 3),
        "hit_at_3": round(agg["hit_at_3"] / n, 3),
        "hit_at_5": round(agg["hit_at_5"] / n, 3),
        "mrr": round(agg["mrr"] / n, 3),
        "ndcg@10": round(agg["ndcg@10"] / n, 3),
        "by_lang": {
            lang: {
                "n": b["n"],
                "hit_at_1": round(b["hit_at_1"] / b["n"], 3),
                "hit_at_3": round(b["hit_at_3"] / b["n"], 3),
                "mrr": round(b["mrr"] / b["n"], 3),
            }
            for lang, b in by_lang.items()
        },
        "latency_ms": {
            "p50": round(_pctl(lat_ms, 50), 1),
            "p95": round(_pctl(lat_ms, 95), 1),
            "mean": round(statistics.mean(lat_ms), 1) if lat_ms else 0.0,
            "max": round(max(lat_ms), 1) if lat_ms else 0.0,
        },
        "per_task": per_task,
    }
    if backend != "none":
        report["peak_rss_mb"] = _rss_mb()
    return report


def _spawn(backend: str) -> dict:
    """Run one backend in a subprocess for a clean RSS reading."""
    venv_py = ROOT.parent / ".venv" / "bin" / "python"
    python = str(venv_py) if venv_py.exists() else sys.executable
    tmp = ROOT / f".bench-{backend}.tmp.json"
    try:
        code = (
            "import sys, json; "
            f"sys.path.insert(0, {str(ROOT.parent)!r}); "
            "from eval.bench_rerankers import build_candidate_sets, run_one; "
            f"r = run_one({backend!r}, build_candidate_sets()); "
            f"json.dump(r, open({str(tmp)!r}, 'w'), ensure_ascii=False, indent=1)"
        )
        subprocess.run([python, "-c", code], check=True)
        return json.loads(tmp.read_text())
    finally:
        tmp.unlink(missing_ok=True)


def main() -> int:
    if "BACKEND_DIR" in os.environ and os.environ["BACKEND_DIR"]:
        pass
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--backend",
        default="all",
        help="one of none,ret,onnx,mmarco,llm, or 'all' (driver mode, subprocess per backend)",
    )
    parser.add_argument("--out", default=str(ROOT / "bench-results.json"))
    args = parser.parse_args()

    cand_sets = build_candidate_sets()
    results = {}

    if args.backend == "all":
        for backend in ("ret", "onnx", "mmarco", "llm", "none"):
            results[backend] = _spawn(backend)
    else:
        results[args.backend] = run_one(args.backend, cand_sets)

    Path(args.out).write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())