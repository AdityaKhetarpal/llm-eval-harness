import { ImageResponse } from "next/og";
import { site } from "@/lib/data";

export const alt = "evalgate: catch the change that makes your LLM app worse, before it ships";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const rollback = site.comparisons.find((c) => c.kind === "rollback")!;
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#f5f4ef", color: "#1a1916", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#1a1916", display: "flex", alignItems: "center",
            justifyContent: "center" }}>
            <svg width="34" height="34" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#4cc386" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>evalgate</div>
          <div style={{ fontSize: 26, color: "#76736b", marginLeft: 8 }}>open-source LLM eval harness</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Catch the change that makes your LLM app worse, before it ships.
          </div>
          <div style={{ fontSize: 28, color: "#4a4843" }}>
            Fixed question sets, a regression gate in CI, and an AI judge checked against human labels
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", padding: "14px 20px", borderRadius: 12, background: "#fbe7e4", color: "#b42318", fontSize: 28, fontWeight: 600 }}>
            GATE FAILS: an old build drops accuracy from {pct(rollback.baseline.pass_rate)} to {pct(rollback.candidate.pass_rate)} and breaks {rollback.newly_failing.length} questions
          </div>
        </div>
      </div>
    ),
    size,
  );
}
