// /llms.txt: a short plain-text summary for AI tools, built from the same data as the website.
// It's an experiment (no search engine has said it uses llms.txt), but it costs nothing.
import { calibrationsBySet, kappaWords, pct, REPO, site, worstChange } from "@/lib/data";
import { SITE_URL, HUB_URL, AUTHOR } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const worst = worstChange();
  const blocked = site.comparisons.filter((c) => c.verdict === "FAIL").length;
  const best = calibrationsBySet().flatMap((s) => s.items).filter((c) => c.stats.pass_fail)
    .sort((a, b) => b.stats.pass_fail!.kappa - a.stats.pass_fail!.kappa)[0];
  const k = best?.stats.pass_fail?.kappa;

  const text = `# Evalgate: open-source LLM eval harness

> Evalgate tests an AI app on a fixed question set after every change, compares the result with the live version, and fails the build in CI when anything got worse. It also measures whether an AI judge agrees with human graders. Python package, CLI and GitHub Action, MIT licence. Built by ${AUTHOR.name} (${HUB_URL}).

Demo results (data built ${site.generated_at.slice(0, 10)}):
- A demo support chatbot answered ${site.suite.cases} test messages per version. The gate blocked ${blocked} of ${site.comparisons.length} realistic changes.${worst ? `\n- The riskiest change ("${worst.title}") dropped the pass rate from ${pct(worst.baseline.pass_rate)} to ${pct(worst.candidate.pass_rate)} and broke ${worst.newly_failing.length} answers.` : ""}${k !== undefined ? `\n- The best small free AI judge reached a pass/fail Cohen's kappa of ${k.toFixed(2)} against human graders (${kappaWords(k)} agreement): too low to gate a build on.` : ""}

## Pages
- [Home](${SITE_URL}/): what Evalgate does and what the demo caught
- [Docs](${SITE_URL}/docs): install, write a suite, gate it in GitHub Actions, calibrate an AI judge
- [The gate](${SITE_URL}/gate): the three changes and the gate's verdicts
- [Judge check](${SITE_URL}/judge): AI judge vs human graders, with kappa and confusion matrices
- [Source code](${REPO})
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
