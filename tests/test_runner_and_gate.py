import json

import pytest

from evalgate import compare_runs, load_suite, run_suite
from evalgate.report import compare_markdown, run_html, run_markdown
from evalgate.suite import SuiteError, build_suite


def suite_with(target, cases=None, checks=None, gate=None):
    return build_suite({
        "name": "t",
        "target": target,
        "checks": checks if checks is not None else [{"type": "contains"}],
        "gate": gate or {},
        "cases": cases or [
            {"id": "a", "input": "one", "expected": "one", "tags": ["x"]},
            {"id": "b", "input": "two", "expected": "two", "tags": ["x", "y"]},
            {"id": "c", "input": "three", "expected": "four", "tags": ["y"]},
        ],
    })


def test_python_target_and_summary():
    run = run_suite(suite_with({"type": "python", "function": "tests.helpers:echo"}))
    s = run["summary"]
    assert (s["cases"], s["passed"], s["failed"]) == (3, 2, 1)
    assert s["pass_rate"] == pytest.approx(0.6667, abs=1e-4)
    assert s["by_tag"]["x"] == {"passed": 2, "cases": 2, "pass_rate": 1.0}
    assert s["by_tag"]["y"]["passed"] == 1


def test_a_crashing_app_fails_the_case_but_not_the_run():
    run = run_suite(suite_with({"type": "python", "function": "tests.helpers:broken"}))
    assert run["summary"]["errors"] == 3 and run["summary"]["passed"] == 0
    assert "model is down" in run["cases"][0]["error"]


def test_replay_target_and_missing_answers(tmp_path):
    answers = tmp_path / "answers.jsonl"
    answers.write_text(json.dumps({"id": "a", "output": "one!"}) + "\n" + json.dumps({"id": "b", "output": "nope"}))
    run = run_suite(suite_with({"type": "replay", "file": str(answers)}))
    by_id = {c["id"]: c for c in run["cases"]}
    assert by_id["a"]["passed"] and not by_id["b"]["passed"]
    assert "no saved answer" in by_id["c"]["error"]


def test_command_target(tmp_path):
    run = run_suite(suite_with({"type": "command", "command": "cat"}))
    assert run["summary"]["passed"] == 2


def test_fake_model_target():
    run = run_suite(suite_with({"type": "fake", "replies": {"one": "one", "two": "two", "three": "four"}}))
    assert run["summary"]["passed"] == 3


def test_suite_validation():
    with pytest.raises(SuiteError, match="duplicate"):
        build_suite({"cases": [{"id": "a", "input": 1}, {"id": "a", "input": 2}]})
    with pytest.raises(SuiteError, match="input"):
        build_suite({"cases": [{"id": "a"}]})
    with pytest.raises(SuiteError, match="type"):
        build_suite({"checks": [{"value": 1}], "cases": [{"input": 1}]})


def runs(before: dict, after: dict, gate=None):
    def make(results):
        cases = [{"id": i, "input": i, "output": "", "tags": ["t"], "passed": ok, "error": None,
                  "checks": [{"type": "x", "passed": ok, "score": float(ok), "detail": "d"}]}
                 for i, ok in results.items()]
        passed = sum(results.values())
        return {"suite": "s", "label": "l", "gate": gate or {},
                "summary": {"cases": len(cases), "passed": passed, "pass_rate": passed / len(cases),
                            "by_tag": {"t": {"passed": passed, "cases": len(cases), "pass_rate": passed / len(cases)}}},
                "cases": cases}
    return make(before), make(after)


def test_gate_passes_when_nothing_breaks():
    b, a = runs({"1": True, "2": False}, {"1": True, "2": True})
    result = compare_runs(b, a)
    assert result["verdict"] == "PASS" and [c["id"] for c in result["newly_passing"]] == ["2"]


def test_gate_catches_a_swap_with_the_same_pass_rate():
    # one case fixed, another broken: same pass rate, but something users relied on broke
    b, a = runs({"1": True, "2": False}, {"1": False, "2": True})
    result = compare_runs(b, a)
    assert result["delta"] == 0
    assert result["verdict"] == "FAIL"
    assert [c["id"] for c in result["newly_failing"]] == ["1"]
    assert compare_runs(b, a, {"max_new_failures": 1})["verdict"] == "PASS"


def test_gate_floor_and_drop():
    b, a = runs({"1": True, "2": True, "3": True, "4": True}, {"1": True, "2": True, "3": True, "4": False})
    assert compare_runs(b, a, {"max_new_failures": 5, "max_drop": 0.30})["verdict"] == "PASS"
    result = compare_runs(b, a, {"max_new_failures": 5, "max_drop": 0.30, "min_pass_rate": 0.9})
    assert result["verdict"] == "FAIL" and "below the minimum" in result["reasons"][0]
    assert "dropped" in compare_runs(b, a, {"max_new_failures": 5})["reasons"][0]


def test_reports_render():
    run = run_suite(suite_with({"type": "python", "function": "tests.helpers:echo"}))
    md = run_markdown(run)
    assert "2/3 passed" in md and "`c`" in md
    page = run_html(run)
    assert page.startswith("<!doctype html>") and "</script>" in page
    b, a = runs({"1": True}, {"1": False})
    assert "❌ evalgate: FAIL" in compare_markdown(compare_runs(b, a))


def test_load_suite_from_file(tmp_path):
    (tmp_path / "cases.jsonl").write_text(json.dumps({"id": "x", "input": "hi", "expected": "hi"}) + "\n")
    (tmp_path / "suite.yaml").write_text("name: f\ntarget: {type: command, command: cat}\n"
                                         "checks: [{type: exact}]\ncases: cases.jsonl\n")
    suite = load_suite(tmp_path / "suite.yaml")
    assert suite.name == "f" and suite.cases[0].id == "x"
    assert run_suite(suite)["summary"]["passed"] == 1
