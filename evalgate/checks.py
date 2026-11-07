"""
CHECKS: score one answer
------------------------
Every check looks at the app's answer for one case and returns a CheckResult:
passed (True/False), a score between 0 and 1, and a short human-readable detail.

Most checks compare against the case's `expected` value unless the check sets its own `value`.

    exact         answer equals expected (case and extra spaces ignored by default)
    contains      answer contains a phrase (or all / any of several)
    not_contains  answer contains none of the phrases (e.g. "As an AI", a competitor's name, a leaked secret)
    regex         answer matches a regular expression
    json          answer is valid JSON (optionally with required keys, or equal to expected)
    number        the answer's number is within a tolerance of the expected number (handles 1,23,456 and 12.5%)
    f1            word-overlap F1 with the expected answer (like SQuAD); passes above a threshold
    max_length    answer is at most N characters or words
    is_question   answer is a clarifying question (has a "?", and does not look like an answer, e.g. no SQL)
    sql_result    RUN the answer as SQL and the expected SQL on a read-only SQLite database, compare the RESULTS
    judge         an AI judge scores the answer with a rubric (see judge.py)
    python        your own function: module:function(answer, case, params) -> bool | float | (bool, detail)

A case passes only if ALL of its checks pass.
"""
from __future__ import annotations

import importlib
import json
import math
import re
import sqlite3
import string
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .suite import Case, SuiteError


@dataclass
class CheckResult:
    type: str
    passed: bool
    score: float
    detail: str = ""

    def as_dict(self) -> dict:
        return {"type": self.type, "passed": self.passed, "score": round(self.score, 4), "detail": self.detail}


class Context:
    """Things a check may need: the suite folder (for relative paths) and shared caches."""

    def __init__(self, folder: Path | None = None):
        self.folder = folder or Path.cwd()
        self.databases: dict[str, sqlite3.Connection] = {}
        self.expected_tables: dict[tuple, Any] = {}

    def resolve(self, value: str) -> Path:
        p = Path(value)
        return p if p.is_absolute() else self.folder / p


def _result(kind: str, ok: bool, detail: str = "", score: float | None = None) -> CheckResult:
    return CheckResult(kind, bool(ok), float(score if score is not None else (1.0 if ok else 0.0)), detail)


def _short(text: Any, n: int = 80) -> str:
    s = str(text).replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


def _normalise(text: Any, ignore_case: bool = True, spaces: bool = True, punctuation: bool = False) -> str:
    s = "" if text is None else str(text)
    if ignore_case:
        s = s.lower()
    if punctuation:
        s = s.translate(str.maketrans("", "", string.punctuation))
    if spaces:
        s = " ".join(s.split())
    return s.strip()


def _as_list(value: Any) -> list:
    if value is None:
        return []
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _want(params: dict, case: Case) -> Any:
    return params["value"] if "value" in params else case.expected


# ---------------------------------------------------------------- text checks

def check_exact(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    options = _as_list(_want(params, case))
    if not options:
        raise SuiteError(f"{case.id}: exact needs an expected value")
    norm = {"ignore_case": params.get("ignore_case", True), "punctuation": params.get("ignore_punctuation", False)}
    got = _normalise(answer, **norm)
    ok = any(got == _normalise(o, **norm) for o in options)
    return _result("exact", ok, "matches" if ok else f"got {_short(answer)!r}, wanted {_short(options[0])!r}")


def check_contains(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    phrases = _as_list(_want(params, case))
    if not phrases:
        raise SuiteError(f"{case.id}: contains needs a value")
    ignore = params.get("ignore_case", True)
    got = _normalise(answer, ignore_case=ignore)
    found = [p for p in phrases if _normalise(p, ignore_case=ignore) in got]
    mode = params.get("mode", "all")
    ok = bool(found) if mode == "any" else len(found) == len(phrases)
    missing = [p for p in phrases if p not in found]
    detail = "found all" if ok and mode == "all" else ("found " + ", ".join(map(str, found)) if ok else
                                                       "missing " + ", ".join(repr(_short(m, 40)) for m in missing))
    return _result("contains", ok, detail, score=len(found) / len(phrases))


def check_not_contains(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    phrases = _as_list(params.get("value"))
    if not phrases:
        raise SuiteError(f"{case.id}: not_contains needs a value")
    ignore = params.get("ignore_case", True)
    got = _normalise(answer, ignore_case=ignore)
    found = [p for p in phrases if _normalise(p, ignore_case=ignore) in got]
    return _result("not_contains", not found, "clean" if not found else "contains " + ", ".join(map(repr, found)))


def check_regex(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    pattern = params.get("pattern") or params.get("value")
    if not pattern:
        raise SuiteError(f"{case.id}: regex needs a pattern")
    flags = re.I if params.get("ignore_case", False) else 0
    found = re.search(pattern, answer or "", flags | re.S)
    if params.get("must_not_match"):
        if found:
            return _result("regex", False, f"contains something it must not: {_short(found.group(0), 40)!r}")
        return _result("regex", True, "clean")
    return _result("regex", found is not None, ("matched" if found else "no match") + f" /{_short(pattern, 40)}/")


def _extract_json(text: str) -> str:
    fence = re.search(r"```(?:json)?\s*(.*?)```", text or "", re.S)
    return (fence.group(1) if fence else text or "").strip()


def _subset(want: Any, got: Any) -> bool:
    """Every key/value in `want` appears in `got` (extra keys in the answer are fine)."""
    if isinstance(want, dict):
        return isinstance(got, dict) and all(k in got and _subset(v, got[k]) for k, v in want.items())
    if isinstance(want, list):
        return isinstance(got, list) and len(want) == len(got) and all(_subset(a, b) for a, b in zip(want, got))
    if isinstance(want, (int, float)) and isinstance(got, (int, float)) and not isinstance(want, bool):
        return math.isclose(want, got, rel_tol=1e-6, abs_tol=1e-9)
    return want == got


def check_json(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    try:
        data = json.loads(_extract_json(answer))
    except (json.JSONDecodeError, TypeError) as e:
        return _result("json", False, f"not valid JSON ({e.msg if hasattr(e, 'msg') else e})")
    required = _as_list(params.get("required_keys"))
    if required:
        if not isinstance(data, dict):
            return _result("json", False, "JSON is not an object")
        missing = [k for k in required if k not in data]
        if missing:
            return _result("json", False, "missing keys: " + ", ".join(missing),
                           score=1 - len(missing) / len(required))
    if params.get("match_expected"):
        want = case.expected
        if isinstance(want, str):
            want = json.loads(want)
        if not _subset(want, data):
            return _result("json", False, "values differ from expected")
    return _result("json", True, "valid JSON" + (" with required keys" if required else ""))


NUMBER = re.compile(r"[-−]?\d[\d,]*(?:\.\d+)?")


def numbers_in(text: str) -> list[float]:
    """All numbers in a piece of text. Indian (1,23,456) and western (123,456) grouping both work."""
    out = []
    for m in NUMBER.findall(text or ""):
        try:
            out.append(float(m.replace(",", "").replace("−", "-")))
        except ValueError:
            continue
    return out


def check_number(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    want = _want(params, case)
    try:
        want = float(str(want).replace(",", ""))
    except (TypeError, ValueError) as e:
        raise SuiteError(f"{case.id}: number needs a numeric expected value, got {want!r}") from e
    found = numbers_in(answer)
    if not found:
        return _result("number", False, "no number in the answer")
    rel, absolute = float(params.get("rel_tol", 0.01)), float(params.get("abs_tol", 0.0))
    which = params.get("which", "any")
    pool = found if which == "any" else [found[0] if which == "first" else found[-1]]
    best = min(pool, key=lambda x: abs(x - want))
    ok = math.isclose(best, want, rel_tol=rel, abs_tol=absolute)
    return _result("number", ok, f"got {best:g}, wanted {want:g} (±{rel:.0%})")


def _tokens(text: str) -> list[str]:
    s = _normalise(text, punctuation=True)
    return [w for w in s.split() if w not in {"a", "an", "the"}]


def token_f1(answer: str, expected: str) -> float:
    got, want = _tokens(answer), _tokens(expected)
    if not got or not want:
        return float(got == want)
    common = sum((Counter(got) & Counter(want)).values())
    if common == 0:
        return 0.0
    precision, recall = common / len(got), common / len(want)
    return 2 * precision * recall / (precision + recall)


def check_f1(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    options = _as_list(_want(params, case))
    if not options:
        raise SuiteError(f"{case.id}: f1 needs an expected value")
    score = max(token_f1(answer, str(o)) for o in options)
    threshold = float(params.get("threshold", 0.5))
    return _result("f1", score >= threshold, f"F1 {score:.2f} (pass ≥ {threshold:.2f})", score=score)


def check_max_length(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    if "words" in params:
        n, limit, unit = len((answer or "").split()), int(params["words"]), "words"
    else:
        n, limit, unit = len(answer or ""), int(params.get("chars", params.get("value", 500))), "characters"
    return _result("max_length", n <= limit, f"{n} {unit} (limit {limit})")


def check_is_question(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    text = answer or ""
    has_question = "?" in text
    looks_like_answer = re.search(params.get("not_pattern", r"(?i)\bselect\b.+\bfrom\b"), text, re.S) is not None
    ok = has_question and not looks_like_answer
    if ok:
        detail = "asked a clarifying question"
    elif looks_like_answer:
        detail = "answered instead of asking"
    else:
        detail = "no question mark"
    return _result("is_question", ok, detail)


# ---------------------------------------------------------------- SQL: compare results, not text

def _connect(path: Path) -> sqlite3.Connection:
    if not path.exists():
        raise SuiteError(f"database not found: {path}")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION}
    allowed.add(getattr(sqlite3, "SQLITE_RECURSIVE", 33))

    def authorizer(action, *_):
        return sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY

    con.set_authorizer(authorizer)
    return con


def extract_sql(text: str) -> str:
    """The SQL inside an answer: a ```sql fence if there is one, else the whole text. Trailing ';' removed."""
    fence = re.search(r"```(?:sql)?\s*(.*?)```", text or "", re.S | re.I)
    sql = (fence.group(1) if fence else text or "").strip()
    return sql.rstrip().rstrip(";").strip()


def run_sql(con: sqlite3.Connection, sql: str, row_limit: int | None, seconds: float = 5.0):
    """Run one read-only query. Returns (columns, rows). Stops queries that run longer than `seconds`."""
    sql = extract_sql(sql)
    if not sql:
        raise sqlite3.OperationalError("empty query")
    if ";" in sql:
        raise sqlite3.OperationalError("only one statement allowed")
    if row_limit:
        sql = f"SELECT * FROM ({sql}) LIMIT {int(row_limit)}"
    deadline = time.monotonic() + seconds
    con.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10_000)
    try:
        cursor = con.execute(sql)
        rows = cursor.fetchall()
        columns = [d[0] for d in cursor.description or []]
    finally:
        con.set_progress_handler(None, 0)
    return columns, rows


def _column_values(rows: list[tuple], i: int) -> list[tuple]:
    out = []
    for row in rows:
        v = row[i]
        if v is None or (isinstance(v, float) and math.isnan(v)):
            out.append((0, ""))
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            out.append((1, float(v)))
        else:
            out.append((2, str(v).strip().lower()))
    return sorted(out)


def _close(a: tuple, b: tuple) -> bool:
    if a[0] != b[0]:
        return False
    if a[0] == 1:
        return math.isclose(a[1], b[1], rel_tol=1e-3, abs_tol=0.05)
    return a[1] == b[1]


def same_result(want_rows: list[tuple], got_rows: list[tuple], width_want: int, width_got: int) -> bool:
    """Lenient result comparison, like a human checker:
    same number of rows, and every column of the correct answer appears somewhere in the answer
    (extra columns are fine; column names and row order don't matter; numbers may differ by rounding)."""
    if len(want_rows) != len(got_rows):
        return False
    got_columns = [_column_values(got_rows, j) for j in range(width_got)]
    for i in range(width_want):
        want = _column_values(want_rows, i)
        if not any(len(want) == len(g) and all(_close(a, b) for a, b in zip(want, g)) for g in got_columns):
            return False
    return True


def check_sql_result(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    database = params.get("database")
    if not database:
        raise SuiteError("sql_result needs 'database'")
    key = str(ctx.resolve(database))
    if key not in ctx.databases:
        ctx.databases[key] = _connect(Path(key))
    con = ctx.databases[key]
    limit = params.get("row_limit")
    expected_sql = _want(params, case)
    if not expected_sql:
        raise SuiteError(f"{case.id}: sql_result needs the correct SQL in 'expected'")
    cache_key = (key, expected_sql, limit)
    if cache_key not in ctx.expected_tables:
        ctx.expected_tables[cache_key] = run_sql(con, expected_sql, limit)
    want_columns, want_rows = ctx.expected_tables[cache_key]
    if not re.match(r"(?is)^\s*(select|with)\b", extract_sql(answer)):
        return _result("sql_result", False, f"the answer is not a SQL query: {_short(answer, 70)!r}")
    try:
        got_columns, got_rows = run_sql(con, answer, limit)
    except sqlite3.Error as e:
        return _result("sql_result", False, f"query failed: {_short(e, 100)}")
    ok = same_result(want_rows, got_rows, len(want_columns), len(got_columns))
    if ok:
        detail = f"same result ({len(got_rows)} rows)"
    elif len(got_rows) != len(want_rows):
        detail = f"{len(got_rows)} rows, expected {len(want_rows)}"
    else:
        detail = "different values"
    return _result("sql_result", ok, detail)


# ---------------------------------------------------------------- AI judge and custom checks

def check_judge(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    from . import judge  # imported here so the simple checks never need the judge code

    verdict = judge.score(answer, case, params)
    return _result("judge", verdict.passed, verdict.detail, score=verdict.normalised)


def check_python(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    spec = params.get("function", "")
    if ":" not in spec:
        raise SuiteError("a python check needs function: 'module:function'")
    module_name, name = spec.split(":", 1)
    value = getattr(importlib.import_module(module_name), name)(answer, case, params)
    if isinstance(value, tuple):
        ok, detail = value
        return _result("python", bool(ok), str(detail))
    if isinstance(value, bool):
        return _result("python", value, spec)
    score = float(value)
    threshold = float(params.get("threshold", 0.5))
    return _result("python", score >= threshold, f"{spec} = {score:.2f}", score=max(0.0, min(1.0, score)))


CHECKS = {
    "exact": check_exact,
    "contains": check_contains,
    "not_contains": check_not_contains,
    "regex": check_regex,
    "json": check_json,
    "number": check_number,
    "f1": check_f1,
    "max_length": check_max_length,
    "is_question": check_is_question,
    "sql_result": check_sql_result,
    "judge": check_judge,
    "python": check_python,
}


def run_check(answer: str, case: Case, params: dict, ctx: Context) -> CheckResult:
    kind = params.get("type")
    if kind not in CHECKS:
        raise SuiteError(f"unknown check type {kind!r}; use one of {', '.join(CHECKS)}")
    return CHECKS[kind](answer, case, params, ctx)
