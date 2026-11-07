"use client";

import { useState } from "react";
import { Dot } from "@/components/Verdict";
import { modelName, pct, promptName } from "@/lib/data";
import type { CaseRow, Run, Tag } from "@/lib/types";

type Filter = "all" | "fail" | "pass";

function CaseItem({ c, tagNames }: { c: CaseRow; tagNames: Record<string, string> }) {
  return (
    <details className="case">
      <summary>
        <Dot ok={c.passed} />
        <span className="tagchip">{tagNames[c.tags[0]] ?? c.tags[0]}</span>
        <span className="q">{c.input}</span>
        <span className="why">{c.passed ? "" : c.why}</span>
      </summary>
      <div className="case-body">
        <div>
          <div className="kicker">The bot answered{c.seconds ? ` · ${c.seconds.toFixed(1)}s` : ""}</div>
          <pre className="sql">{c.output || "(empty)"}</pre>
        </div>
        <div>
          <div className="kicker">Checks</div>
          <div className="grid" style={{ gap: 4 }}>
            {c.checks.map((k, i) => (
              <div key={i} className="small row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "baseline" }}>
                <Dot ok={k.passed} />
                <span className="mono">{k.type}</span>
                <span className="muted" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{k.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

export default function RunExplorer({ runs, tags }: { runs: Run[]; tags: Tag[] }) {
  const [label, setLabel] = useState(runs[0]?.label ?? "");
  const [filter, setFilter] = useState<Filter>("fail");
  const [tag, setTag] = useState("all");
  const run = runs.find((r) => r.label === label);
  if (!run) return <p className="callout">Answers are being generated.</p>;
  const tagNames = Object.fromEntries(tags.map((t) => [t.id, t.name]));
  const shown = run.cases.filter((c) => (filter === "all" || (filter === "pass") === c.passed) && (tag === "all" || c.tags.includes(tag)));

  return (
    <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {runs.map((r) => (
          <button key={r.label} className="card stat" onClick={() => setLabel(r.label)} aria-pressed={r.label === label}
            style={{ textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", borderColor: r.label === label ? "var(--ink)" : undefined }}>
            <div className="kicker">{r.role === "baseline" ? "Live version" : "Change"} · {promptName(r.prompt)} · {modelName(r.model)}</div>
            <div className="num">{pct(r.summary.pass_rate)}</div>
            <div className="label">{r.title}</div>
            <div className="sub">{r.summary.passed}/{r.summary.cases} right{r.mean_seconds ? ` · ${r.mean_seconds.toFixed(1)}s per answer` : ""}</div>
          </button>
        ))}
      </div>

      <div className="table-wrap" style={{ marginBottom: 18 }}>
        <table>
          <thead><tr><th>Skill</th>{runs.map((r) => <th key={r.label} className="num">{r.role === "baseline" ? "Live" : r.label}</th>)}</tr></thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id}>
                <td>{t.name} <span className="muted small">({t.cases})</span></td>
                {runs.map((r) => {
                  const s = r.summary.by_tag[t.id];
                  return <td key={r.label} className="num">{s ? `${s.passed}/${s.cases}` : "–"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginBottom: 14, justifyContent: "space-between" }}>
        <div className="tabs" style={{ margin: 0 }} role="group" aria-label="Filter">
          {(["fail", "pass", "all"] as Filter[]).map((f) => (
            <button key={f} className="tab" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "fail" ? "Failed" : f === "pass" ? "Passed" : "All"}
            </button>
          ))}
        </div>
        <select aria-label="Skill" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: "auto", padding: "6px 10px" }}>
          <option value="all">All skills</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <p className="small muted" style={{ marginBottom: 10 }}>{shown.length} shown · {run.title}</p>
      <div className="cases">
        {shown.map((c) => <CaseItem key={c.id} c={c} tagNames={tagNames} />)}
      </div>
    </>
  );
}
