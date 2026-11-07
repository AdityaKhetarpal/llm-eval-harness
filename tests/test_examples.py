"""The support-bot suite: the checks must accept correct answers however they are worded,
and catch wrong ones. The saved runs (made by .github/workflows/generate.yml) must replay cleanly."""
import json
from pathlib import Path

import pytest
import yaml

from evalgate import compare_runs, load_suite, run_suite
from evalgate.cli import main

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
BOT = EXAMPLES / "support_bot"
VARIANTS = yaml.safe_load((BOT / "variants.yaml").read_text())["variants"]
SAVED = [v["label"] for v in VARIANTS if (BOT / "runs" / f"{v['label']}.jsonl").exists()]


def replay(file: Path, suite=None) -> dict:
    return run_suite(suite or load_suite(BOT / "suite.yaml"), {"type": "replay", "file": str(file)})


def test_suite_shape():
    suite = load_suite(BOT / "suite.yaml")
    assert len(suite.cases) == 44
    assert {t for c in suite.cases for t in c.tags} == {"policy", "order-id", "unknown", "privacy", "injection", "json"}


def test_correct_answers_all_pass():
    run = replay(BOT / "reference_answers.jsonl")
    failed = [(c["id"], c["checks"]) for c in run["cases"] if not c["passed"]]
    assert not failed


def test_wrong_answers_are_all_caught():
    bad = [json.loads(line) for line in (BOT / "bad_answers.jsonl").read_text().splitlines() if line]
    suite = load_suite(BOT / "suite.yaml")
    suite.cases = [c for c in suite.cases if c.id in {b["id"] for b in bad}]
    run = replay(BOT / "bad_answers.jsonl", suite)
    assert len(run["cases"]) == len(bad)
    assert [c["id"] for c in run["cases"] if c["passed"]] == []


def test_gate_blocks_bad_answers_against_good_ones(tmp_path):
    good = replay(BOT / "reference_answers.jsonl")
    bad_file = tmp_path / "mixed.jsonl"
    rows = {r["id"]: r for r in map(json.loads, (BOT / "reference_answers.jsonl").read_text().splitlines())}
    for b in map(json.loads, (BOT / "bad_answers.jsonl").read_text().splitlines()):
        rows[b["id"]] = b
    bad_file.write_text("\n".join(json.dumps(r) for r in rows.values()))
    result = compare_runs(good, replay(bad_file))
    assert result["verdict"] == "FAIL" and len(result["newly_failing"]) == 13


@pytest.mark.parametrize("label", SAVED)
def test_saved_runs_replay(label):
    run = replay(BOT / "runs" / f"{label}.jsonl")
    assert run["summary"]["cases"] == 44 and run["summary"]["errors"] == 0


def test_quickstart_suite():
    run = run_suite(load_suite(EXAMPLES / "quickstart" / "suite.yaml"))
    assert run["summary"]["passed"] == 3
    assert not next(c for c in run["cases"] if c["id"] == "australia")["passed"]


def test_cli_gate_exit_codes(tmp_path):
    base = tmp_path / "base.json"
    suite = str(BOT / "suite.yaml")
    good, bad = str(BOT / "reference_answers.jsonl"), str(tmp_path / "bad.jsonl")
    rows = [json.loads(line) for line in (BOT / "reference_answers.jsonl").read_text().splitlines()]
    rows[0]["output"] = "You have 30 days."
    Path(bad).write_text("\n".join(json.dumps(r) for r in rows))
    assert main(["run", suite, "--outputs", good, "-q", "--out", str(base)]) == 0
    assert main(["gate", suite, "--baseline", str(base), "--outputs", good, "-q"]) == 0
    assert main(["gate", suite, "--baseline", str(base), "--outputs", bad, "-q"]) == 1
    assert main(["run", str(tmp_path / "missing.yaml")]) == 2
