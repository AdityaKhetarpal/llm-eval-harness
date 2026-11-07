"""
Import the REAL test runs of the AI Data Analyst Agent into an evalgate suite.

The agent (github.com/AdityaKhetarpal/ai-data-analyst-agent) answers 40 business questions with SQL every week
and commits the result to data/test_report.json. Every version of that file is in git history, so we can
replay each week's answers through evalgate and compare runs, exactly like a team would in CI.

    python scripts/import_sql_agent_runs.py ../ai-data-analyst-agent

Writes:
    examples/text_to_sql/cases.jsonl          the 40 questions with the correct SQL (expected)
    examples/text_to_sql/clarify_cases.jsonl  the 5 vague questions where the agent should ask back
    examples/text_to_sql/runs/<label>.jsonl   the agent's answers in each saved run
    examples/text_to_sql/shop.db              the shop database the SQL runs on
    examples/text_to_sql/runs/index.json      which run is which (date, model, commit)
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "examples" / "text_to_sql"


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


def answer_text(record: dict) -> str:
    """What the agent actually replied: its final SQL, or its clarifying question."""
    if record["type"] == "answer":
        return record["attempts"][-1]["sql"] if record.get("attempts") else record["sql"]
    return record.get("answer") or record.get("reply") or record.get("sql") or ""


def main(repo: Path) -> None:
    (OUT / "runs").mkdir(parents=True, exist_ok=True)
    questions = json.loads((repo / "data" / "test_questions.json").read_text())
    with (OUT / "cases.jsonl").open("w") as f:
        for q in questions["questions"]:
            f.write(json.dumps({"id": q["id"], "input": q["question"], "expected": q["sql"], "tags": [q["level"]]}) + "\n")
    with (OUT / "clarify_cases.jsonl").open("w") as f:
        for q in questions.get("vague", []):
            f.write(json.dumps({"id": q["id"], "input": q["question"], "tags": ["vague"]}) + "\n")
    shutil.copy(repo / "data" / "shop.db", OUT / "shop.db")

    commits = git(repo, "log", "--reverse", "--format=%H %ad", "--date=format:%Y-%m-%d", "--",
                  "data/test_report.json").split("\n")
    index, seen = [], {}
    for line in filter(None, commits):
        sha, date = line.split()
        report = json.loads(git(repo, "show", f"{sha}:data/test_report.json"))
        engine = report["summary"].get("engine", "")
        model = engine.split("(")[-1].rstrip(")") if "(" in engine else engine
        size = "1.5B" if "1.5B" in model else ("3B" if "3B" in model else model)
        label = f"{date}-{size}"
        seen[label] = seen.get(label, 0) + 1
        if seen[label] > 1:
            label = f"{label}-{seen[label]}"
        with (OUT / "runs" / f"{label}.jsonl").open("w") as f:
            for r in report["records"]:
                f.write(json.dumps({"id": r["id"], "output": answer_text(r)}) + "\n")
        with (OUT / "runs" / f"{label}.clarify.jsonl").open("w") as f:
            for v in report.get("vague", []):
                f.write(json.dumps({"id": v["id"], "output": v.get("reply", "")}) + "\n")
        index.append({
            "label": label, "date": date, "model": model, "commit": sha[:7],
            "agent_reported_accuracy_pct": report["summary"].get("execution_accuracy_pct"),
        })
        print(f"{label}: {model}, agent reported {report['summary'].get('execution_accuracy_pct')}%")
    (OUT / "runs" / "index.json").write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "../ai-data-analyst-agent").resolve())
