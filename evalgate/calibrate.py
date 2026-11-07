"""
CALIBRATE: can this AI judge be trusted?
----------------------------------------
An AI judge is a measuring instrument, and an instrument has to be checked against a known standard first.
The standard here is a set of answers that PEOPLE already graded (or whose correctness is known for sure,
e.g. SQL whose result was checked by running it).

We let the judge grade the same answers and measure agreement:

    exact agreement      how often the judge gives the same grade as the person
    within one point     (number scales) how often it is off by at most 1
    Cohen's kappa        agreement corrected for luck. 0 = no better than guessing, 1 = perfect.
                         Rough guide: < 0.2 poor, 0.2-0.4 fair, 0.4-0.6 moderate, 0.6-0.8 good, > 0.8 very good
    weighted kappa       (number scales) like kappa, but being off by 3 is punished more than being off by 1
    Spearman             do judge and people RANK answers in the same order?
    pass/fail view       turn both grades into pass/fail and ask: of the answers people FAILED,
                         how many did the judge catch? (that is the number that matters in a CI gate)
    baseline             the agreement you would get by always giving the more common verdict. A judge must beat it.

A calibration spec (YAML):

    name: helpsteer2-correctness
    dataset: helpsteer2_sample.jsonl
    fields: {question: prompt, answer: response, human: correctness}
    human_scale: [0, 4]
    judge:
      provider: local
      model: Qwen/Qwen2.5-3B-Instruct
      rubric: "4 = completely correct ... 0 = completely wrong"
      scale: [0, 4]
    pass_at: 3            # a grade of 3 or more counts as "pass" (for both judge and human)
"""
from __future__ import annotations

import json
import math
from collections import Counter
from collections.abc import Callable
from pathlib import Path
from typing import Any

import yaml

from . import judge as judge_module
from . import llm
from .suite import SuiteError

# ---------------------------------------------------------------- statistics (no numpy needed)

def agreement(a: list, b: list) -> float:
    return sum(x == y for x, y in zip(a, b)) / len(a) if a else 0.0


def cohen_kappa(a: list, b: list, categories: list | None = None, weights: str | None = None) -> float:
    """Cohen's kappa between two raters. weights='quadratic' for ordinal number scales."""
    if not a:
        return 0.0
    cats = list(categories) if categories else sorted(set(a) | set(b), key=lambda v: (str(type(v)), v))
    index = {c: i for i, c in enumerate(cats)}
    k, n = len(cats), len(a)
    if k < 2:
        return 1.0
    observed = [[0.0] * k for _ in range(k)]
    for x, y in zip(a, b):
        observed[index[x]][index[y]] += 1
    row = [sum(r) for r in observed]
    col = [sum(observed[i][j] for i in range(k)) for j in range(k)]

    def weight(i: int, j: int) -> float:
        if weights == "quadratic":
            return ((i - j) / (k - 1)) ** 2
        if weights == "linear":
            return abs(i - j) / (k - 1)
        return 0.0 if i == j else 1.0

    disagree_observed = sum(weight(i, j) * observed[i][j] for i in range(k) for j in range(k)) / n
    disagree_expected = sum(weight(i, j) * row[i] * col[j] for i in range(k) for j in range(k)) / (n * n)
    if disagree_expected == 0:
        return 1.0 if disagree_observed == 0 else 0.0
    return 1 - disagree_observed / disagree_expected


def _ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for m in range(i, j + 1):
            ranks[order[m]] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def spearman(a: list[float], b: list[float]) -> float | None:
    if len(a) < 3:
        return None
    ra, rb = _ranks(a), _ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    sa = math.sqrt(sum((x - ma) ** 2 for x in ra))
    sb = math.sqrt(sum((y - mb) ** 2 for y in rb))
    return cov / (sa * sb) if sa and sb else None


def confusion(human: list, judged: list, categories: list) -> list[list[int]]:
    """rows = human grade, columns = judge grade."""
    index = {c: i for i, c in enumerate(categories)}
    matrix = [[0] * len(categories) for _ in categories]
    for h, j in zip(human, judged):
        matrix[index[h]][index[j]] += 1
    return matrix


def pass_fail_stats(human_pass: list[bool], judge_pass: list[bool]) -> dict:
    n = len(human_pass)
    tp = sum(h and j for h, j in zip(human_pass, judge_pass))      # both say pass
    tn = sum(not h and not j for h, j in zip(human_pass, judge_pass))  # both say fail
    fp = sum(not h and j for h, j in zip(human_pass, judge_pass))  # judge let a bad answer through
    fn = sum(h and not j for h, j in zip(human_pass, judge_pass))  # judge failed a good answer
    human_fail = tn + fp
    majority = max(sum(human_pass), n - sum(human_pass)) / n if n else 0.0
    return {
        "n": n,
        "agreement": round((tp + tn) / n, 4) if n else 0.0,
        "kappa": round(cohen_kappa(human_pass, judge_pass, categories=[True, False]), 4),
        "bad_answers": human_fail,
        "bad_caught": tn,
        "bad_caught_rate": round(tn / human_fail, 4) if human_fail else None,
        "good_answers": tp + fn,
        "good_wrongly_failed": fn,
        "bad_let_through": fp,
        "judge_pass_rate": round((tp + fp) / n, 4) if n else 0.0,
        "human_pass_rate": round((tp + fn) / n, 4) if n else 0.0,
        "majority_baseline": round(majority, 4),
    }


def summarise(rows: list[dict], scale: list | None = None, labels: list | None = None,
              pass_at: float | None = None, pass_labels: list | None = None) -> dict:
    """Agreement statistics for rows that have both 'human' and 'judge' grades."""
    graded = [r for r in rows if r.get("judge") is not None]
    human = [r["human"] for r in graded]
    judged = [r["judge"] for r in graded]
    out: dict[str, Any] = {"n": len(rows), "graded": len(graded), "unreadable": len(rows) - len(graded)}
    if not graded:
        return out
    if labels:
        categories = list(labels)
        out.update({
            "categories": categories,
            "agreement": round(agreement(human, judged), 4),
            "kappa": round(cohen_kappa(human, judged, categories), 4),
            "confusion": confusion(human, judged, categories),
        })
        passing = set(pass_labels or [labels[0]])
        out["pass_fail"] = pass_fail_stats([h in passing for h in human], [j in passing for j in judged])
    else:
        low, high = scale or [1, 5]
        categories = list(range(int(low), int(high) + 1))
        h_int = [int(round(float(x))) for x in human]
        j_int = [int(round(float(x))) for x in judged]
        out.update({
            "categories": categories,
            "agreement": round(agreement(h_int, j_int), 4),
            "within_one": round(sum(abs(x - y) <= 1 for x, y in zip(h_int, j_int)) / len(h_int), 4),
            "kappa": round(cohen_kappa(h_int, j_int, categories), 4),
            "weighted_kappa": round(cohen_kappa(h_int, j_int, categories, weights="quadratic"), 4),
            "spearman": None if (s := spearman(h_int, j_int)) is None else round(s, 4),
            "mean_human": round(sum(h_int) / len(h_int), 3),
            "mean_judge": round(sum(j_int) / len(j_int), 3),
            "confusion": confusion(h_int, j_int, categories),
        })
        threshold = pass_at if pass_at is not None else low + 0.6 * (high - low)
        out["pass_at"] = threshold
        out["pass_fail"] = pass_fail_stats([x >= threshold for x in h_int], [y >= threshold for y in j_int])
    return out


# ---------------------------------------------------------------- running a calibration

def _read_rows(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    return json.loads(text)


def load_spec(path: str | Path) -> dict:
    path = Path(path).resolve()
    spec = yaml.safe_load(path.read_text(encoding="utf-8"))
    spec["_folder"] = str(path.parent)
    for key in ("dataset", "judge", "fields"):
        if key not in spec:
            raise SuiteError(f"calibration spec needs '{key}'")
    return spec


def run_calibration(spec: dict, judge_override: dict | None = None, limit: int | None = None,
                    cache_path: str | Path | None = None,
                    progress: Callable[[int, int, dict], None] | None = None) -> dict:
    """Let the judge grade every row of the dataset and compare with the human grades.

    Grades are appended to `cache_path` (JSONL) as they come in, so a long run that stops halfway
    can be resumed without paying for the same grades twice."""
    folder = Path(spec.get("_folder", "."))
    rows = _read_rows(folder / spec["dataset"])[: limit or None]
    fields = spec["fields"]
    params = {**spec["judge"], **(judge_override or {})}
    labels, scale = params.get("labels"), params.get("scale")
    model_name = llm.describe(judge_module.judge_config(params))
    # the same context for every row (e.g. a database schema), read from a file next to the spec
    shared_context = (folder / spec["context_file"]).read_text(encoding="utf-8") if spec.get("context_file") else None

    done: dict[str, dict] = {}
    cache = Path(cache_path) if cache_path else None
    if cache and cache.exists():
        for line in cache.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                done[str(r["id"])] = r
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)

    graded = []
    for i, row in enumerate(rows, 1):
        row_id = str(row.get(fields.get("id", "id"), i))
        if row_id in done:
            record = done[row_id]
        else:
            verdict = judge_module.grade(
                row[fields["question"]], row[fields["answer"]], params,
                reference=row.get(fields["reference"]) if fields.get("reference") else None,
                context=row.get(fields["context"]) if fields.get("context") else shared_context,
            )
            record = {"id": row_id, "human": row[fields["human"]], "judge": verdict.value, "reply": verdict.reply}
            if cache:
                with cache.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")
        graded.append({**record, "question": row[fields["question"]], "answer": row[fields["answer"]]})
        if progress:
            progress(i, len(rows), record)

    stats = summarise(graded, scale=scale, labels=labels, pass_at=spec.get("pass_at"),
                      pass_labels=params.get("pass_labels"))

    def distance(r: dict) -> float:
        if labels:
            return 0.0 if r["human"] == r["judge"] else 1.0
        return abs(float(r["human"]) - float(r["judge"]))

    disagreements = sorted((r for r in graded if r["judge"] is not None and distance(r) > 0),
                           key=distance, reverse=True)
    return {
        "name": spec.get("name", "calibration"),
        "description": spec.get("description", ""),
        "judge_model": model_name,
        "human_label": spec.get("human_label", "human grade"),
        "scale": scale,
        "labels": labels,
        "stats": stats,
        "human_distribution": dict(Counter(str(r["human"]) for r in graded)),
        "judge_distribution": dict(Counter(str(r["judge"]) for r in graded)),
        "disagreements": [
            {"id": r["id"], "human": r["human"], "judge": r["judge"],
             "question": str(r["question"])[:600], "answer": str(r["answer"])[:900]}
            for r in disagreements[: int(spec.get("show_disagreements", 8))]
        ],
    }
