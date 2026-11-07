"""The example suites use REAL saved runs of the AI Data Analyst Agent. evalgate must reach
exactly the accuracy the agent itself reported for each run, and the gate must block the weaker model."""
import json
from pathlib import Path

import pytest

from evalgate import compare_runs, load_suite, run_suite
from evalgate.cli import main

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
SQL = EXAMPLES / "text_to_sql"
INDEX = json.loads((SQL / "runs" / "index.json").read_text())


def replay(label: str) -> dict:
    return run_suite(load_suite(SQL / "suite.yaml"), {"type": "replay", "file": str(SQL / "runs" / f"{label}.jsonl")},
                     label=label)


@pytest.mark.parametrize("run", INDEX, ids=[r["label"] for r in INDEX])
def test_reproduces_the_agents_own_score(run):
    assert replay(run["label"])["summary"]["pass_rate"] * 100 == pytest.approx(run["agent_reported_accuracy_pct"])


def test_gate_blocks_the_smaller_model_and_passes_the_weekly_rerun():
    latest, previous, small = replay("2026-11-05-3B"), replay("2026-10-26-3B"), replay("2026-10-19-1.5B")
    swap = compare_runs(latest, small)
    assert swap["verdict"] == "FAIL" and len(swap["newly_failing"]) == 10
    assert compare_runs(previous, latest)["verdict"] == "PASS"


def test_clarify_suite():
    run = run_suite(load_suite(SQL / "clarify.yaml"))
    assert run["summary"]["cases"] == 5 and run["summary"]["passed"] == 2


def test_quickstart_suite():
    run = run_suite(load_suite(EXAMPLES / "quickstart" / "suite.yaml"))
    assert run["summary"]["passed"] == 3
    assert not next(c for c in run["cases"] if c["id"] == "australia")["passed"]


def test_cli_gate_exit_codes(tmp_path):
    base = tmp_path / "base.json"
    assert main(["run", str(SQL / "suite.yaml"), "-q", "--out", str(base)]) == 0
    assert main(["gate", str(SQL / "suite.yaml"), "--baseline", str(base), "-q"]) == 0
    bad = SQL / "runs" / "2026-10-19-1.5B.jsonl"
    assert main(["gate", str(SQL / "suite.yaml"), "--baseline", str(base), "--outputs", str(bad), "-q"]) == 1
    assert main(["run", str(tmp_path / "missing.yaml")]) == 2
