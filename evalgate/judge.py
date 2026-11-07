"""
JUDGE: an AI model grades the answer
------------------------------------
Some answers can't be checked with a rule ("is this explanation correct and helpful?").
An AI judge reads the question, the answer (and the reference answer if there is one) and a RUBRIC,
and replies with a score.

Two kinds of scale:
    scale: [1, 5]                    a number; the case passes when score >= pass_at (default: the top 40% of the scale)
    labels: [CORRECT, INCORRECT]     one word; the case passes when the label is in pass_labels (default: the first label)

A judge is only useful if it agrees with people. Measure that first with `evalgate calibrate`
(see calibrate.py) before trusting a judge in CI.

Example check:
    - type: judge
      provider: openai
      base_url: https://api.groq.com/openai/v1
      model: llama-3.3-70b-versatile
      api_key_env: GROQ_API_KEY
      rubric: "5 = fully correct and complete, 3 = partly correct, 1 = wrong or made up"
      scale: [1, 5]
      pass_at: 4
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

from . import llm
from .suite import Case, SuiteError

SYSTEM = (
    "You are a strict, fair grader. You grade ONE answer using the rubric. "
    "Judge only what the rubric asks. Do not reward length or confident tone. "
    "Reply with the grade line only."
)


@dataclass
class Verdict:
    value: Any            # the raw grade: a number or a label (None if the reply could not be read)
    normalised: float     # 0..1 (1 = best)
    passed: bool
    detail: str
    reply: str


def build_prompt(question: Any, answer: str, rubric: str, reference: Any = None, context: Any = None,
                 scale: list | None = None, labels: list | None = None) -> str:
    parts = [f"RUBRIC:\n{rubric.strip()}"]
    if context:
        parts.append(f"CONTEXT:\n{context}")
    parts.append(f"QUESTION:\n{question}")
    if reference not in (None, ""):
        parts.append(f"REFERENCE ANSWER (known to be correct):\n{reference}")
    parts.append(f"ANSWER TO GRADE:\n{answer}")
    if labels:
        parts.append("Reply with exactly one line: GRADE: " + " or ".join(labels))
    else:
        low, high = scale or [1, 5]
        parts.append(f"Reply with exactly one line: SCORE: <a whole number from {low} to {high}>")
    return "\n\n".join(parts)


def parse_grade(reply: str, scale: list | None = None, labels: list | None = None) -> Any:
    """Read the grade from the judge's reply. Returns a number, a label, or None."""
    text = reply or ""
    if labels:
        tagged = re.search(r"GRADE\s*[:=]\s*\**\s*([A-Za-z_\- ]+)", text, re.I)
        candidates = [tagged.group(1)] if tagged else []
        candidates.append(text)
        # longest labels first so INCORRECT is not read as CORRECT
        ordered = sorted(labels, key=len, reverse=True)
        for chunk in candidates:
            for label in ordered:
                if re.search(rf"\b{re.escape(label)}\b", chunk, re.I):
                    return label
        return None
    low, high = scale or [1, 5]
    tagged = re.search(r"SCORE\s*[:=]\s*\**\s*(-?\d+(?:\.\d+)?)", text, re.I)
    found = tagged.group(1) if tagged else None
    if found is None:
        numbers = re.findall(r"-?\d+(?:\.\d+)?", text)
        found = numbers[0] if numbers else None
    if found is None:
        return None
    value = float(found)
    if not low <= value <= high:
        return None
    return int(value) if value.is_integer() else value


_CACHE: dict[str, str] = {}


def ask(prompt: str, config: dict) -> str:
    """Send one grading prompt to the judge model (answers are cached for the life of the process)."""
    settings = {"max_tokens": 16, **config}
    key = hashlib.sha256(json.dumps([llm.describe(settings), prompt], sort_keys=True).encode()).hexdigest()
    if key not in _CACHE:
        messages = [{"role": "system", "content": config.get("system", SYSTEM)}, {"role": "user", "content": prompt}]
        _CACHE[key] = llm.chat(messages, settings)
    return _CACHE[key]


def judge_config(params: dict) -> dict:
    keys = ("provider", "model", "base_url", "api_key_env", "temperature", "max_tokens", "replies", "default", "system")
    return {k: params[k] for k in keys if k in params}


def grade(question: Any, answer: str, params: dict, reference: Any = None, context: Any = None) -> Verdict:
    rubric = params.get("rubric")
    if not rubric:
        raise SuiteError("a judge needs a rubric")
    scale, labels = params.get("scale"), params.get("labels")
    prompt = build_prompt(question, answer, rubric, reference, context, scale, labels)
    reply = ask(prompt, judge_config(params))
    value = parse_grade(reply, scale, labels)
    if value is None:
        return Verdict(None, 0.0, False, f"could not read the judge's reply: {reply[:60]!r}", reply)
    if labels:
        passing = params.get("pass_labels") or [labels[0]]
        ok = value in passing
        return Verdict(value, 1.0 if ok else 0.0, ok, f"judge: {value}", reply)
    low, high = scale or [1, 5]
    pass_at = float(params.get("pass_at", low + 0.6 * (high - low)))
    normalised = (float(value) - low) / (high - low) if high > low else 0.0
    ok = float(value) >= pass_at
    return Verdict(value, normalised, ok, f"judge: {value}/{high} (pass ≥ {pass_at:g})", reply)


def score(answer: str, case: Case, params: dict) -> Verdict:
    """Used by the `judge` check."""
    reference = case.expected if params.get("use_reference", True) else None
    context = case.meta.get(params["context_field"]) if params.get("context_field") else None
    return grade(case.input, answer, params, reference=reference, context=context)
