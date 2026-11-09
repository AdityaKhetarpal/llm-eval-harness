import JsonLd from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import RunExplorer from "@/components/RunExplorer";
import { pct, site } from "@/lib/data";

export const metadata: Metadata = { title: "Answers", description: "Every answer from every version of the demo support bot, with each check's result.", alternates: { canonical: "/runs" } };

export default function RunsPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Answers</div>
        <h1>Every answer, every check</h1>
        <p>
          All {site.suite.cases} answers from each version of the <Link href="/bot">Voltkart support bot</Link>, exactly as the
          model wrote them, with the result of each check. To make sure the checks themselves are fair, a set of hand-written
          correct answers passes {pct(site.suite.reference_pass_rate)} of them, and a set of wrong answers is caught every time
          (both are in the repo&apos;s tests).
        </p>
      </div>
      <RunExplorer runs={site.runs} tags={site.suite.tags} />
      <JsonLd data={breadcrumbLd("Answers", "/runs")} />
    </div>
  );
}
