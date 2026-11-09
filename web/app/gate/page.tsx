import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import Code from "@/components/Code";
import GateView from "@/components/GateView";
import { pct, site, worstChange } from "@/lib/data";

export const metadata: Metadata = {
  title: "The gate: three LLM app changes it blocked",
  description: "Three real changes to a support chatbot (a friendlier prompt, a cheaper model, one extra rule) and why the Evalgate gate blocked each one.",
  alternates: { canonical: "/gate" },
};

export default function GatePage() {
  const worst = worstChange();
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">The gate</div>
        <h1>Three changes to the bot. Would you have shipped them?</h1>
        <p>
          Each change was compared with the live version on all {site.suite.cases} messages. The gate fails if the pass rate
          is below {pct(site.suite.gate.min_pass_rate)}, if it dropped at all, or if any answer that was right is now wrong.
          That last rule matters: a change can fix some answers and break others while the pass rate barely moves.
        </p>
      </div>
      {site.comparisons.length > 0 ? (
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <GateView comparisons={site.comparisons} />
        </Suspense>
      ) : (
        <p className="callout">The versions are answering the exam on GitHub right now. Results appear here when they finish.</p>
      )}
      <section className="section" style={{ marginTop: 48 }}>
        <div className="section-head">
          <h2>The same decision in CI</h2>
          <p>
            <code>evalgate gate</code> exits with code 1 when the gate fails, so the GitHub job goes red and the pull request
            can&apos;t be merged. The report above is also written to the job&apos;s summary page.
          </p>
        </div>
        <Code>{`
$ evalgate gate examples/support_bot/suite.yaml --baseline baselines/support-bot.json \\
    --outputs examples/support_bot/runs/${worst?.kind ?? "v2-3b"}.jsonl
## ${worst?.verdict === "PASS" ? "✅" : "❌"} Evalgate: ${worst?.verdict ?? "FAIL"} (support-bot)
${(worst?.reasons ?? []).map((r) => `- ${r}`).join("\n")}
$ echo $?
${worst?.verdict === "PASS" ? 0 : 1}
`}</Code>
      </section>
      <JsonLd data={breadcrumbLd("The gate", "/gate")} />
    </div>
  );
}
