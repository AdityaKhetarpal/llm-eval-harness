// Shapes of web/data/site.json, written by scripts/build_site_data.py (which runs evalgate itself)

export type TagStat = { passed: number; cases: number; pass_rate: number };

export type Summary = {
  cases: number;
  passed: number;
  failed: number;
  errors: number;
  pass_rate: number;
  mean_score: number;
  by_tag: Record<string, TagStat>;
  seconds: number;
};

export type CaseRow = {
  id: string;
  input: string;
  expected: string | null;
  output: string | null;
  tags: string[];
  passed: boolean;
  error: string | null;
  why: string;
};

export type Run = {
  label: string;
  date: string;
  model: string;
  commit: string;
  agent_reported_accuracy_pct: number;
  summary: Summary;
  cases: CaseRow[];
  clarify: { label: string; summary: Summary; cases: CaseRow[] };
};

export type Change = { id: string; input: string; tags: string[]; before: string | null; after: string | null; why: string };

export type Comparison = {
  kind: string;
  title: string;
  story: string;
  suite: string;
  baseline: { label: string; pass_rate: number; passed: number; cases: number };
  candidate: { label: string; pass_rate: number; passed: number; cases: number };
  delta: number;
  rules: { min_pass_rate: number; max_drop: number; max_new_failures: number };
  verdict: "PASS" | "FAIL";
  reasons: string[];
  newly_failing: Change[];
  newly_passing: Change[];
  still_failing: number;
  by_tag: Record<string, { before: number | null; after: number | null; cases: number | null }>;
};

export type PassFail = {
  n: number;
  agreement: number;
  kappa: number;
  bad_answers: number;
  bad_caught: number;
  bad_caught_rate: number | null;
  good_answers: number;
  good_wrongly_failed: number;
  bad_let_through: number;
  judge_pass_rate: number;
  human_pass_rate: number;
  majority_baseline: number;
};

export type Calibration = {
  file: string;
  name: string;
  description: string;
  judge_model: string;
  human_label: string;
  scale: [number, number] | null;
  labels: string[] | null;
  stats: {
    n: number;
    graded: number;
    unreadable: number;
    categories?: (string | number)[];
    agreement?: number;
    within_one?: number;
    kappa?: number;
    weighted_kappa?: number;
    spearman?: number | null;
    mean_human?: number;
    mean_judge?: number;
    confusion?: number[][];
    pass_at?: number;
    pass_fail?: PassFail;
  };
  human_distribution: Record<string, number>;
  judge_distribution: Record<string, number>;
  disagreements: { id: string; human: string | number; judge: string | number; question: string; answer: string }[];
};

export type Site = {
  generated_at: string;
  version: string;
  checks: string[];
  suite: { name: string; description: string; gate: Comparison["rules"]; cases: number };
  runs: Run[];
  comparisons: Comparison[];
  calibrations: Calibration[];
};
