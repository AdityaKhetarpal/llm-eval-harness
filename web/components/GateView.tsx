"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Verdict } from "@/components/Verdict";
import { pct, signedPct, tagName } from "@/lib/data";
import type { Change, Comparison } from "@/lib/types";

function ChangeList({ items, open }: { items: Change[]; open: boolean }) {
  return (
    <div className="cases">
      {items.map((c) => (
        <details key={c.id} className="case" open={open && items.length <= 3}>
          <summary>
            <span className="mono small id">{c.id}</span>
            <span className="tagchip">{tagName(c.tags[0])}</span>
            <span className="q">{c.input}</span>
            <span className="why">{c.why}</span>
          </summary>
          <div className="case-body">
            <div className="two">
              <div>
                <div className="kicker">Live version said</div>
                <pre className="sql">{c.before}</pre>
              </div>
              <div>
                <div className="kicker">New version says</div>
                <pre className="sql">{c.after}</pre>
              </div>
            </div>
            {c.why && <p className="small"><b>Why it fails:</b> {c.why}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function GateView({ comparisons }: { comparisons: Comparison[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const chosen = comparisons.find((c) => c.kind === params.get("c")) ?? comparisons[0];
  const c = chosen;
  const drop = c.baseline.pass_rate - c.candidate.pass_rate;
  const rules = [
    { name: "Minimum pass rate", limit: pct(c.rules.min_pass_rate), actual: pct(c.candidate.pass_rate), ok: c.candidate.pass_rate >= c.rules.min_pass_rate },
    { name: "Largest allowed drop", limit: pct(c.rules.max_drop), actual: drop > 0 ? pct(drop) : "no drop", ok: drop <= c.rules.max_drop + 1e-9 },
    { name: "Answers that may break", limit: String(c.rules.max_new_failures), actual: String(c.newly_failing.length), ok: c.newly_failing.length <= c.rules.max_new_failures },
  ];

  return (
    <>
      <div className="tabs" role="group" aria-label="Choose a change">
        {comparisons.map((x) => (
          <button key={x.kind} className="tab" aria-pressed={x.kind === c.kind}
            onClick={() => router.replace(`${path}?c=${x.kind}`, { scroll: false })}>
            {x.title}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="gate-head">
          <div style={{ maxWidth: 640 }}>
            <h2>{c.title}</h2>
            <p style={{ marginTop: 8 }}>{c.story}</p>
          </div>
          <Verdict ok={c.verdict === "PASS"} pass="GATE PASSES" fail="GATE FAILS" />
        </div>
        <div className="row" style={{ marginTop: 22, gap: 18, alignItems: "flex-end" }}>
          <div>
            <div className="kicker">Live version · {c.baseline.label}</div>
            <div className="bignum">{pct(c.baseline.pass_rate)}</div>
            <div className="small muted">{c.baseline.passed}/{c.baseline.cases} right</div>
          </div>
          <div className="arrow" aria-hidden="true">→</div>
          <div>
            <div className="kicker">New version · {c.candidate.label}</div>
            <div className="bignum">{pct(c.candidate.pass_rate)}</div>
            <div className="small muted">{c.candidate.passed}/{c.candidate.cases} right · {signedPct(c.delta)}</div>
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Gate rule</th><th className="num">Limit</th><th className="num">This change</th><th>Result</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{r.limit}</td>
                  <td className="num">{r.actual}</td>
                  <td><Verdict ok={r.ok} pass="OK" fail="BROKEN" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Skill</th><th className="num">Live</th><th className="num">New</th></tr></thead>
            <tbody>
              {Object.entries(c.by_tag).map(([tag, v]) => (
                <tr key={tag}>
                  <td>{tagName(tag)} <span className="muted small">({v.cases})</span></td>
                  <td className="num">{pct(v.before)}</td>
                  <td className="num">{pct(v.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {c.newly_failing.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 10 }}>{c.newly_failing.length} answer{c.newly_failing.length > 1 ? "s" : ""} that were right before and are now wrong</h3>
          <ChangeList items={c.newly_failing} open />
        </section>
      )}
      {c.newly_passing.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 10 }}>{c.newly_passing.length} answer{c.newly_passing.length > 1 ? "s" : ""} that got fixed</h3>
          <ChangeList items={c.newly_passing} open={false} />
        </section>
      )}
      {c.newly_failing.length === 0 && c.newly_passing.length === 0 && (
        <p className="callout" style={{ marginTop: 24 }}>
          Every answer got the same verdict as in the live version. {c.still_failing} fail in both: those are known gaps, not
          regressions, so they don&apos;t block the change.
        </p>
      )}
    </>
  );
}
