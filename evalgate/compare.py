"""
COMPARE: the gate
-----------------
Compare a NEW run (the candidate: a new prompt, a new model, new code) with a BASELINE run
(what is live today) and decide PASS or FAIL. CI uses the exit code to block the change.

The gate fails when any rule is broken:
    min_pass_rate      the new pass rate is below a floor (e.g. 0.75)
    max_drop           the pass rate dropped more than this vs the baseline (0.0 = no drop allowed)
    max_new_failures   more than N cases that passed before now fail (0 = no case may break)

Why "new failures" and not just the pass rate: a change can fix 3 cases and break 3 others.
The pass rate stays the same but 3 things users relied on are now broken. The gate catches that.
"""
from __future__ import annotations


def compare_runs(baseline: dict, candidate: dict, gate: dict | None = None) -> dict:
    rules = {"min_pass_rate": 0.0, "max_drop": 0.0, "max_new_failures": 0,
             **(candidate.get("gate") or {}), **(gate or {})}
    before = {c["id"]: c for c in baseline["cases"]}
    after = {c["id"]: c for c in candidate["cases"]}
    shared = [i for i in after if i in before]

    newly_failing = [i for i in shared if before[i]["passed"] and not after[i]["passed"]]
    newly_passing = [i for i in shared if not before[i]["passed"] and after[i]["passed"]]
    still_failing = [i for i in shared if not before[i]["passed"] and not after[i]["passed"]]
    only_new = [i for i in after if i not in before]
    only_old = [i for i in before if i not in after]

    old_rate = baseline["summary"]["pass_rate"]
    new_rate = candidate["summary"]["pass_rate"]
    drop = round(old_rate - new_rate, 4)

    reasons = []
    if new_rate < float(rules["min_pass_rate"]):
        reasons.append(f"pass rate {new_rate:.1%} is below the minimum {float(rules['min_pass_rate']):.1%}")
    if drop > float(rules["max_drop"]) + 1e-9:
        reasons.append(f"pass rate dropped {drop:.1%} (allowed: {float(rules['max_drop']):.1%})")
    if len(newly_failing) > int(rules["max_new_failures"]):
        reasons.append(f"{len(newly_failing)} case(s) that passed before now fail "
                       f"(allowed: {int(rules['max_new_failures'])})")

    def changes(ids: list[str]) -> list[dict]:
        out = []
        for i in ids:
            new = after[i]
            failed = [c for c in new["checks"] if not c["passed"]]
            out.append({
                "id": i,
                "input": new["input"],
                "tags": new["tags"],
                "before": before[i]["output"],
                "after": new["output"],
                "why": new["error"] or (failed[0]["detail"] if failed else ""),
            })
        return out

    by_tag = {}
    for tag in sorted(set(candidate["summary"].get("by_tag", {})) | set(baseline["summary"].get("by_tag", {}))):
        b = baseline["summary"].get("by_tag", {}).get(tag, {})
        a = candidate["summary"].get("by_tag", {}).get(tag, {})
        by_tag[tag] = {"before": b.get("pass_rate"), "after": a.get("pass_rate"),
                       "before_passed": b.get("passed"), "after_passed": a.get("passed"), "cases": a.get("cases")}

    return {
        "suite": candidate.get("suite"),
        "baseline": {"label": baseline.get("label"), "created_at": baseline.get("created_at"), "pass_rate": old_rate,
                     "passed": baseline["summary"]["passed"], "cases": baseline["summary"]["cases"]},
        "candidate": {"label": candidate.get("label"), "created_at": candidate.get("created_at"), "pass_rate": new_rate,
                      "passed": candidate["summary"]["passed"], "cases": candidate["summary"]["cases"]},
        "delta": round(new_rate - old_rate, 4),
        "rules": rules,
        "verdict": "FAIL" if reasons else "PASS",
        "reasons": reasons,
        "newly_failing": changes(newly_failing),
        "newly_passing": changes(newly_passing),
        "still_failing": len(still_failing),
        "added_cases": only_new,
        "removed_cases": only_old,
        "by_tag": by_tag,
    }
