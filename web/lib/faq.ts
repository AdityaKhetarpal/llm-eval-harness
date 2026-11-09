// The home page FAQ: questions people search about LLM evals, answered with this project's real results.
// The numbers come from data/site.json, so they change when the demo is re-run.
import { calibrationsBySet, kappaWords, pct, site, worstChange } from "@/lib/data";
import type { FaqItem } from "@/components/Faq";

export function evalgateFaq(): FaqItem[] {
  const worst = worstChange();
  const blocked = site.comparisons.filter((c) => c.verdict === "FAIL").length;
  const bestJudge = calibrationsBySet()
    .flatMap((s) => s.items)
    .filter((c) => c.stats.pass_fail)
    .sort((a, b) => b.stats.pass_fail!.kappa - a.stats.pass_fail!.kappa)[0];
  const k = bestJudge?.stats.pass_fail?.kappa;

  const items: FaqItem[] = [
    {
      q: "What is Evalgate?",
      a: "Evalgate is an open-source LLM eval harness: a small Python package, command-line tool and GitHub Action. It gives your AI app the same set of questions after every change, checks each answer automatically, and compares the score with the version that is live. If the new version is worse, the build fails and the change can't ship.",
    },
    {
      q: "How do I stop LLM regressions in GitHub Actions?",
      a: "Save a baseline run on your main branch, then run the same question set on every pull request and compare. Evalgate's gate fails the job (exit code 1) when the pass rate drops below a floor, falls by more than an allowed amount, or when any answer that used to pass now fails.",
    },
    {
      q: "Why check for newly failing answers, not just the pass rate?",
      a: "A change can fix three answers and break three others, leaving the pass rate the same while users lose something that worked. Evalgate's max_new_failures rule catches that case, which a pass-rate threshold alone misses.",
    },
    {
      q: "What can Evalgate check in an answer?",
      a: `There are ${site.checks.length} checks: ${site.checks.join(", ")}. A case passes only if all its checks pass, and you can write your own check as a Python function.`,
    },
    {
      q: "Which models and apps does it work with?",
      a: "It can replay saved answers (cheapest for CI), run a shell command, call a Python function, or call a model directly through OpenAI-compatible APIs (Groq, OpenRouter, vLLM, Ollama) or Anthropic. API keys are read from environment variables, never from the suite file.",
    },
    {
      q: "Is Evalgate free?",
      a: "Yes. It is MIT-licensed, has one dependency (PyYAML), and installs with pip from GitHub.",
    },
  ];

  if (worst) {
    items.splice(3, 0, {
      q: "What did the Evalgate demo catch?",
      a: `Three realistic changes were made to a demo support chatbot and each answered all ${site.suite.cases} test messages. The gate blocked ${blocked} of ${site.comparisons.length}. The riskiest, "${worst.title}", dropped the pass rate from ${pct(worst.baseline.pass_rate)} to ${pct(worst.candidate.pass_rate)} and broke ${worst.newly_failing.length} answers that used to be right.`,
    });
  }

  if (k !== undefined && bestJudge) {
    items.splice(4, 0, {
      q: "Can you trust an LLM-as-a-judge?",
      a: `Only after you measure it. Evalgate's calibrate command scores a judge on answers whose grade is already known and reports Cohen's kappa (agreement corrected for luck). In this project the best small free judge reached a pass/fail kappa of ${k.toFixed(2)} against human graders, "${kappaWords(k)}" agreement, which is too low to gate a build on.`,
    });
  }

  return items;
}
