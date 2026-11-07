"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export type Cell = { id: string; label: string; state: "ok" | "broke" | "fixed" | "known" | "waiting"; group: number };

type Props = {
  cells: Cell[];
  verdict: "PASS" | "FAIL" | null;
  title: string;
  from: string;
  to: string;
  broke: number;
  fixed: number;
  href: string;
};

const STATE_WORDS: Record<Cell["state"], string> = {
  ok: "right in both versions",
  broke: "was right, now wrong",
  fixed: "was wrong, now right",
  known: "wrong in both versions",
  waiting: "waiting for an answer",
};

// The home page's opening picture: every exam question as one square, run through the gate.
// It plays once: the squares fill in, the broken ones turn red, and the barrier comes down.
export default function GateHero({ cells, verdict, title, from, to, broke, fixed, href }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const ready = verdict !== null;

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      // broken answers look fine until the gate checks them
      if (ready) el.classList.add("checking");
      const t = gsap.timeline({ delay: 0.15, onComplete: () => el.classList.remove("checking") });
      t.from(".gp-body .cell", { scale: 0, opacity: 0, duration: 0.35, ease: "back.out(2.4)", stagger: { each: 0.012, from: "start" } });
      if (ready) {
        t.call(() => el.classList.remove("checking"));
        t.fromTo(".gp-body .cell.broke", { scale: 1.5 }, { scale: 1, duration: 0.5, ease: "elastic.out(1.1,.45)", stagger: 0.04 }, "<");
        t.from(".hero-arm", { rotation: -68, svgOrigin: "11 12.5", duration: 0.55, ease: "bounce.out" }, "-=0.2");
        t.from(".gp-verdict", { scale: 1.6, opacity: 0, duration: 0.28, ease: "power4.in" }, "-=0.25");
      }
    }, el);
    return () => ctx.revert();
  }, [ready]);

  return (
    <div className="gate-panel" ref={root}>
      <div className="gp-head">
        <span className="gp-title">{ready ? title : "The exam"}</span>
        {ready ? (
          <span className={`gp-verdict ${verdict === "PASS" ? "pass" : "fail"}`}>{verdict === "PASS" ? "Gate passes" : "Gate fails"}</span>
        ) : (
          <span className="gp-verdict wait">Answers on the way</span>
        )}
      </div>
      <div className="gp-body">
        <svg className="hero-barrier" viewBox="2 2 28 28" aria-hidden="true">
          <path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5H9.5a1.5 1.5 0 0 1 1.5 1.5V28H4Z" fill="var(--logo-post)" />
          <g className="hero-arm" style={ready ? undefined : { transform: "rotate(-68deg)", transformOrigin: "11px 12.5px" }}>
            <path d="M11 9H27.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H11Z" fill="var(--accent)" />
            <path d="M16.5 9H20.5L17.5 16H13.5Z M24.5 9H28.5L25.5 16H21.5Z" fill="var(--logo-stripe)" />
          </g>
        </svg>
        <ol className="cells" aria-label={`${cells.length} exam questions`}>
          {cells.map((c) => (
            <li key={c.id} className={`cell ${c.state} g${c.group % 6}`} title={`${c.label}: ${STATE_WORDS[c.state]}`} />
          ))}
        </ol>
      </div>
      <div className="gp-foot">
        {ready ? (
          <>
            <span className="gp-nums">
              {from} <span aria-hidden="true">→</span> {to}
            </span>
            <span>
              <b className="t-fail">{broke} broke</b> · {fixed} fixed
            </span>
            <Link href={href}>See the answers</Link>
          </>
        ) : (
          <span>
            One square per customer message, coloured by skill. The four bot versions are answering them on GitHub now, and
            each square turns green or red when its answer is checked.
          </span>
        )}
      </div>
      {ready && (
        <ul className="gp-key" aria-label="Key">
          <li><i className="cell ok" />right both times</li>
          <li><i className="cell broke" />broke</li>
          <li><i className="cell fixed" />fixed</li>
          <li><i className="cell known" />wrong both times</li>
        </ul>
      )}
    </div>
  );
}
