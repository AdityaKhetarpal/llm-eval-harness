"""
Build the data the website shows (web/data/site.json) by running evalgate itself on the examples.
Nothing on the site is typed in by hand: every number comes from this script.

    python scripts/build_site_data.py
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evalgate import __version__, compare_runs, load_suite, run_suite  # noqa: E402
from evalgate.checks import CHECKS  # noqa: E402

BOT = ROOT / "examples" / "support_bot"
CAL = ROOT / "examples" / "judge_calibration"
OUT = ROOT / "web" / "data" / "site.json"

TAG_NAMES = {
    "policy": "Policy facts",
    "order-id": "Asks for the order ID",
    "unknown": "Doesn't make things up",
    "privacy": "Protects customer data",
    "injection": "Resists prompt injection",
    "json": "Ticket triage (JSON)",
}


def slim(run: dict) -> list[dict]:
    return [{
        "id": c["id"], "input": c["input"], "output": c["output"], "tags": c["tags"], "passed": c["passed"],
        "error": c["error"], "seconds": c["seconds"],
        "checks": [{"type": ch["type"], "passed": ch["passed"], "detail": ch["detail"]} for ch in c["checks"]],
        "why": c["error"] or next((ch["detail"] for ch in c["checks"] if not ch["passed"]), ""),
    } for c in run["cases"]]


def main() -> None:
    suite = load_suite(BOT / "suite.yaml")
    variants = yaml.safe_load((BOT / "variants.yaml").read_text())["variants"]
    runs, full = [], {}
    for v in variants:
        answers = BOT / "runs" / f"{v['label']}.jsonl"
        if not answers.exists():
            print(f"{v['label']}: no answers yet, skipped")
            continue
        meta_path = BOT / "runs" / f"{v['label']}.meta.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        run = run_suite(suite, {"type": "replay", "file": str(answers)}, label=v["label"])
        # how long each answer took to generate (saved by the generator next to each answer)
        seconds = {json.loads(line)["id"]: json.loads(line).get("seconds") for line in answers.read_text().splitlines() if line}
        for c in run["cases"]:
            c["seconds"] = seconds.get(c["id"]) or 0
        full[v["label"]] = run
        runs.append({**v, "meta": meta, "summary": run["summary"], "cases": slim(run),
                     "mean_seconds": meta.get("mean_seconds_per_answer")})
        print(f"{v['label']}: {run['summary']['passed']}/{run['summary']['cases']}")

    comparisons = []
    baseline = next((v for v in variants if v.get("role") == "baseline"), None)
    if baseline and baseline["label"] in full:
        for v in variants:
            if v.get("role") != "candidate" or v["label"] not in full:
                continue
            result = compare_runs(full[baseline["label"]], full[v["label"]])
            comparisons.append({"kind": v["label"], "title": v["title"], "story": v["change"], **result})
            broke, fixed = len(result["newly_failing"]), len(result["newly_passing"])
            print(f"{v['label']}: {result['verdict']} ({broke} broke, {fixed} fixed)")

    calibrations = []
    for path in sorted((CAL / "results").glob("helpsteer2__*.json")) if (CAL / "results").exists() else []:
        calibrations.append({"file": path.name, **json.loads(path.read_text())})

    tag_counts: dict[str, int] = {}
    for c in suite.cases:
        for t in c.tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1

    reference = run_suite(suite, {"type": "replay", "file": str(BOT / "reference_answers.jsonl")})
    site = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": __version__,
        "checks": sorted(CHECKS),
        "suite": {"name": suite.name, "description": suite.description, "gate": suite.gate, "cases": len(suite.cases),
                  "tags": [{"id": t, "name": TAG_NAMES.get(t, t), "cases": n} for t, n in tag_counts.items()],
                  "reference_pass_rate": reference["summary"]["pass_rate"]},
        "policy": (BOT / "policy.md").read_text(),
        "prompts": {p.stem: p.read_text() for p in sorted((BOT / "prompts").glob("*.txt"))},
        "runs": runs,
        "comparisons": comparisons,
        "calibrations": calibrations,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(site, indent=1, ensure_ascii=False, default=str) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
