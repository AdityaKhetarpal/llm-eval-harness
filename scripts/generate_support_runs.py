"""
Run one version of the Voltkart support bot on all 44 customer messages and save its answers.

Each version is a (prompt, model) pair from examples/support_bot/variants.yaml. The model runs locally
on the CPU (free, no API key), with greedy decoding so the same version always gives the same answers.

    pip install -e ".[local]"
    python scripts/generate_support_runs.py v1-3b

Writes examples/support_bot/runs/<label>.jsonl (one answer per line) and <label>.meta.json.
"""
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evalgate import load_suite, run_suite  # noqa: E402

BOT = ROOT / "examples" / "support_bot"


def main(label: str) -> None:
    variants = {v["label"]: v for v in yaml.safe_load((BOT / "variants.yaml").read_text())["variants"]}
    if label not in variants:
        sys.exit(f"unknown variant {label}; choose from {', '.join(variants)}")
    v = variants[label]
    suite = load_suite(BOT / "suite.yaml")
    target = {
        "type": "local",
        "model": v["model"],
        "system_file": v["prompt"],
        "system_vars": {"policy": "policy.md"},
        "max_tokens": 220,
    }

    def progress(i: int, n: int, record: dict) -> None:
        mark = "pass" if record["passed"] else "FAIL"
        print(f"[{i}/{n}] {record['seconds']:6.1f}s {mark} {record['id']}", flush=True)

    start = time.time()
    run = run_suite(suite, target, label=label, progress=progress)
    (BOT / "runs").mkdir(exist_ok=True)
    with (BOT / "runs" / f"{label}.jsonl").open("w", encoding="utf-8") as f:
        for c in run["cases"]:
            f.write(json.dumps({"id": c["id"], "output": c["output"], "seconds": c["seconds"]}, ensure_ascii=False) + "\n")
    seconds = [c["seconds"] for c in run["cases"]]
    meta = {
        "label": label,
        "model": v["model"],
        "prompt": v["prompt"],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "machine": f"GitHub Actions runner ({platform.machine()}, CPU only)",
        "decoding": "greedy, max 220 new tokens",
        "total_seconds": round(time.time() - start, 1),
        "mean_seconds_per_answer": round(sum(seconds) / len(seconds), 2),
        "errors": run["summary"]["errors"],
    }
    (BOT / "runs" / f"{label}.meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps({**meta, "pass_rate": run["summary"]["pass_rate"]}, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
