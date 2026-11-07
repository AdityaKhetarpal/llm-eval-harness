"""
RUNNER: run every case and save a report
----------------------------------------
For each case: get the app's answer (target), run the checks, record pass/fail and timing.
If getting the answer fails (the app crashed, an API timed out, no saved answer), the case FAILS
with the error written down; one broken case never stops the whole run.

The run report (JSON) has a summary (pass rate overall and per tag) and every case's details,
so two runs can be compared later (compare.py).
"""
from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .checks import Context, run_check
from .suite import Case, Suite
from .targets import make_target


def _summary(cases: list[dict]) -> dict:
    total = len(cases)
    passed = sum(c["passed"] for c in cases)
    tags: dict[str, list[int]] = {}
    for c in cases:
        for t in c["tags"]:
            tags.setdefault(t, [0, 0])
            tags[t][0] += c["passed"]
            tags[t][1] += 1
    return {
        "cases": total,
        "passed": passed,
        "failed": total - passed,
        "errors": sum(1 for c in cases if c["error"]),
        "pass_rate": round(passed / total, 4) if total else 0.0,
        "mean_score": round(sum(c["score"] for c in cases) / total, 4) if total else 0.0,
        "by_tag": {t: {"passed": p, "cases": n, "pass_rate": round(p / n, 4)} for t, (p, n) in sorted(tags.items())},
        "seconds": round(sum(c["seconds"] for c in cases), 2),
    }


def run_case(case: Case, answer_fn: Callable[[Case], str], checks: list[dict], ctx: Context) -> dict:
    start = time.perf_counter()
    error, output, results = None, None, []
    try:
        output = answer_fn(case)
    except Exception as e:  # the app failed for this case: record it, keep going
        error = f"{type(e).__name__}: {e}"
    if error is None:
        for params in checks:
            try:
                results.append(run_check(output, case, params, ctx).as_dict())
            except Exception as e:
                results.append({"type": params.get("type"), "passed": False, "score": 0.0,
                                "detail": f"check error: {type(e).__name__}: {e}"})
    passed = error is None and bool(results) and all(r["passed"] for r in results)
    score = sum(r["score"] for r in results) / len(results) if results and error is None else 0.0
    return {
        "id": case.id,
        "input": case.input,
        "expected": case.expected,
        "output": output,
        "tags": case.tags,
        "passed": passed,
        "score": round(score, 4),
        "checks": results,
        "error": error,
        "seconds": round(time.perf_counter() - start, 3),
    }


def run_suite(suite: Suite, target: dict | None = None, label: str | None = None,
              only: list[str] | None = None, progress: Callable[[int, int, dict], None] | None = None) -> dict:
    """Run the suite and return the run report (a dict, ready to save as JSON)."""
    answer_fn, target_name = make_target(suite, target)
    ctx = Context(suite.folder)
    cases = [c for c in suite.cases if not only or c.id in only]
    results = []
    for i, case in enumerate(cases, 1):
        record = run_case(case, answer_fn, suite.checks + case.checks, ctx)
        results.append(record)
        if progress:
            progress(i, len(cases), record)
    return {
        "evalgate_version": __version__,
        "suite": suite.name,
        "description": suite.description,
        "label": label or target_name,
        "target": target_name,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gate": suite.gate,
        "summary": _summary(results),
        "cases": results,
    }


def save_run(run: dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(run, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8")
    return path


def load_run(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))
