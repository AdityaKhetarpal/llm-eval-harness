# evalgate: LLM eval harness

**Catch the change that makes your LLM app worse, before it ships.**

evalgate runs your AI app on a fixed set of questions, scores every answer, compares the result with what is live
today, and **fails the build** if anything got worse. It also measures whether an AI judge grades the way people do,
so you know which scores to trust.

**Live site:** https://llm-eval-harness-eight.vercel.app · **Install:** `pip install "git+https://github.com/AdityaKhetarpal/llm-eval-harness"`

[![CI](https://github.com/AdityaKhetarpal/llm-eval-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/AdityaKhetarpal/llm-eval-harness/actions/workflows/ci.yml)

---

## Why

Changing a prompt, a model or a retrieval setting is easy. Knowing whether it made things better is not. Teams look at a
handful of answers, it "seems fine", and it ships. evalgate turns that into a number and a rule:

1. **A suite**: questions, expected answers and checks, in one YAML file.
2. **A run**: every answer scored, saved as JSON.
3. **A gate**: compare with the baseline run; fail CI if the pass rate drops, falls below a floor, or **any question
   that worked now breaks**.
4. **A judge check**: before an AI judge is trusted in CI, measure its agreement with known grades.

## Tested on a real agent, not a toy

The examples use the real weekly runs of my [AI Data Analyst Agent](https://github.com/AdityaKhetarpal/ai-data-analyst-agent),
which turns business questions into SQL. Its answers for 40 questions are saved in its git history every week.
evalgate replays each saved run, **executes** the agent's SQL and the correct SQL on the shop database, and compares the results.

| What | Result |
|---|---|
| Verdicts matching the agent's own grading | **160 / 160** (4 runs × 40 questions, re-scored from scratch) |
| Old build shipped by mistake (19 Oct, 1.5B model, older prompt) | 80% → 57.5%, **10 questions broke → gate FAILS** |
| The 19 Oct upgrade (better prompt + 3B model) | 57.5% → 80% (+22.5 pts), but **q10 broke → gate FAILS** |
| Weekly re-run, nothing changed | 80% → 80%, nothing broke → gate PASSES |

The upgrade is the interesting one. Accuracy jumped 22.5 points, so a pass-rate threshold would wave it through.
But "How many orders were placed in each month of 2026?" stopped working: the new prompt made the agent filter
orders by status when the question asks for all orders. The gate made that visible.

## Quick start

```bash
pip install "git+https://github.com/AdityaKhetarpal/llm-eval-harness"
evalgate init evals                                         # an example suite + a stand-in app
evalgate run evals/suite.yaml --out evals/baseline.json     # save the baseline
evalgate gate evals/suite.yaml --baseline evals/baseline.json   # exit code 1 if the gate fails
evalgate run evals/suite.yaml --html report.html            # one-page HTML report
```

A suite:

```yaml
name: support-bot
target:
  type: python                  # replay | command | python | openai | anthropic | local
  function: my_app.chat:answer  # answer(question, case) -> str
checks:
  - type: not_contains
    value: ["As an AI", "sk-"]
  - type: max_length
    words: 150
gate:
  min_pass_rate: 0.9
  max_drop: 0.0
  max_new_failures: 0
cases:
  - id: refund-window
    input: How many days do I have to return a phone?
    expected: 7 days
    checks: [{type: contains}]
    tags: [policy]
```

### Checks

| Check | What it checks |
|---|---|
| `exact` | answer equals expected (case and spaces ignored) |
| `contains` / `not_contains` | phrases present / absent (leaks, refusals, banned words) |
| `regex` | matches (or must not match) a pattern |
| `json` | valid JSON, required keys, or equal to expected |
| `number` | the number in the answer is within a tolerance (reads `1,23,456` and `12.5%`) |
| `f1` | word-overlap F1 with expected, like SQuAD |
| `max_length` | at most N characters or words |
| `is_question` | a clarifying question rather than a guess |
| `sql_result` | **runs** the answer and the expected SQL on a read-only SQLite database, compares results |
| `judge` | an AI judge with your rubric (number scale or labels) |
| `python` | your own function |

### In GitHub Actions

```yaml
- uses: AdityaKhetarpal/llm-eval-harness@main
  with:
    suite: evals/suite.yaml
    baseline: evals/baseline.json
    outputs: evals/answers.jsonl   # optional: answers your app saved earlier in the job
```

The report (rules, pass rate per tag, which cases broke and why) goes to the job summary page.
This repo's own [CI](.github/workflows/ci.yml) runs the gate on every push and also checks that the gate **blocks**
the known 22.5-point regression.

## Can you trust an AI judge?

`evalgate calibrate` lets a judge grade answers whose correct grade is already known, and reports:

- exact agreement, **Cohen's kappa** (agreement corrected for luck), weighted kappa and Spearman;
- a confusion matrix;
- the pass/fail view: of the answers that should fail, **how many did the judge catch**?
- the score of always giving the more common verdict, which a useful judge has to beat.

Two calibration sets are included:

| Set | Standard | What it asks |
|---|---|---|
| `helpsteer2` | 100 answers from NVIDIA HelpSteer2 (CC-BY-4.0), graded 0–4 by human annotators, 20 per grade | Does the judge grade correctness like people? |
| `sql_judge` | 76 distinct SQL queries the agent wrote, labelled by **executing** them | Can a judge tell right SQL from wrong without running it? |

The [Calibrate workflow](.github/workflows/calibrate.yml) runs both with free local models (Qwen2.5 1.5B and 3B on the
runner's CPU, no API key) and publishes the results to the website's [Judge check](https://llm-eval-harness-eight.vercel.app/judge) page.

**Results (7 Nov 2026):**

| Set | Judge | Bad answers caught | Pass/fail agreement | Same-verdict baseline | Cohen's kappa |
|---|---|---|---|---|---|
| HelpSteer2 | Qwen2.5-1.5B | 3 / 60 | 42.4% | 60.6% | 0.04 |
| HelpSteer2 | Qwen2.5-3B | 20 / 60 | 54.0% | 60.0% | 0.16 (weighted κ 0.27 on the 0–4 scale) |
| SQL | Qwen2.5-1.5B | 6 / 21 | 61.8% | 72.4% | 0.03 |
| SQL | Qwen2.5-3B | 2 / 21 | 69.7% | 72.4% | 0.03 |

None of these judges is good enough to gate on. The 1.5B judge gave the top grade to 92 of 99 answers. Reading SQL,
both judges agreed with the truth *less* often than a judge that always says the same verdict. That is why the
text-to-SQL suite checks answers by running them, and why a judge should be calibrated before anyone trusts it.
The same specs can test a bigger model: add an `LLM_API_KEY` secret (e.g. a Groq key) and run the Calibrate workflow with engine `api`.

```bash
evalgate calibrate examples/judge_calibration/sql_judge.yaml --out result.json --cache grades.jsonl
```

## Project layout

```
evalgate/            the package (one dependency: PyYAML)
  suite.py           read a suite
  targets.py         get answers: replay, command, python function, OpenAI-compatible / Anthropic / local model
  checks.py          the 12 checks, including SQL execution
  judge.py           AI judge: rubric prompt, grade parsing
  runner.py          run a suite, save a run report
  compare.py         the gate
  calibrate.py       kappa, weighted kappa, Spearman, confusion matrix, pass/fail stats
  report.py          Markdown for GitHub, one-page HTML
  cli.py             the evalgate command
examples/            text_to_sql (real agent runs), judge_calibration, quickstart
baselines/           the saved runs CI compares against
scripts/             import the agent's runs, build the calibration sets, build the website data
tests/               47 tests (pytest)
action.yml           the reusable GitHub Action
web/                 the website (Next.js, deployed on Vercel); every number comes from scripts/build_site_data.py
```

## Development

```bash
pip install -e ".[dev]"
ruff check . && pytest -q
python scripts/build_site_data.py    # refresh the website data
cd web && npm ci && npm test && npm run build
```

Built by [Aditya Khetarpal](https://www.linkedin.com/in/adityakhetarpal). MIT licence.
