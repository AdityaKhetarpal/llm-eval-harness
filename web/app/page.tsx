import Link from "next/link";
import Code from "@/components/Code";
import PassRateChart from "@/components/PassRateChart";
import { Verdict } from "@/components/Verdict";
import { AGENT_REPO, AGENT_SITE, REPO, calibrationsBySet, kappaWords, latestRun, modelName, pct, signedPct, site, totalVerdicts } from "@/lib/data";

export default function Home() {
  const latest = latestRun();
  const rollback = site.comparisons.find((c) => c.kind === "rollback")!;
  const upgrade = site.comparisons.find((c) => c.kind === "upgrade")!;
  const sets = calibrationsBySet();
  const points = site.runs.map((r) => ({
    label: r.date.slice(5).replace("-", " / "),
    sub: r.model.includes("1.5B") ? "1.5B model" : "3B model",
    value: r.summary.pass_rate,
    passed: r.summary.passed,
    cases: r.summary.cases,
  }));
  const bestJudge = sets
    .flatMap((s) => s.items)
    .filter((c) => c.stats.pass_fail)
    .sort((a, b) => (b.stats.pass_fail!.kappa ?? 0) - (a.stats.pass_fail!.kappa ?? 0))[0];

  return (
    <>
      <section className="wrap hero">
        <div className="eyebrow">Open-source LLM eval harness · Python + GitHub Action</div>
        <h1>
          Catch the change that makes
          <br />
          your LLM app worse, before it ships.
        </h1>
        <p className="lede">
          evalgate runs your AI app on a fixed set of questions, scores every answer, compares the result with what
          is live today, and fails the build if anything got worse. It also measures whether an AI judge grades the way
          people do, so you know which scores to trust.
        </p>
        <div className="buttons">
          <Link className="btn primary" href="/gate">See the gate catch a real regression</Link>
          <a className="btn" href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <Link className="btn" href="/docs">Get started</Link>
        </div>
      </section>

      <section className="wrap">
        <div className="grid g4">
          <div className="card stat">
            <div className="num">{totalVerdicts()}/{totalVerdicts()}</div>
            <div className="label">verdicts match the agent&apos;s own grading</div>
            <div className="sub">4 real runs × 40 questions, re-scored from scratch</div>
          </div>
          <div className="card stat">
            <div className="num">{rollback.newly_failing.length}</div>
            <div className="label">broken questions caught when an old build is shipped</div>
            <div className="sub">{pct(rollback.baseline.pass_rate)} → {pct(rollback.candidate.pass_rate)}, gate fails</div>
          </div>
          <div className="card stat">
            <div className="num">{upgrade.newly_failing.length}</div>
            <div className="label">question broken by an upgrade that looked like pure gain</div>
            <div className="sub">{signedPct(upgrade.delta)} overall, but {upgrade.newly_failing[0]?.id} stopped working</div>
          </div>
          <div className="card stat">
            {bestJudge ? (
              <>
                <div className="num">{bestJudge.stats.pass_fail!.kappa.toFixed(2)}</div>
                <div className="label">best judge agreement (Cohen&apos;s kappa), {kappaWords(bestJudge.stats.pass_fail!.kappa)}</div>
                <div className="sub">{modelName(bestJudge.judge_model)} on {bestJudge.name}</div>
              </>
            ) : (
              <>
                <div className="num">{site.checks.length}</div>
                <div className="label">built-in checks, from exact match to SQL execution</div>
                <div className="sub">plus an AI judge you can calibrate</div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="wrap section" style={{ marginTop: 40 }}>
        <div className="section-head">
          <div className="eyebrow">Real data, not a demo</div>
          <h2>Tested on a real agent&apos;s weekly runs</h2>
          <p>
            My <a href={AGENT_SITE} target="_blank" rel="noreferrer">AI Data Analyst Agent</a> turns business questions into
            SQL. Every week it answers the same 40 questions and saves its answers in{" "}
            <a href={AGENT_REPO} target="_blank" rel="noreferrer">its repo</a>. evalgate replays each saved run, runs the
            agent&apos;s SQL and the correct SQL on the shop database, and compares the <b>results</b>, not the SQL text.
          </p>
        </div>
        <div className="grid g2" style={{ alignItems: "start" }}>
          <div className="card">
            <h3>Pass rate of each saved run</h3>
            <p className="small muted" style={{ marginBottom: 12 }}>Questions answered correctly, out of {latest.summary.cases}</p>
            <PassRateChart points={points} floor={site.suite.gate.min_pass_rate} />
          </div>
          <div className="grid">
            {site.comparisons.map((c) => (
              <Link key={c.kind} href={`/gate?c=${c.kind}`} className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3>{c.title}</h3>
                  <Verdict ok={c.verdict === "PASS"} />
                </div>
                <p style={{ marginTop: 6 }}>{c.story}</p>
                <p className="small mono" style={{ marginTop: 10, color: "var(--ink)" }}>
                  {pct(c.baseline.pass_rate)} → {pct(c.candidate.pass_rate)} · {c.newly_failing.length} broke ·{" "}
                  {c.newly_passing.length} fixed
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head">
          <div className="eyebrow">How it works</div>
          <h2>Four steps, one YAML file</h2>
        </div>
        <div className="steps">
          <div className="step card">
            <h3>Write a suite</h3>
            <p>Questions, expected answers and the checks to apply. Exact match, contains, regex, JSON, numbers, F1, SQL results, or an AI judge.</p>
          </div>
          <div className="step card">
            <h3>Run it</h3>
            <p>Point it at your app: a saved answers file, a shell command, a Python function, or any OpenAI-compatible model.</p>
          </div>
          <div className="step card">
            <h3>Gate it</h3>
            <p>Compare with the baseline run. Fail CI if the pass rate drops, falls below a floor, or any question that worked now breaks.</p>
          </div>
          <div className="step card">
            <h3>Trust the judge</h3>
            <p>Before an AI judge goes in CI, measure its agreement with human labels: kappa, confusion matrix, and how many bad answers it catches.</p>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="grid g2">
          <div>
            <div className="section-head">
              <div className="eyebrow">A suite</div>
              <h2>Readable by anyone on the team</h2>
              <p>This is the real suite behind the numbers above.</p>
            </div>
            <Code label="suite.yaml">{`
name: text-to-sql
target:
  type: replay
  file: runs/2026-11-05-3B.jsonl
checks:
  - type: sql_result        # run both queries, compare results
    database: shop.db
    row_limit: 200
gate:
  min_pass_rate: 0.75       # never ship below 75%
  max_drop: 0.0             # no drop vs the baseline
  max_new_failures: 0       # and nothing that worked may break
cases: cases.jsonl
`}</Code>
          </div>
          <div>
            <div className="section-head">
              <div className="eyebrow">In CI</div>
              <h2>Three lines in a GitHub workflow</h2>
              <p>The job fails on a regression and writes the report to the run&apos;s summary page.</p>
            </div>
            <Code label="workflow step">{`
- uses: AdityaKhetarpal/llm-eval-harness@main
  with:
    suite: evals/suite.yaml
    baseline: evals/baseline.json
`}</Code>
            <div style={{ height: 14 }} />
            <Code label="terminal">{`
# or from the terminal
pip install "git+https://github.com/AdityaKhetarpal/llm-eval-harness"
evalgate init evals
evalgate run evals/suite.yaml --out evals/baseline.json
evalgate gate evals/suite.yaml --baseline evals/baseline.json
`}</Code>
          </div>
        </div>
      </section>
    </>
  );
}
