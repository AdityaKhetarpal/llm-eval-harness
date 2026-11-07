import raw from "@/data/site.json";
import type { Calibration, Comparison, Site } from "./types";

export const site = raw as unknown as Site;

export const REPO = "https://github.com/AdityaKhetarpal/llm-eval-harness";

export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? "–" : `${(x * 100).toFixed(digits).replace(/\.0$/, "")}%`;

export const signedPct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(1).replace(/\.0$/, "")} pts`;

export const tagName = (id: string) => site.suite.tags.find((t) => t.id === id)?.name ?? id;

export const baselineRun = () => site.runs.find((r) => r.role === "baseline");

/** The change that broke the most answers (for headlines). */
export const worstChange = (): Comparison | undefined =>
  [...site.comparisons].sort((a, b) => b.newly_failing.length - a.newly_failing.length)[0];

/** How to read a kappa value, in plain words (Landis & Koch bands). */
export function kappaWords(k: number | undefined | null): string {
  if (k === undefined || k === null) return "–";
  if (k < 0) return "worse than chance";
  if (k < 0.2) return "slight";
  if (k < 0.4) return "fair";
  if (k < 0.6) return "moderate";
  if (k < 0.8) return "substantial";
  return "almost perfect";
}

export const modelName = (m: string) => m.replace(/^local:/, "").replace(/^Qwen\//, "").replace(/-Instruct$/, "");

export const promptName = (p: string) => p.replace(/^prompts\//, "").replace(/\.txt$/, "");

export function calibrationsBySet(): { name: string; items: Calibration[] }[] {
  const groups = new Map<string, Calibration[]>();
  for (const c of site.calibrations) groups.set(c.name, [...(groups.get(c.name) ?? []), c]);
  return [...groups.entries()].map(([name, items]) => ({
    name,
    items: items.sort((a, b) => a.judge_model.localeCompare(b.judge_model)),
  }));
}
