import { ImageResponse } from "next/og";
import { site } from "@/lib/data";

export const alt = "Evalgate: catch the change that makes your LLM app worse, before it ships";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const worst = [...site.comparisons].sort((a, b) => b.newly_failing.length - a.newly_failing.length)[0];
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
  const line = worst
    ? `GATE ${worst.verdict === "FAIL" ? "FAILS" : "PASSES"}: "${worst.title}" takes a support bot from ${pct(worst.baseline.pass_rate)} to ${pct(worst.candidate.pass_rate)}, ${worst.newly_failing.length} answers broke`
    : "Tested on a support chatbot: 44 customer messages, 4 versions";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#ffffff", color: "#14171c", borderTop: "14px solid #f5b301", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#14171c", display: "flex", alignItems: "center",
            justifyContent: "center" }}>
            <svg width="44" height="44" viewBox="2 2 28 28">
              <path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5H9.5a1.5 1.5 0 0 1 1.5 1.5V28H4Z" fill="#ffffff" />
              <path d="M11 9H27.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H11Z" fill="#f5b301" />
              <path d="M16.5 9H20.5L17.5 16H13.5Z M24.5 9H28.5L25.5 16H21.5Z" fill="#14171c" />
              <circle cx="22" cy="23.5" r="4.5" fill="#ff5a5f" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>Evalgate</div>
          <div style={{ fontSize: 26, color: "#646b76", marginLeft: 8 }}>open-source LLM eval harness</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
            Catch the change that makes your LLM app worse, before it ships.
          </div>
          <div style={{ fontSize: 28, color: "#424954" }}>
            Fixed question sets, a regression gate in CI, and an AI judge checked against human labels
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ display: "flex", padding: "14px 20px", borderRadius: 12, background: worst?.verdict === "PASS" ? "#e5f4ea" : "#fdebe8", color: worst?.verdict === "PASS" ? "#15803d" : "#c42b1c", fontSize: 26, fontWeight: 600 }}>
            {line}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
