"""
SUITE: what to test
-------------------
A suite is one YAML file:

    name: text-to-sql
    target:                      # where the answers come from (see targets.py)
      type: replay
      file: runs/latest.jsonl
    checks:                      # checks applied to EVERY case (a case can add its own)
      - type: sql_result
        database: shop.db
    gate:                        # when should CI fail? (see compare.py)
      min_pass_rate: 0.75
      max_drop: 0.0
      max_new_failures: 0
    cases:                       # inline list, or a path to a .jsonl / .json / .yaml file
      - id: q01
        input: How many customers do we have?
        expected: SELECT COUNT(*) FROM customers
        tags: [easy]

Relative paths (target files, databases, case files) are read relative to the suite file,
so a suite folder can be moved or copied as a whole.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

DEFAULT_GATE = {"min_pass_rate": 0.0, "max_drop": 0.0, "max_new_failures": 0}


class SuiteError(ValueError):
    """The suite file is not valid. The message says what to fix."""


@dataclass
class Case:
    id: str
    input: Any
    expected: Any = None
    tags: list[str] = field(default_factory=list)
    checks: list[dict] = field(default_factory=list)
    meta: dict = field(default_factory=dict)


@dataclass
class Suite:
    name: str
    path: Path | None
    cases: list[Case]
    checks: list[dict]
    target: dict
    gate: dict
    description: str = ""

    @property
    def folder(self) -> Path:
        return self.path.parent if self.path else Path.cwd()

    def resolve(self, value: str | Path) -> Path:
        """A path written in the suite, made relative to the suite's folder."""
        p = Path(value)
        return p if p.is_absolute() else (self.folder / p)


def _read_cases_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    if path.suffix == ".json":
        data = json.loads(text)
    else:
        data = yaml.safe_load(text)
    if isinstance(data, dict) and "cases" in data:
        data = data["cases"]
    if not isinstance(data, list):
        raise SuiteError(f"{path}: expected a list of cases")
    return data


def _make_case(raw: dict, number: int) -> Case:
    if not isinstance(raw, dict):
        raise SuiteError(f"case #{number}: each case must be a mapping with at least 'input'")
    if "input" not in raw:
        raise SuiteError(f"case #{number}: missing 'input'")
    known = {"id", "input", "expected", "tags", "checks"}
    tags = raw.get("tags") or []
    if isinstance(tags, str):
        tags = [tags]
    return Case(
        id=str(raw.get("id") or f"case-{number:03d}"),
        input=raw["input"],
        expected=raw.get("expected"),
        tags=[str(t) for t in tags],
        checks=list(raw.get("checks") or []),
        meta={k: v for k, v in raw.items() if k not in known},
    )


def build_suite(data: dict, path: Path | None = None) -> Suite:
    """Make a Suite from an already-parsed dict (handy in tests and notebooks)."""
    if not isinstance(data, dict):
        raise SuiteError("a suite must be a mapping (name, target, checks, cases)")
    folder = path.parent if path else Path.cwd()
    raw_cases = data.get("cases")
    if raw_cases is None:
        raise SuiteError("the suite has no 'cases'")
    if isinstance(raw_cases, str):
        raw_cases = _read_cases_file(folder / raw_cases)
    cases = [_make_case(c, i + 1) for i, c in enumerate(raw_cases)]
    ids = [c.id for c in cases]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise SuiteError(f"duplicate case ids: {', '.join(duplicates)}")
    checks = list(data.get("checks") or [])
    for c in checks + [ch for case in cases for ch in case.checks]:
        if not isinstance(c, dict) or "type" not in c:
            raise SuiteError(f"every check needs a 'type', got {c!r}")
    gate = {**DEFAULT_GATE, **(data.get("gate") or {})}
    return Suite(
        name=str(data.get("name") or (path.stem if path else "suite")),
        path=path,
        cases=cases,
        checks=checks,
        target=dict(data.get("target") or {}),
        gate=gate,
        description=str(data.get("description") or ""),
    )


def load_suite(path: str | Path) -> Suite:
    """Read a suite YAML file."""
    path = Path(path).resolve()
    if not path.exists():
        raise SuiteError(f"suite file not found: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return build_suite(data, path)
