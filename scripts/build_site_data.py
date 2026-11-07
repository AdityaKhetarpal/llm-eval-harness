"""
Build the data the website shows (web/data/site.json) by running evalgate itself on the examples.
Nothing on the site is typed in by hand: every number comes from this script.

    python scripts/build_site_data.py
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evalgate import __version__, compare_runs, load_suite, run_suite  # noqa: E402
from evalgate.checks import CHECKS  # noqa: E402

SQL = ROOT / "examples" / "text_to_sql"
CAL = ROOT / "examples" / "judge_calibration"
OUT = ROOT / "web" / "data" / "site.json"


def slim(run: dict) -> dict:
    return {
        "label": run["label"],
        "summary": run["summary"],
        "cases": [{
            "id": c["id"], "input": c["input"], "expected": c["expected"], "output": c["output"], "tags": c["tags"],
            "passed": c["passed"], "error": c["error"],
            "why": c["error"] or next((ch["detail"] for ch in c["checks"] if not ch["passed"]),
                                      c["checks"][0]["detail"] if c["checks"] else ""),
        } for c in run["cases"]],
    }


def main() -> None:
    index = json.loads((SQL / "runs" / "index.json").read_text())
    suite, clarify = load_suite(SQL / "suite.yaml"), load_suite(SQL / "clarify.yaml")
    runs, full = [], {}
    for meta in index:
        label = meta["label"]
        run = run_suite(suite, {"type": "replay", "file": str(SQL / "runs" / f"{label}.jsonl")}, label=label)
        vague = run_suite(clarify, {"type": "replay", "file": str(SQL / "runs" / f"{label}.clarify.jsonl")}, label=label)
        full[label] = run
        runs.append({**meta, **slim(run), "clarify": slim(vague)})
        print(f"{label}: {run['summary']['passed']}/{run['summary']['cases']}")

    by_date = [r["label"] for r in index]
    latest = by_date[-1]
    small = next(r["label"] for r in index if "1.5B" in r["model"])
    comparisons = []

    def add(kind: str, title: str, story: str, baseline: str, candidate: str) -> None:
        result = compare_runs(full[baseline], full[candidate])
        comparisons.append({"kind": kind, "title": title, "story": story, **result})
        print(f"{kind}: {baseline} -> {candidate}: {result['verdict']}")

    add("rollback", "Ship an old build by mistake",
        "The live agent (3B model) is replaced by the 19 October build: the smaller 1.5B model with the older prompt. "
        "It still runs and still answers every question. Would anyone notice?",
        latest, small)
    first_3b = next(r["label"] for r in index if "3B" in r["model"])
    add("upgrade", "A big upgrade",
        "The 19 October upgrade: a better prompt, error hints and the 3B model. Accuracy jumps from 57.5% to 80%. "
        "But did every question that worked before keep working?",
        small, first_3b)
    add("weekly", "Weekly re-run, nothing changed",
        "The scheduled Monday run with the same model. The gate should stay green.",
        by_date[-2], latest)

    calibrations = []
    results_dir = CAL / "results"
    for path in sorted(results_dir.glob("*.json")) if results_dir.exists() else []:
        calibrations.append({"file": path.name, **json.loads(path.read_text())})
        print(f"calibration: {path.name}")

    site = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": __version__,
        "checks": sorted(CHECKS),
        "suite": {"name": suite.name, "description": suite.description, "gate": suite.gate,
                  "cases": len(suite.cases)},
        "runs": runs,
        "comparisons": comparisons,
        "calibrations": calibrations,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(site, indent=1, ensure_ascii=False, default=str) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
