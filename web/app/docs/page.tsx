import type { Metadata } from "next";
import Code from "@/components/Code";
import { REPO } from "@/lib/data";

export const metadata: Metadata = { title: "Docs", description: "Install evalgate, write a suite, gate it in CI and calibrate an AI judge." };

const CHECKS: [string, string, string][] = [
  ["exact", "Answer equals expected (case and spaces ignored). A list means any of them.", "ignore_case, ignore_punctuation"],
  ["contains", "Answer contains the phrase, or all / any of several.", "value, mode: all|any"],
  ["not_contains", "Answer contains none of the phrases. Good for leaks, refusals, banned words.", "value"],
  ["regex", "Answer matches a regular expression.", "pattern, must_not_match"],
  ["json", "Valid JSON, optionally with required keys or equal to expected.", "required_keys, match_expected"],
  ["number", "The answer's number is within a tolerance of expected. Reads 1,23,456 and 12.5%.", "rel_tol, abs_tol, which"],
  ["f1", "Word-overlap F1 with expected (like SQuAD).", "threshold"],
  ["max_length", "At most N characters or words.", "chars, words"],
  ["is_question", "A clarifying question: has a \"?\" and isn't a SQL query.", "not_pattern"],
  ["sql_result", "Runs the answer and the expected SQL on a read-only SQLite database and compares results.", "database, row_limit"],
  ["judge", "An AI judge grades with your rubric on a number scale or with labels.", "provider, model, rubric, scale | labels, pass_at"],
  ["python", "Your own function: module:function(answer, case, params).", "function, threshold"],
];

export default function DocsPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Docs</div>
        <h1>Get started</h1>
        <p>evalgate is a small Python package (one dependency: PyYAML) with a command-line tool and a GitHub Action.</p>
      </div>
      <div className="prose">
        <h2>1. Install and make a first suite</h2>
        <Code>{`
pip install "git+https://github.com/AdityaKhetarpal/llm-eval-harness"
evalgate init evals          # writes evals/suite.yaml and a stand-in app
evalgate run evals/suite.yaml
`}</Code>
        <p>The example has one wrong answer on purpose, so you can see a failing case right away.</p>

        <h2>2. Write the suite</h2>
        <p>
          A suite is one YAML file: where the answers come from (<code>target</code>), the <code>checks</code>, the{" "}
          <code>gate</code> rules and the <code>cases</code>. Cases can be inline or in a <code>.jsonl</code> file. Paths are read
          relative to the suite file.
        </p>
        <Code>{`
name: support-bot
target:
  type: python                 # or: replay | command | openai | anthropic | local
  function: my_app.chat:answer # answer(question, case) -> str
  path: ..
checks:                        # applied to every case
  - type: not_contains
    value: ["As an AI", "sk-"]
  - type: max_length
    words: 150
gate:
  min_pass_rate: 0.9
  max_new_failures: 0
cases:
  - id: refund-window
    input: How many days do I have to return a phone?
    expected: 7 days
    checks: [{type: contains}]  # extra checks for this case
    tags: [policy]
`}</Code>

        <h3>Targets</h3>
        <ul>
          <li><b>replay</b>: answers already saved in a file. Your app runs once and the checks can be re-run for free. Best for CI.</li>
          <li><b>command</b>: runs a shell command per case; the input goes to stdin, stdout is the answer.</li>
          <li><b>python</b>: calls <code>module:function(input, case)</code>.</li>
          <li><b>openai / anthropic / local</b>: a model plus a system prompt. Works with any OpenAI-compatible API (Groq, OpenRouter, vLLM, Ollama). Keys are read from an environment variable named in <code>api_key_env</code>, never from the file.</li>
        </ul>

        <h3>Checks</h3>
        <p>A case passes only if all its checks pass.</p>
      </div>
      <div className="table-wrap" style={{ maxWidth: 980, marginTop: 14 }}>
        <table>
          <thead><tr><th>Check</th><th>What it checks</th><th>Options</th></tr></thead>
          <tbody>
            {CHECKS.map(([name, what, opts]) => (
              <tr key={name}><td className="mono">{name}</td><td>{what}</td><td className="mono small">{opts}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="prose">
        <h2>3. Gate it</h2>
        <p>Save today&apos;s run as the baseline, then compare every change against it. The command exits with code 1 when the gate fails.</p>
        <Code>{`
evalgate run evals/suite.yaml --out evals/baseline.json     # once, on main
evalgate gate evals/suite.yaml --baseline evals/baseline.json
evalgate compare old_run.json new_run.json --max-new-failures 0
evalgate run evals/suite.yaml --html report.html            # one-page report
`}</Code>
        <p>The gate fails when any of these rules break:</p>
        <ul>
          <li><code>min_pass_rate</code>: the new pass rate is below a floor.</li>
          <li><code>max_drop</code>: the pass rate fell more than this compared with the baseline.</li>
          <li><code>max_new_failures</code>: more than N cases that passed before now fail. This catches a change that fixes three things and breaks three others: same pass rate, but users lose something that worked.</li>
        </ul>

        <h3>In GitHub Actions</h3>
        <Code>{`
# .github/workflows/evals.yml
on: pull_request
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # run your app on the cases and save its answers to evals/answers.jsonl here
      - uses: AdityaKhetarpal/llm-eval-harness@main
        with:
          suite: evals/suite.yaml
          baseline: evals/baseline.json
          outputs: evals/answers.jsonl
`}</Code>
        <p>The report (pass rate, rules, which cases broke and why) is written to the job&apos;s summary page.</p>

        <h2>4. Calibrate an AI judge</h2>
        <p>
          A judge check is only as good as the judge. Before you gate on one, give it answers whose grade is already known and
          measure agreement. <code>evalgate calibrate</code> reports exact agreement, Cohen&apos;s kappa (agreement corrected for
          luck), weighted kappa and Spearman for number scales, a confusion matrix, and the pass/fail view: of the answers people
          failed, how many did the judge catch? It also shows the score you&apos;d get by always saying &quot;pass&quot;; a useful
          judge has to beat it.
        </p>
        <Code>{`
evalgate calibrate examples/judge_calibration/sql_judge.yaml --out result.json \\
  --cache grades.jsonl     # saves grades as they arrive, so a stopped run can resume
`}</Code>

        <h2>Python API</h2>
        <Code>{`
from evalgate import load_suite, run_suite, compare_runs

suite = load_suite("evals/suite.yaml")
run = run_suite(suite)
print(run["summary"]["pass_rate"])
result = compare_runs(baseline_run, run)
assert result["verdict"] == "PASS", result["reasons"]
`}</Code>
        <p style={{ marginTop: 24 }}>
          Source, tests and examples: <a href={REPO} target="_blank" rel="noreferrer">{REPO.replace("https://", "")}</a>
        </p>
      </div>
    </div>
  );
}
