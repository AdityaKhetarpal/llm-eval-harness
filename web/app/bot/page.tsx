import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { modelName, pct, promptName, site } from "@/lib/data";

export const metadata: Metadata = { title: "The bot", description: "The made-up store policy, the prompts and the four versions of the demo support bot.", alternates: { canonical: "/bot" } };

export default function BotPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">The demo bot</div>
        <h1>Voltkart&apos;s support chatbot</h1>
        <p>
          Voltkart is a made-up online electronics store in India, invented for this demo. Its chatbot gets the store policy
          and a prompt, and answers customer messages. Below are the policy, the prompts, and the four versions that took the
          exam.
        </p>
      </div>

      <h2 style={{ marginBottom: 14 }}>The four versions</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Version</th><th>What changed</th><th>Prompt</th><th>Model</th><th className="num">Pass rate</th><th className="num">Time per answer</th></tr></thead>
          <tbody>
            {site.runs.map((r) => (
              <tr key={r.label}>
                <td><b>{r.title}</b><div className="small muted mono">{r.label}</div></td>
                <td className="small">{r.change}</td>
                <td className="mono small">{promptName(r.prompt)}</td>
                <td className="mono small">{modelName(r.model)}</td>
                <td className="num">{pct(r.summary.pass_rate)}</td>
                <td className="num">{r.mean_seconds ? `${r.mean_seconds.toFixed(1)}s` : "–"}</td>
              </tr>
            ))}
            {site.runs.length === 0 && <tr><td colSpan={6} className="muted">Answers are being generated.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Answers were generated on a GitHub Actions runner (CPU only, no GPU) with greedy decoding, so the same version always
        gives the same answers. Time per answer is on that machine. <Link href="/runs">See every answer.</Link>
      </p>

      <div className="grid g2" style={{ marginTop: 32, alignItems: "start" }}>
        <div>
          <h2 style={{ marginBottom: 14 }}>The store policy</h2>
          <pre className="sql" style={{ maxHeight: 640, overflow: "auto" }}>{site.policy}</pre>
        </div>
        <div>
          <h2 style={{ marginBottom: 14 }}>The prompts</h2>
          <div className="grid">
            {Object.entries(site.prompts).map(([name, text]) => (
              <details key={name} className="case" open={name === "v1"}>
                <summary style={{ gridTemplateColumns: "60px minmax(0,1fr)" }}>
                  <span className="mono small">{name}</span>
                  <span className="q small">
                    {site.runs.filter((r) => promptName(r.prompt) === name).map((r) => r.title).join(" · ") || "prompt"}
                  </span>
                </summary>
                <div className="case-body">
                  <pre className="sql">{text.replace(/POLICY:\s*\{policy\}\s*$/, "POLICY:\n(the store policy is inserted here)")}</pre>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
      <JsonLd data={breadcrumbLd("The bot", "/bot")} />
    </div>
  );
}
