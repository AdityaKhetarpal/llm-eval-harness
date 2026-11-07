"use client";

import { useState } from "react";
import { Verdict } from "@/components/Verdict";
import { CHECKS, runCheck } from "@/lib/checks";

const PRESETS: Record<string, { answer: string; expected: string }> = {
  exact: { answer: "  new delhi", expected: "New Delhi" },
  contains: { answer: "Revenue last month was ₹4,82,310 across 1,204 orders.", expected: "revenue\norders" },
  not_contains: { answer: "As an AI language model, I can't access your account.", expected: "As an AI\nI cannot" },
  regex: { answer: "Your ticket number is TKT-20931.", expected: "TKT-\\d{5}" },
  json: { answer: '```json\n{"city": "Pune", "orders": 182, "status": "ok"}\n```', expected: '{"city": "Pune", "orders": 182}' },
  number: { answer: "Total revenue was ₹1,23,456.70 in September.", expected: "123000" },
  f1: { answer: "The capital of Australia is Canberra, not Sydney.", expected: "Canberra" },
  max_length: { answer: "Short and sweet.", expected: "40" },
  is_question: { answer: "Do you mean revenue, units sold or number of orders?", expected: "" },
};

export default function Playground() {
  const [type, setType] = useState("contains");
  const [answer, setAnswer] = useState(PRESETS.contains.answer);
  const [expected, setExpected] = useState(PRESETS.contains.expected);
  const lists = ["contains", "not_contains", "exact"];
  const value: unknown = lists.includes(type) ? expected.split("\n").map((s) => s.trim()).filter(Boolean) : expected;
  const result = runCheck(type, answer, value);
  const yamlValue = lists.includes(type) && Array.isArray(value)
    ? (value.length > 1 ? `[${value.map((v) => JSON.stringify(v)).join(", ")}]` : JSON.stringify(value[0] ?? ""))
    : JSON.stringify(expected);

  function pick(t: string) {
    setType(t);
    setAnswer(PRESETS[t].answer);
    setExpected(PRESETS[t].expected);
  }

  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <div className="card grid" style={{ gap: 14 }}>
        <label>
          Check
          <select value={type} onChange={(e) => pick(e.target.value)}>
            {Object.keys(CHECKS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <p className="small muted">{CHECKS[type].about}</p>
        <label>
          The app&apos;s answer
          <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
        {type !== "is_question" && (
          <label>
            {lists.includes(type) ? "Expected (one per line)" : type === "regex" ? "Pattern" : type === "max_length" ? "Limit (characters)" : "Expected"}
            <textarea rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
        )}
      </div>
      <div className="grid" style={{ gap: 14 }}>
        <div className="card" aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>Result</h3>
            <Verdict ok={result.passed} />
          </div>
          <p style={{ marginTop: 10 }}>{result.detail}</p>
          <p className="small muted mono" style={{ marginTop: 8 }}>score {result.score.toFixed(2)}</p>
        </div>
        <div className="card">
          <div className="kicker">The same check in a suite</div>
          <pre className="sql">{`checks:\n  - type: ${type}${type === "regex" ? `\n    pattern: ${JSON.stringify(expected)}` : type === "max_length" ? `\n    chars: ${expected || 500}` : type === "not_contains" ? `\n    value: ${yamlValue}` : ""}\ncases:\n  - id: my-case\n    input: "..."${["regex", "max_length", "is_question", "not_contains"].includes(type) ? "" : `\n    expected: ${yamlValue}`}`}</pre>
          <p className="small muted" style={{ marginTop: 10 }}>
            Runs in your browser with the same rules as the Python package (both are tested on the same cases). The SQL and
            AI-judge checks need a database or a model, so they run in Python only.
          </p>
        </div>
      </div>
    </div>
  );
}
