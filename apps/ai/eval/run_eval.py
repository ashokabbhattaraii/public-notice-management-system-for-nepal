#!/usr/bin/env python3
"""Chatbot evaluation harness.

Runs `eval/questions.json` against a live API and reports retrieval hit-rate,
abstention behaviour, grounding, and latency — so a prompt or retrieval change
can be judged by measurement rather than by trying three questions by hand.

Usage:
    python eval/run_eval.py                        # run against localhost:3001
    python eval/run_eval.py --api http://host:3001
    python eval/run_eval.py --save baseline.json   # record a run
    python eval/run_eval.py --compare baseline.json

Requires the API, AI service, Postgres and Qdrant to be running.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent
QUESTIONS_PATH = ROOT / "questions.json"

# Generous: a cold reranker or a slow provider fallback should show up as a
# latency number, not as a timeout that hides the result.
REQUEST_TIMEOUT = httpx.Timeout(180.0, connect=10.0)


class Colors:
    OK = "\033[92m"
    FAIL = "\033[91m"
    WARN = "\033[93m"
    DIM = "\033[2m"
    BOLD = "\033[1m"
    END = "\033[0m"


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def evaluate_case(case: dict, response: dict) -> tuple[bool, list[str]]:
    """Check one response against its expectations. Returns (passed, reasons)."""
    answer = str(response.get("answer") or "")
    sources = response.get("sources") or []
    failures: list[str] = []

    if not answer.strip():
        return False, ["empty answer"]

    expect_sources = case.get("expect_sources")
    if expect_sources is True and not sources:
        failures.append("expected at least one source, got none")
    if expect_sources is False and sources:
        failures.append(f"expected no sources, got {len(sources)}")

    expect_terms = case.get("expect_terms")
    if expect_terms and not contains_any(answer, expect_terms):
        failures.append(f"answer missing all of {expect_terms}")

    forbid_terms = case.get("forbid_terms")
    if forbid_terms and contains_any(answer, forbid_terms):
        hit = [t for t in forbid_terms if t.lower() in answer.lower()]
        failures.append(f"answer contains forbidden {hit}")

    # Grounding: the AI service flags figures it could not find in the context.
    # These are reported as failures because a wrong number is the single most
    # damaging output this system can produce.
    unsupported = response.get("unsupported_numbers") or []
    if unsupported:
        failures.append(f"unsupported figures: {unsupported}")

    invalid = response.get("invalid_citations") or []
    if invalid:
        failures.append(f"citations to non-existent sources: {invalid}")

    return not failures, failures


async def run_case(client: httpx.AsyncClient, api: str, case: dict) -> dict:
    payload = {
        "question": case["question"],
        "history": case.get("history", []),
    }
    if case.get("category"):
        payload["category"] = case["category"]

    started = time.perf_counter()
    try:
        response = await client.post(f"{api}/notices/search", json=payload)
        response.raise_for_status()
        data = response.json()
        error = None
    except Exception as exc:
        data = {}
        error = f"{type(exc).__name__}: {exc}"
    elapsed = time.perf_counter() - started

    passed, failures = (False, [error]) if error else evaluate_case(case, data)

    return {
        "id": case["id"],
        "kind": case["kind"],
        "question": case["question"],
        "passed": passed,
        "failures": failures,
        "latency_s": round(elapsed, 2),
        "source_count": len(data.get("sources") or []),
        "confidence": data.get("confidence"),
        "model_used": data.get("model_used"),
        "answer": str(data.get("answer") or "")[:300],
    }


async def run_all(api: str, cases: list[dict], concurrency: int) -> list[dict]:
    semaphore = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        async def guarded(case: dict) -> dict:
            async with semaphore:
                result = await run_case(client, api, case)
                mark = f"{Colors.OK}PASS{Colors.END}" if result["passed"] else f"{Colors.FAIL}FAIL{Colors.END}"
                print(f"  {mark}  {result['id']:<28} {result['latency_s']:>6.2f}s  "
                      f"{result['source_count']} src")
                for reason in result["failures"]:
                    print(f"        {Colors.DIM}{reason}{Colors.END}")
                return result

        return await asyncio.gather(*(guarded(case) for case in cases))


def summarize(results: list[dict]) -> dict:
    latencies = [r["latency_s"] for r in results]
    by_kind: dict[str, dict] = {}
    for result in results:
        bucket = by_kind.setdefault(result["kind"], {"passed": 0, "total": 0})
        bucket["total"] += 1
        bucket["passed"] += int(result["passed"])

    retrieval_cases = [r for r in results if r["kind"] in ("retrieval", "language", "followup")]

    return {
        "total": len(results),
        "passed": sum(r["passed"] for r in results),
        "pass_rate": round(sum(r["passed"] for r in results) / max(len(results), 1), 3),
        "by_kind": by_kind,
        # The headline retrieval metric: how often a question that should hit
        # the corpus actually retrieved something.
        "retrieval_hit_rate": round(
            sum(1 for r in retrieval_cases if r["source_count"] > 0) / max(len(retrieval_cases), 1),
            3,
        ),
        "latency_p50": round(statistics.median(latencies), 2) if latencies else 0.0,
        "latency_p95": round(
            sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)], 2
        ) if latencies else 0.0,
        "latency_max": round(max(latencies), 2) if latencies else 0.0,
    }


def print_summary(summary: dict) -> None:
    print(f"\n{Colors.BOLD}Summary{Colors.END}")
    print(f"  Passed          {summary['passed']}/{summary['total']}  "
          f"({summary['pass_rate'] * 100:.0f}%)")
    print(f"  Retrieval hits  {summary['retrieval_hit_rate'] * 100:.0f}%")
    print(f"  Latency         p50 {summary['latency_p50']}s | "
          f"p95 {summary['latency_p95']}s | max {summary['latency_max']}s")
    print(f"\n{Colors.BOLD}By category{Colors.END}")
    for kind, stats in sorted(summary["by_kind"].items()):
        rate = stats["passed"] / max(stats["total"], 1)
        color = Colors.OK if rate == 1 else Colors.WARN if rate >= 0.7 else Colors.FAIL
        print(f"  {kind:<12} {color}{stats['passed']}/{stats['total']}{Colors.END}")


def print_comparison(current: dict, baseline: dict) -> None:
    print(f"\n{Colors.BOLD}vs. baseline{Colors.END}")
    for label, key, unit, higher_is_better in [
        ("Pass rate", "pass_rate", "%", True),
        ("Retrieval hits", "retrieval_hit_rate", "%", True),
        ("Latency p50", "latency_p50", "s", False),
        ("Latency p95", "latency_p95", "s", False),
    ]:
        now = current[key]
        before = baseline.get(key, 0)
        delta = now - before
        improved = delta > 0 if higher_is_better else delta < 0
        color = Colors.OK if improved else Colors.FAIL if delta else Colors.DIM
        scale = 100 if unit == "%" else 1
        print(f"  {label:<16} {before * scale:>6.1f}{unit} -> {now * scale:>6.1f}{unit}  "
              f"{color}{delta * scale:+.1f}{unit}{Colors.END}")


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:3001", help="API base URL")
    parser.add_argument("--concurrency", type=int, default=3,
                        help="Parallel requests. Keep low: LLM providers rate-limit.")
    parser.add_argument("--kind", help="Run only cases of this kind")
    parser.add_argument("--save", help="Write results to this JSON file")
    parser.add_argument("--compare", help="Compare against a saved results file")
    args = parser.parse_args()

    spec = json.loads(QUESTIONS_PATH.read_text())
    cases = spec["cases"]
    if args.kind:
        cases = [c for c in cases if c["kind"] == args.kind]
    if not cases:
        print("No cases matched.")
        return 1

    print(f"{Colors.BOLD}Running {len(cases)} cases against {args.api}{Colors.END}\n")
    started = time.perf_counter()
    results = await run_all(args.api, cases, args.concurrency)
    summary = summarize(results)
    summary["duration_s"] = round(time.perf_counter() - started, 1)

    print_summary(summary)

    if args.compare:
        baseline = json.loads(Path(args.compare).read_text())
        print_comparison(summary, baseline["summary"])

    if args.save:
        Path(args.save).write_text(
            json.dumps({"summary": summary, "results": results}, indent=2, ensure_ascii=False)
        )
        print(f"\n{Colors.DIM}Saved to {args.save}{Colors.END}")

    # Non-zero exit on regression makes this usable as a CI gate.
    return 0 if summary["pass_rate"] >= 0.8 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
