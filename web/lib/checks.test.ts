import { describe, expect, it } from "vitest";
import { numbersIn, runCheck, tokenF1 } from "./checks";
import { kappaWords, pct, signedPct, site } from "./data";

// The same cases as tests/test_checks.py, so the browser playground behaves like the Python package
describe("checks (same cases as the Python tests)", () => {
  it("exact", () => {
    expect(runCheck("exact", "  New   Delhi ", "new delhi").passed).toBe(true);
    expect(runCheck("exact", "Delhi", "New Delhi").passed).toBe(false);
    expect(runCheck("exact", "Bombay", ["Mumbai", "Bombay"]).passed).toBe(true);
  });
  it("contains all / any", () => {
    expect(runCheck("contains", "Revenue was ₹5 lakh in Mumbai", null, { value: ["revenue", "mumbai"] }).passed).toBe(true);
    const r = runCheck("contains", "Revenue was high", null, { value: ["revenue", "mumbai"] });
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0.5);
    expect(runCheck("contains", "Revenue was high", null, { value: ["revenue", "mumbai"], mode: "any" }).passed).toBe(true);
  });
  it("not_contains", () => {
    expect(runCheck("not_contains", "Here is the answer", ["As an AI"]).passed).toBe(true);
    expect(runCheck("not_contains", "As an AI model I cannot", ["as an ai"]).passed).toBe(false);
  });
  it("regex", () => {
    expect(runCheck("regex", "Order #12345 confirmed", "#\\d{5}").passed).toBe(true);
    expect(runCheck("regex", "x", "(").passed).toBe(false);
  });
  it("json", () => {
    expect(runCheck("json", '```json\n{"name": "Asha", "age": 31}\n```', "").passed).toBe(true);
    expect(runCheck("json", "{not json}", "").passed).toBe(false);
    expect(runCheck("json", '{"a": 1, "b": {"c": 2.0}, "extra": true}', '{"a": 1, "b": {"c": 2}}').passed).toBe(true);
    expect(runCheck("json", '{"a": 2}', '{"a": 1}').passed).toBe(false);
  });
  it("numbers with Indian grouping", () => {
    expect(numbersIn("Revenue was ₹1,23,45,678.50 and 12.5% growth")).toEqual([12345678.5, 12.5]);
    expect(runCheck("number", "Total revenue: ₹1,23,456", 123000).passed).toBe(true);
    expect(runCheck("number", "Total revenue: ₹1,23,456", 100000).passed).toBe(false);
    expect(runCheck("number", "No idea", 5).passed).toBe(false);
  });
  it("f1", () => {
    expect(tokenF1("the capital is New Delhi", "New Delhi")).toBeCloseTo(0.667, 2);
    expect(runCheck("f1", "New Delhi is the capital", "New Delhi").passed).toBe(true);
    expect(runCheck("f1", "Mumbai", "New Delhi").passed).toBe(false);
  });
  it("max_length and is_question", () => {
    expect(runCheck("max_length", "short", 10).passed).toBe(true);
    expect(runCheck("is_question", "Do you mean revenue or orders?", "").passed).toBe(true);
    expect(runCheck("is_question", "SELECT city FROM customers -- which city?", "").passed).toBe(false);
    expect(runCheck("is_question", "Revenue is up.", "").passed).toBe(false);
  });
});

describe("site data (made by scripts/build_site_data.py)", () => {
  it("describes the support-bot exam", () => {
    expect(site.suite.cases).toBe(44);
    expect(site.suite.tags.reduce((n, t) => n + t.cases, 0)).toBe(44);
    expect(site.suite.reference_pass_rate).toBe(1);
    expect(site.policy).toContain("VOLTKART");
  });
  it("has consistent runs and comparisons", () => {
    for (const r of site.runs) {
      expect(r.cases).toHaveLength(44);
      expect(r.cases.filter((c) => c.passed)).toHaveLength(r.summary.passed);
    }
    const baseline = site.runs.find((r) => r.role === "baseline");
    for (const c of site.comparisons) {
      expect(c.baseline.label).toBe(baseline?.label);
      expect(["PASS", "FAIL"]).toContain(c.verdict);
      if (c.newly_failing.length > c.rules.max_new_failures) expect(c.verdict).toBe("FAIL");
    }
  });
  it("formats numbers", () => {
    expect(pct(0.575)).toBe("57.5%");
    expect(pct(0.8)).toBe("80%");
    expect(signedPct(-0.225)).toBe("−22.5 pts");
    expect(kappaWords(0.45)).toBe("moderate");
  });
});
