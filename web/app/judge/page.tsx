import type { Metadata } from "next";
import Code from "@/components/Code";
import Confusion from "@/components/Confusion";
import { Verdict } from "@/components/Verdict";
import { REPO, calibrationsBySet, kappaWords, modelName, pct } from "@/lib/data";
import type { Calibration } from "@/lib/types";

export const metadata: Metadata = {
  title: "Judge check",
  description: "How often does a small AI judge agree with human graders and with execution results?",
};

/** The verdict a lazy judge would give every time: whichever is more common in the truth labels. */
const baselineWord = (pf: { human_pass_rate: number }) => (pf.human_pass_rate >= 0.5 ? "pass" : "fail");

/** A plain-words recommendation, computed from the numbers (not written by hand per model). */
function advice(c: Calibration): { ok: boolean; text: string } {
  const pf = c.stats.pass_fail!;
  const caught = pf.bad_caught_rate ?? 0;
  if (pf.kappa >= 0.6 && caught >= 0.7) return { ok: true, text: "Good enough to gate on" };
  if (pf.kappa >= 0.4) return { ok: false, text: "Only with a person reviewing its fails" };
  return { ok: false, text: "Don't use it to gate" };
}

function JudgeCard({ c }: { c: Calibration }) {
  const st = c.stats;
  const pf = st.pass_fail!;
  const a = advice(c);
  const numeric = !c.labels;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="kicker">Judge</div>
          <h3 className="mono">{modelName(c.judge_model)}</h3>
        </div>
        <Verdict ok={a.ok} pass={a.text.toUpperCase()} fail={a.text.toUpperCase()} />
      </div>
      <div className="grid g3" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="num" style={{ fontSize: 28 }}>{pct(pf.agreement)}</div>
          <div className="label">pass/fail agreement</div>
          <div className="sub">always saying &quot;{baselineWord(pf)}&quot; would score {pct(pf.majority_baseline)}</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 28 }}>{pf.kappa.toFixed(2)}</div>
          <div className="label">Cohen&apos;s kappa ({kappaWords(pf.kappa)})</div>
          <div className="sub">agreement after removing luck; 0 = guessing</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 28 }}>{pf.bad_caught}/{pf.bad_answers}</div>
          <div className="label">bad answers caught</div>
          <div className="sub">{pf.bad_let_through} let through · {pf.good_wrongly_failed} good ones failed</div>
        </div>
      </div>
      {numeric && (
        <p className="small muted" style={{ marginTop: 14 }}>
          On the full 0–4 scale: exact grade {pct(st.agreement)}, within one point {pct(st.within_one)}, weighted kappa{" "}
          {st.weighted_kappa?.toFixed(2)}, Spearman {st.spearman?.toFixed(2) ?? "–"}. Average grade: people {st.mean_human}, judge{" "}
          {st.mean_judge}. Pass means a grade of {st.pass_at} or more.
        </p>
      )}
      {st.unreadable > 0 && <p className="small muted" style={{ marginTop: 6 }}>{st.unreadable} {st.unreadable === 1 ? "reply" : "replies"} could not be read as a grade and were left out.</p>}
      {st.confusion && st.categories && (
        <div style={{ marginTop: 16 }}>
          <Confusion matrix={st.confusion} categories={st.categories} rowTitle={c.human_label.startsWith("execution") ? "truth" : "people"} colTitle="judge" />
        </div>
      )}
      {c.disagreements.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="small" style={{ cursor: "pointer" }}>Biggest disagreements ({c.disagreements.length})</summary>
          <div className="cases" style={{ marginTop: 10 }}>
            {c.disagreements.map((d) => (
              <div key={d.id} className="card" style={{ padding: 12 }}>
                <p className="small mono" style={{ color: "var(--ink)" }}>{d.id} · truth {String(d.human)} · judge {String(d.judge)}</p>
                <p className="small" style={{ marginTop: 6 }}><b>Question:</b> {d.question}</p>
                <pre className="sql" style={{ marginTop: 6, maxHeight: 220, overflow: "auto" }}>{d.answer}</pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function JudgePage() {
  const sets = calibrationsBySet();
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Judge check</div>
        <h1>Can you trust an AI judge?</h1>
        <p>
          Many teams grade LLM answers with another LLM. That judge is a measuring instrument, and an instrument has to be
          checked against a known standard first. evalgate lets the judge grade answers whose correct grade is already known,
          and reports how often it agrees, corrected for luck.
        </p>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>People as the standard</h3>
          <p>
            100 answers from NVIDIA&apos;s HelpSteer2 dataset, each graded 0–4 for correctness by human annotators. 20 answers at
            each grade, so a judge can&apos;t look good by saying &quot;correct&quot; to everything.
          </p>
        </div>
        <div className="card">
          <h3>Facts as the standard</h3>
          <p>
            76 distinct SQL queries the agent wrote, each labelled by <b>running</b> it. The judge sees only the schema, the
            question and the query. Can it tell a right query from a wrong one without running it?
          </p>
        </div>
      </div>

      {sets.length === 0 && (
        <p className="callout" style={{ marginTop: 24 }}>
          The calibration runs on GitHub Actions with free local models (about 1–2 hours on a CPU). Results appear here when the
          run finishes. See the <a href={`${REPO}/actions/workflows/calibrate.yml`}>Calibrate workflow</a>.
        </p>
      )}

      {sets.length > 0 && (
        <div className="callout" style={{ marginTop: 24 }}>
          <b>What the numbers say</b>
          <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
            {sets.flatMap((s) => s.items.map((c) => {
              const pf = c.stats.pass_fail!;
              return (
                <li key={c.file}>
                  {s.name === "sql-judge" ? "Reading SQL" : "Grading correctness"}, {modelName(c.judge_model)}: caught{" "}
                  {pf.bad_caught} of {pf.bad_answers} bad answers, kappa {pf.kappa.toFixed(2)} ({kappaWords(pf.kappa)})
                  {pf.agreement < pf.majority_baseline
                    ? `. It agreed less often than always saying "${baselineWord(pf)}" would (${pct(pf.agreement)} vs ${pct(pf.majority_baseline)}).`
                    : "."}
                </li>
              );
            }))}
          </ul>
          {sets.every((s) => s.items.every((c) => !advice(c).ok)) && (
            <>
              No free judge here is good enough to gate on. That is why the text-to-SQL suite checks answers by{" "}
              <b>running</b> them, and why a judge should be calibrated before anyone trusts its scores.
            </>
          )}
        </div>
      )}

      {sets.map((s) => (
        <section key={s.name} className="section" style={{ marginTop: 32 }}>
          <div className="section-head">
            <h2>{s.name === "sql-judge" ? "Judging SQL without running it" : "Grading correctness like a person"}</h2>
            <p>{s.items[0].description}</p>
          </div>
          <div className="grid g2" style={{ alignItems: "start" }}>
            {s.items.map((c) => <JudgeCard key={c.file} c={c} />)}
          </div>
        </section>
      ))}

      <section className="section" style={{ marginTop: 32 }}>
        <div className="section-head">
          <h2>Run it on your own judge</h2>
          <p>Put answers with known grades in a JSONL file, write a short spec, and run one command.</p>
        </div>
        <Code>{`
# my_judge.yaml
name: support-answers
dataset: graded_answers.jsonl      # {"id", "question", "answer", "human": 0-4}
fields: {question: question, answer: answer, human: human}
judge:
  provider: openai
  base_url: https://api.groq.com/openai/v1
  model: llama-3.3-70b-versatile
  api_key_env: GROQ_API_KEY          # the key stays in an environment variable
  scale: [0, 4]
  rubric: "4 = fully correct ... 0 = wrong or made up"
pass_at: 3

$ evalgate calibrate my_judge.yaml --out judge_report.json
`}</Code>
      </section>
    </div>
  );
}
