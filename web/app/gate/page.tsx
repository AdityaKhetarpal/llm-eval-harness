import type { Metadata } from "next";
import { Suspense } from "react";
import Code from "@/components/Code";
import GateView from "@/components/GateView";
import { site } from "@/lib/data";

export const metadata: Metadata = { title: "The gate", description: "Three real changes to an AI agent and what the evalgate gate decided." };

export default function GatePage() {
  const upgrade = site.comparisons.find((c) => c.kind === "upgrade")!;
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">The gate</div>
        <h1>Three real changes. Would you have shipped them?</h1>
        <p>
          The gate compares a candidate run with the baseline (what is live) and fails if any rule breaks. The pass rate alone
          hides things: the upgrade below improved accuracy by {Math.round(upgrade.delta * 1000) / 10} points and still broke a
          question that used to work. The gate makes someone look at it before it ships.
        </p>
      </div>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <GateView comparisons={site.comparisons} />
      </Suspense>
      <section className="section" style={{ marginTop: 48 }}>
        <div className="section-head">
          <h2>The same decision in CI</h2>
          <p>
            <code>evalgate gate</code> exits with code 1 when the gate fails, so the GitHub job goes red and the pull request
            can&apos;t be merged. The report above is also written to the job&apos;s summary page.
          </p>
        </div>
        <Code>{`
$ evalgate gate examples/text_to_sql/suite.yaml --baseline baselines/text-to-sql.json \\
    --outputs examples/text_to_sql/runs/2026-10-19-1.5B.jsonl
## ❌ evalgate: FAIL (text-to-sql)
- pass rate 57.5% is below the minimum 75.0%
- pass rate dropped 22.5% (allowed: 0.0%)
- 10 case(s) that passed before now fail (allowed: 0)
$ echo $?
1
`}</Code>
      </section>
    </div>
  );
}
