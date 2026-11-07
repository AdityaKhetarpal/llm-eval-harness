"""
Download a small, balanced sample of NVIDIA HelpSteer2 (CC-BY-4.0) for judge calibration.

HelpSteer2: about 21k answers, each graded by human annotators on helpfulness, correctness, coherence,
complexity and verbosity (0-4). https://huggingface.co/datasets/nvidia/HelpSteer2

We keep single-turn questions where question + answer fit in 2,500 characters (so a small judge on a CPU
can read them), and take 20 answers at each correctness grade 0..4 (100 in total), with a fixed seed.
A balanced sample matters: if 80% of answers were "correct", a judge that always says "correct"
would look 80% accurate while catching nothing.

    pip install huggingface_hub
    python scripts/fetch_helpsteer2.py
"""
import gzip
import json
import random
from pathlib import Path

from huggingface_hub import hf_hub_download, list_repo_files

OUT = Path(__file__).resolve().parent.parent / "examples" / "judge_calibration" / "helpsteer2_sample.jsonl"
REPO = "nvidia/HelpSteer2"
PER_GRADE = 20
MAX_CHARS = 2500
SEED = 42


def read_rows(path: str) -> list[dict]:
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def main() -> None:
    files = list_repo_files(REPO, repo_type="dataset")
    wanted = [f for f in files if f.split("/")[-1].startswith("validation") and ".jsonl" in f]
    if not wanted:
        wanted = [f for f in files if f.split("/")[-1].startswith("train") and ".jsonl" in f]
    print("using", wanted[0])
    rows = read_rows(hf_hub_download(REPO, wanted[0], repo_type="dataset"))

    def usable(r: dict) -> bool:
        single_turn = "<extra_id_1>" not in r["prompt"]
        return single_turn and len(r["prompt"]) + len(r["response"]) <= MAX_CHARS and r["response"].strip() != ""

    pool = [r for r in rows if usable(r)]
    rng = random.Random(SEED)
    sample = []
    for grade in range(5):
        at_grade = [r for r in pool if int(r["correctness"]) == grade]
        rng.shuffle(at_grade)
        sample += at_grade[:PER_GRADE]
        print(f"grade {grade}: {len(at_grade)} available, took {min(PER_GRADE, len(at_grade))}")
    rng.shuffle(sample)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        for i, r in enumerate(sample, 1):
            f.write(json.dumps({
                "id": f"hs2-{i:03d}", "prompt": r["prompt"], "response": r["response"],
                "correctness": int(r["correctness"]), "helpfulness": int(r["helpfulness"]),
                "source": f"{REPO} ({wanted[0]})",
            }, ensure_ascii=False) + "\n")
    print(f"wrote {len(sample)} rows to {OUT}")


if __name__ == "__main__":
    main()
