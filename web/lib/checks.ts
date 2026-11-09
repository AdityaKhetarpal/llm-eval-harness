// The rule-based Evalgate checks, ported from evalgate/checks.py so the playground runs in the browser.
// lib/checks.test.ts runs the same cases as tests/test_checks.py to keep the two in step.

export type CheckResult = { passed: boolean; score: number; detail: string };
export type Params = Record<string, unknown>;

const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;

export function normalise(text: unknown, ignoreCase = true, punctuation = false): string {
  let s = text === null || text === undefined ? "" : String(text);
  if (ignoreCase) s = s.toLowerCase();
  if (punctuation) s = s.replace(PUNCT, "");
  return s.split(/\s+/).filter(Boolean).join(" ").trim();
}

const asList = (v: unknown): unknown[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const short = (t: unknown, n = 80) => {
  const s = String(t).replace(/\n/g, " ");
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
};
const res = (passed: boolean, detail: string, score?: number): CheckResult => ({
  passed,
  score: score ?? (passed ? 1 : 0),
  detail,
});

export function numbersIn(text: string): number[] {
  return (text.match(/[-−]?\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((m) => Number(m.replace(/,/g, "").replace("−", "-")))
    .filter((n) => !Number.isNaN(n));
}

function tokens(text: string): string[] {
  return normalise(text, true, true).split(" ").filter((w) => w && !["a", "an", "the"].includes(w));
}

export function tokenF1(answer: string, expected: string): number {
  const got = tokens(answer);
  const want = tokens(expected);
  if (!got.length || !want.length) return got.length === want.length ? 1 : 0;
  const counts = new Map<string, number>();
  want.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));
  let common = 0;
  for (const w of got) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      common++;
      counts.set(w, c - 1);
    }
  }
  if (!common) return 0;
  const p = common / got.length;
  const r = common / want.length;
  return (2 * p * r) / (p + r);
}

const isClose = (a: number, b: number, rel: number, abs: number) => Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), abs);

function subset(want: unknown, got: unknown): boolean {
  if (Array.isArray(want)) return Array.isArray(got) && want.length === got.length && want.every((w, i) => subset(w, got[i]));
  if (want && typeof want === "object")
    return !!got && typeof got === "object" && !Array.isArray(got) &&
      Object.entries(want).every(([k, v]) => k in (got as object) && subset(v, (got as Record<string, unknown>)[k]));
  if (typeof want === "number" && typeof got === "number") return isClose(want, got, 1e-6, 1e-9);
  return want === got;
}

type Check = (answer: string, expected: unknown, p: Params) => CheckResult;

export const CHECKS: Record<string, { about: string; run: Check }> = {
  exact: {
    about: "The answer equals the expected text (case and extra spaces ignored).",
    run: (a, e, p) => {
      const options = asList(p.value ?? e);
      const ic = p.ignore_case !== false;
      const ok = options.some((o) => normalise(a, ic) === normalise(o, ic));
      return res(ok, ok ? "matches" : `got "${short(a)}", wanted "${short(options[0] ?? "")}"`);
    },
  },
  contains: {
    about: "The answer contains the expected phrase. Put one phrase per line to require several.",
    run: (a, e, p) => {
      const phrases = asList(p.value ?? e).map(String);
      const got = normalise(a);
      const found = phrases.filter((ph) => got.includes(normalise(ph)));
      const any = p.mode === "any";
      const ok = any ? found.length > 0 : found.length === phrases.length && phrases.length > 0;
      const missing = phrases.filter((ph) => !found.includes(ph));
      return res(ok, ok ? (any ? `found ${found.join(", ")}` : "found all") : `missing ${missing.map((m) => `"${short(m, 40)}"`).join(", ")}`,
        phrases.length ? found.length / phrases.length : 0);
    },
  },
  not_contains: {
    about: "The answer contains none of the phrases (e.g. \"As an AI\", a leaked secret).",
    run: (a, e, p) => {
      const phrases = asList(p.value ?? e).map(String);
      const got = normalise(a);
      const found = phrases.filter((ph) => got.includes(normalise(ph)));
      return res(found.length === 0, found.length ? `contains ${found.map((f) => `"${f}"`).join(", ")}` : "clean");
    },
  },
  regex: {
    about: "The answer matches a regular expression.",
    run: (a, e, p) => {
      const pattern = String(p.pattern ?? e ?? "");
      let ok: boolean;
      try {
        ok = new RegExp(pattern, "s").test(a);
      } catch {
        return res(false, "that pattern is not a valid regular expression");
      }
      return res(ok, `${ok ? "matched" : "no match"} /${short(pattern, 40)}/`);
    },
  },
  json: {
    about: "The answer is valid JSON. If an expected JSON is given, every expected key and value must be present.",
    run: (a, e) => {
      const fence = a.match(/```(?:json)?\s*([\s\S]*?)```/);
      let data: unknown;
      try {
        data = JSON.parse((fence ? fence[1] : a).trim());
      } catch {
        return res(false, "not valid JSON");
      }
      if (e !== undefined && e !== null && e !== "") {
        let want: unknown;
        try {
          want = typeof e === "string" ? JSON.parse(e) : e;
        } catch {
          return res(false, "the expected value is not valid JSON");
        }
        if (!subset(want, data)) return res(false, "values differ from expected");
        return res(true, "valid JSON, expected values present");
      }
      return res(true, "valid JSON");
    },
  },
  number: {
    about: "The number in the answer is within 1% of the expected number. Handles 1,23,456 and 12.5%.",
    run: (a, e, p) => {
      const want = Number(String(e).replace(/,/g, ""));
      if (Number.isNaN(want)) return res(false, "the expected value is not a number");
      const found = numbersIn(a);
      if (!found.length) return res(false, "no number in the answer");
      const rel = Number(p.rel_tol ?? 0.01);
      const best = found.reduce((x, y) => (Math.abs(y - want) < Math.abs(x - want) ? y : x));
      return res(isClose(best, want, rel, 0), `got ${best}, wanted ${want} (±${Math.round(rel * 100)}%)`);
    },
  },
  f1: {
    about: "Word-overlap F1 with the expected answer, like the SQuAD benchmark. Passes at 0.5 or more.",
    run: (a, e, p) => {
      const score = Math.max(0, ...asList(e).map((o) => tokenF1(a, String(o))));
      const t = Number(p.threshold ?? 0.5);
      return res(score >= t, `F1 ${score.toFixed(2)} (pass ≥ ${t.toFixed(2)})`, score);
    },
  },
  max_length: {
    about: "The answer is at most N characters (put the limit in Expected).",
    run: (a, e) => {
      const limit = Number(e || 500);
      return res(a.length <= limit, `${a.length} characters (limit ${limit})`);
    },
  },
  is_question: {
    about: "The answer is a clarifying question: it has a \"?\" and is not a SQL query.",
    run: (a) => {
      const q = a.includes("?");
      const looksLikeAnswer = /\bselect\b[\s\S]+\bfrom\b/i.test(a);
      const ok = q && !looksLikeAnswer;
      return res(ok, ok ? "asked a clarifying question" : looksLikeAnswer ? "answered instead of asking" : "no question mark");
    },
  },
};

export function runCheck(type: string, answer: string, expected: unknown, params: Params = {}): CheckResult {
  const check = CHECKS[type];
  if (!check) return res(false, `unknown check ${type}`);
  return check.run(answer ?? "", expected, params);
}
