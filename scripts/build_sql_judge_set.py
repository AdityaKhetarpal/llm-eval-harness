"""
Build the "SQL judge" calibration set: can an AI judge tell whether a query is right WITHOUT running it?

Every distinct (question, SQL) pair the agent produced across its real runs is labelled by EXECUTION
(the sql_result check: run it, compare with the correct query's result). That label is ground truth,
better than a human opinion. Then an AI judge only sees the schema, the question and the SQL, and has to guess.

    python scripts/build_sql_judge_set.py
Writes examples/judge_calibration/sql_judge_set.jsonl and sql_schema.txt
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from evalgate import load_suite, run_suite  # noqa: E402

SQL = ROOT / "examples" / "text_to_sql"
OUT = ROOT / "examples" / "judge_calibration"

# The schema text the agent itself reads (copied from its prompt, without its answer-format rules)
SCHEMA_START = "SQLite database of an Indian online shop."


def main(agent_repo: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    prompt = json.loads((agent_repo / "web" / "public" / "data" / "prompt.json").read_text())["system"]
    (OUT / "sql_schema.txt").write_text(prompt[prompt.index(SCHEMA_START):].strip() + "\n")

    suite = load_suite(SQL / "suite.yaml")
    pairs = {}
    for label in [r["label"] for r in json.loads((SQL / "runs" / "index.json").read_text())]:
        run = run_suite(suite, {"type": "replay", "file": str(SQL / "runs" / f"{label}.jsonl")})
        for case in run["cases"]:
            sql = (case["output"] or "").strip()
            if not sql.lower().startswith(("select", "with")):
                continue  # the agent gave up; nothing to judge
            key = (case["id"], " ".join(sql.split()))
            pairs.setdefault(key, {
                "id": f"{case['id']}-{len(pairs) + 1:03d}",
                "case": case["id"],
                "level": case["tags"][0] if case["tags"] else "",
                "question": case["input"],
                "sql": sql,
                "label": "CORRECT" if case["passed"] else "INCORRECT",
                "from_run": label,
            })
    rows = sorted(pairs.values(), key=lambda r: r["id"])
    with (OUT / "sql_judge_set.jsonl").open("w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    correct = sum(r["label"] == "CORRECT" for r in rows)
    print(f"{len(rows)} distinct queries: {correct} correct, {len(rows) - correct} incorrect")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "../ai-data-analyst-agent").resolve())
