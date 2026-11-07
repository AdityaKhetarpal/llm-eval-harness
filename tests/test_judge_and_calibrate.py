import json

import pytest

from evalgate import run_suite
from evalgate.calibrate import cohen_kappa, pass_fail_stats, run_calibration, spearman, summarise
from evalgate.judge import build_prompt, parse_grade
from evalgate.suite import build_suite


def test_parse_numbers_and_labels():
    assert parse_grade("SCORE: 4", [1, 5]) == 4
    assert parse_grade("**SCORE:** 3.5", [1, 5]) == 3.5
    assert parse_grade("I'd say 2", [0, 4]) == 2
    assert parse_grade("SCORE: 9", [1, 5]) is None
    assert parse_grade("no idea", [1, 5]) is None
    labels = ["CORRECT", "INCORRECT"]
    assert parse_grade("GRADE: INCORRECT", labels=labels) == "INCORRECT"
    assert parse_grade("The query is incorrect.", labels=labels) == "INCORRECT"
    assert parse_grade("GRADE: correct", labels=labels) == "CORRECT"
    assert parse_grade("hmm", labels=labels) is None


def test_prompt_contains_everything():
    p = build_prompt("Q?", "A.", "be strict", reference="R", context="schema", scale=[0, 4])
    for part in ("RUBRIC", "be strict", "CONTEXT", "schema", "QUESTION", "Q?", "REFERENCE", "R", "A.", "0 to 4"):
        assert part in p


def test_judge_check_in_a_suite():
    judge = {"type": "judge", "provider": "fake", "rubric": "r", "scale": [1, 5], "pass_at": 4,
             "replies": {"ANSWER TO GRADE:\\s*good": "SCORE: 5", "ANSWER TO GRADE:\\s*meh": "SCORE: 3"},
             "default": "???"}
    suite = build_suite({
        "target": {"type": "fake", "replies": {"one": "good", "two": "meh", "three": "junk"}},
        "checks": [judge],
        "cases": [{"id": "1", "input": "one"}, {"id": "2", "input": "two"}, {"id": "3", "input": "three"}],
    })
    cases = {c["id"]: c for c in run_suite(suite)["cases"]}
    assert cases["1"]["passed"] and cases["1"]["score"] == 1.0
    assert not cases["2"]["passed"] and cases["2"]["score"] == 0.5
    assert not cases["3"]["passed"] and "could not read" in cases["3"]["checks"][0]["detail"]


def test_kappa_known_values():
    a = ["y", "y", "n", "n"]
    assert cohen_kappa(a, a) == 1.0
    assert cohen_kappa(a, ["n", "n", "y", "y"]) == -1.0
    # textbook example: 20 yes/yes, 15 no/no, 5 yes/no, 10 no/yes -> kappa 0.4
    r1 = ["y"] * 25 + ["n"] * 25
    r2 = ["y"] * 20 + ["n"] * 5 + ["y"] * 10 + ["n"] * 15
    assert cohen_kappa(r1, r2) == pytest.approx(0.4)


def test_weighted_kappa_punishes_big_misses_more():
    human = [0, 1, 2, 3, 4] * 4
    near = [min(4, h + 1) for h in human]
    far = [4 - h for h in human]
    assert cohen_kappa(human, near, list(range(5)), "quadratic") > cohen_kappa(human, far, list(range(5)), "quadratic")


def test_spearman():
    assert spearman([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)


def test_always_pass_judge_catches_nothing():
    human = [True] * 8 + [False] * 2
    stats = pass_fail_stats(human, [True] * 10)
    assert stats["agreement"] == 0.8 and stats["majority_baseline"] == 0.8
    assert stats["bad_caught"] == 0 and stats["bad_caught_rate"] == 0.0 and stats["kappa"] == 0.0


def test_summarise_number_scale():
    rows = [{"human": h, "judge": j} for h, j in [(4, 4), (3, 4), (0, 1), (1, 1), (2, None)]]
    st = summarise(rows, scale=[0, 4], pass_at=3)
    assert st["graded"] == 4 and st["unreadable"] == 1
    assert st["agreement"] == 0.5 and st["within_one"] == 1.0
    assert st["confusion"][4][4] == 1 and st["confusion"][3][4] == 1
    assert st["pass_fail"]["agreement"] == 1.0


def test_run_calibration_with_cache(tmp_path):
    rows = [{"id": str(i), "q": f"question {i}", "a": f"answer {i}", "h": "CORRECT" if i % 2 else "INCORRECT"}
            for i in range(6)]
    (tmp_path / "data.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
    (tmp_path / "schema.txt").write_text("TABLE t")
    spec = {
        "_folder": str(tmp_path), "name": "t", "dataset": "data.jsonl", "context_file": "schema.txt",
        "fields": {"id": "id", "question": "q", "answer": "a", "human": "h"},
        "judge": {"provider": "fake", "rubric": "r", "labels": ["CORRECT", "INCORRECT"],
                  "replies": {"CONTEXT:\\s*TABLE t.*answer [135]": "GRADE: CORRECT"}, "default": "GRADE: INCORRECT"},
    }
    cache = tmp_path / "grades.jsonl"
    result = run_calibration(spec, cache_path=cache)
    st = result["stats"]
    assert st["agreement"] == 1.0 and st["kappa"] == 1.0
    assert st["pass_fail"]["bad_caught"] == 3
    assert len(cache.read_text().splitlines()) == 6
    # a second run reads the cache: a judge that would now say something else is never asked
    spec["judge"]["default"] = "GRADE: CORRECT"
    spec["judge"]["replies"] = {}
    again = run_calibration(spec, cache_path=cache)
    assert again["stats"]["agreement"] == 1.0
