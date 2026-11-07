import type { Metadata } from "next";
import RunExplorer from "@/components/RunExplorer";
import { AGENT_REPO, site } from "@/lib/data";

export const metadata: Metadata = { title: "Runs", description: "Every question of every saved run, with the agent's SQL, the correct SQL and the check result." };

export default function RunsPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Runs</div>
        <h1>Every answer, every check</h1>
        <p>
          Four saved runs of the <a href={AGENT_REPO} target="_blank" rel="noreferrer">AI Data Analyst Agent</a>, taken from its
          git history. Each answer was re-scored by evalgate: the agent&apos;s SQL and the correct SQL both run on the read-only shop
          database, and the results are compared. Column names and row order don&apos;t matter; small rounding differences are allowed.
        </p>
      </div>
      <RunExplorer runs={site.runs} />
    </div>
  );
}
