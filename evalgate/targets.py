"""
TARGETS: where the answers come from
------------------------------------
The "target" is the LLM app being tested. Evalgate does not care how it is built; it only needs
a way to get the app's answer for each case:

    type: replay     answers already saved in a file (JSONL lines {"id": ..., "output": ...}, or a JSON object id -> output).
                     Best for CI: the app runs once, its answers are saved, and the checks can be re-run for free.
    type: command    run a shell command per case. The case input goes to stdin; stdout is the answer.
                     Example: command: "python my_app.py"
    type: python     call a Python function `module:function(input, case) -> str`.
                     Example: function: "my_app.chat:answer"   (path: "." adds the suite folder to sys.path)
    type: openai     (or anthropic / local) a plain model + system prompt: the case input is the user message.
                     The prompt can come from a file: system_file: prompts/v1.txt, with system_vars: {policy: policy.md}
                     filling {policy} in it.

A target returns a function: case -> answer text.
"""
from __future__ import annotations

import importlib
import json
import shlex
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from . import llm
from .suite import Case, Suite, SuiteError

Answer = Callable[[Case], str]


def _load_replay(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SuiteError(f"replay file not found: {path}")
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".jsonl":
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
        return {str(r["id"]): r.get("output") for r in rows}
    data = json.loads(text)
    if isinstance(data, list):
        return {str(r["id"]): r.get("output") for r in data}
    return {str(k): v for k, v in data.items()}


class MissingAnswer(LookupError):
    pass


def build_system_prompt(suite: Suite, config: dict) -> str | None:
    """The system prompt for a model target: `system` text, or `system_file`.
    `system_vars` fills {placeholders} with the contents of other files, e.g. {policy: policy.md}."""
    if config.get("system_file"):
        text = suite.resolve(config["system_file"]).read_text(encoding="utf-8")
    else:
        text = config.get("system")
    if text is None:
        return None
    for name, file in (config.get("system_vars") or {}).items():
        text = text.replace("{" + name + "}", suite.resolve(file).read_text(encoding="utf-8").strip())
    return text


def make_target(suite: Suite, override: dict | None = None) -> tuple[Answer, str]:
    """Build the answer function for this suite. Returns (function, short description for the report)."""
    config = {**suite.target, **(override or {})}
    kind = config.get("type")
    if not kind:
        raise SuiteError("the suite needs a target (type: replay | command | python | openai | anthropic | local)")

    if kind == "replay":
        path = suite.resolve(config.get("file") or "")
        answers = _load_replay(path)

        def replay(case: Case) -> str:
            if case.id not in answers:
                raise MissingAnswer(f"no saved answer for case {case.id} in {path.name}")
            value = answers[case.id]
            return "" if value is None else str(value)

        return replay, f"replay:{path.name}"

    if kind == "command":
        command = config.get("command")
        if not command:
            raise SuiteError("a command target needs 'command'")
        timeout = float(config.get("timeout", 120))

        def run(case: Case) -> str:
            text = case.input if isinstance(case.input, str) else json.dumps(case.input)
            done = subprocess.run(
                shlex.split(command), input=text, capture_output=True, text=True,
                timeout=timeout, cwd=suite.folder, check=False,
            )
            if done.returncode != 0:
                raise RuntimeError(f"command exited with {done.returncode}: {done.stderr.strip()[:300]}")
            return done.stdout.strip()

        return run, f"command:{command}"

    if kind == "python":
        spec = config.get("function", "")
        if ":" not in spec:
            raise SuiteError("a python target needs function: 'module:function'")
        extra = config.get("path")
        if extra:
            folder = str(suite.resolve(extra))
            if folder not in sys.path:
                sys.path.insert(0, folder)
        module_name, function_name = spec.split(":", 1)
        function = getattr(importlib.import_module(module_name), function_name)

        def call(case: Case) -> str:
            return str(function(case.input, case))

        return call, f"python:{spec}"

    if kind in ("openai", "anthropic", "local", "fake"):
        settings = {**config, "provider": config.get("provider", kind)}
        system = build_system_prompt(suite, config)

        def ask(case: Case) -> str:
            messages = [{"role": "system", "content": system}] if system else []
            messages.append({"role": "user", "content": str(case.input)})
            return llm.chat(messages, settings)

        return ask, llm.describe(settings)

    raise SuiteError(f"unknown target type {kind!r}")
