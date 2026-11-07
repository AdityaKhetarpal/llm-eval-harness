"use client";

import { useState } from "react";
import { Dot } from "@/components/Verdict";
import { pct } from "@/lib/data";
import type { CaseRow, Run } from "@/lib/types";

type Filter = "all" | "fail" | "pass";

function CaseItem({ c }: { c: CaseRow }) {
  return (
    <details className="case">
      <summary>
        <Dot ok={c.passed} />
        <span className="mono small id">{c.id}</span>
        <span className="q">{c.input}</span>
        <span className="why">{c.why}</span>
      </summary>
      <div className="case-body">
        <div className="row">{c.tags.map((t) => <span key={t} className="tagchip">{t}</span>)}<span className="small muted">{c.why}</span></div>
        <div className="two">
          <div>
            <div className="kicker">Agent&apos;s answer</div>
            <pre className="sql">{c.output || "(empty)"}</pre>
          </div>
          {c.expected && (
            <div>
              <div className="kicker">Correct SQL</div>
              <pre className="sql">{c.expected}</pre>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export default function RunExplorer({ runs }: { runs: Run[] }) {
  const [label, setLabel] = useState(runs[runs.length - 1].label);
  const [filter, setFilter] = useState<Filter>("fail");
  const [level, setLevel] = useState("all");
  const [vague, setVague] = useState(false);
  const run = runs.find((r) => r.label === label)!;
  const source = vague ? run.clarify : run;
  const levels = Object.keys(run.summary.by_tag);
  const shown = source.cases.filter(
    (c) => (filter === "all" || (filter === "pass") === c.passed) && (vague || level === "all" || c.tags.includes(level)),
  );

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {runs.map((r) => (
          <button key={r.label} className="card stat" onClick={() => setLabel(r.label)} aria-pressed={r.label === label}
            style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", borderColor: r.label === label ? "var(--ink)" : undefined }}>
            <div className="kicker">{r.date} · commit {r.commit}</div>
            <div className="num">{pct(r.summary.pass_rate)}</div>
            <div className="label">{r.model}</div>
            <div className="sub">{r.summary.passed}/{r.summary.cases} right · asked back on {r.clarify.summary.passed}/{r.clarify.summary.cases} vague questions</div>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <div className="tabs" style={{ margin: 0 }} role="group" aria-label="Which questions">
          <button className="tab" aria-pressed={!vague} onClick={() => setVague(false)}>40 business questions</button>
          <button className="tab" aria-pressed={vague} onClick={() => setVague(true)}>5 vague questions</button>
        </div>
        <div className="tabs" style={{ margin: 0 }} role="group" aria-label="Filter">
          {(["fail", "pass", "all"] as Filter[]).map((f) => (
            <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "fail" ? "Failed" : f === "pass" ? "Passed" : "All"}
            </button>
          ))}
          {!vague && (
            <select aria-label="Question level" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: "auto", padding: "6px 10px" }}>
              <option value="all">All levels</option>
              {levels.map((l) => <option key={l} value={l}>{l} ({run.summary.by_tag[l].passed}/{run.summary.by_tag[l].cases})</option>)}
            </select>
          )}
        </div>
      </div>

      {vague && (
        <p className="callout" style={{ marginBottom: 14 }}>
          For a question like &quot;How are we doing?&quot; the right move is to ask back, not guess a metric. The check is
          rule-based: the reply must contain a question mark and must not be a SQL query.
        </p>
      )}
      <p className="small muted" style={{ marginBottom: 10 }}>{shown.length} shown</p>
      <div className="cases">
        {shown.map((c) => <CaseItem key={c.id} c={c} />)}
      </div>
    </>
  );
}
