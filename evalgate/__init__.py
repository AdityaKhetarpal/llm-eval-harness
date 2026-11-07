"""evalgate: test any LLM app against a fixed question set, block regressions in CI,
and check that your AI judge agrees with humans.

The pieces, in the order they are used:
    suite.py      read a test suite (YAML): the questions, the expected answers and the checks
    targets.py    get the app's answer for each question (replay a file, run a command, call a function or an API)
    checks.py     score one answer (exact match, contains, regex, JSON, number, SQL result, F1, AI judge ...)
    runner.py     run every question through the checks and save a run report (JSON)
    compare.py    compare a new run with a baseline run and decide PASS / FAIL (the gate)
    calibrate.py  measure how often an AI judge agrees with human labels (agreement, Cohen's kappa)
    report.py     turn a run or a comparison into Markdown (for GitHub) or a single HTML page
    cli.py        the `evalgate` command
"""

__version__ = "0.1.0"

from .compare import compare_runs  # noqa: E402
from .runner import run_suite  # noqa: E402
from .suite import load_suite  # noqa: E402

__all__ = ["load_suite", "run_suite", "compare_runs", "__version__"]
