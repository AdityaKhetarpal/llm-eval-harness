"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// A guided tour: a spotlight on one part of the page at a time, with a short note on what it shows.
// Every page has its own steps. A step whose element isn't on the page is skipped.
type Step = { el?: string; title: string; text: string };

const TOURS: Record<string, Step[]> = {
  "/": [
    { title: "What is Evalgate?", text: "An exam for AI apps. Every time someone changes a prompt or a model, the app answers the same fixed questions, each answer is checked automatically, and the change is blocked if anything got worse." },
    { el: ".gate-panel", title: "The idea in one picture", text: "Each square is one customer message. This is the riskiest real change: red squares are answers that were right before and broke, so the gate fails." },
    { el: "dl.facts", title: "The numbers", text: "The demo exam, how many changes the gate blocked, and how well a free AI judge agrees with people." },
    { el: "ul.skills", title: "The demo exam", text: "A support chatbot for Voltkart, a made-up store. 44 customer messages test six skills, from policy facts to prompt-injection attacks." },
    { el: ".card:has(.chart)", title: "Four versions, one exam", text: "Each bar is a version of the bot. All four really answered the 44 messages with a free model. The dashed line is the lowest pass rate the gate allows." },
    { el: ".section .grid.g2 > .grid", title: "Three changes, three verdicts", text: "A friendlier prompt, a cheaper model and one extra rule. Open any card to see exactly which answers broke." },
    { el: ".steps", title: "How you'd use it", text: "Write the exam in one YAML file, run it, and let the gate decide in CI. A judge check tells you whether an AI grader can be trusted." },
    { el: ".nav-links", title: "Explore", text: "The bot shows the prompts and policy, The gate shows each decision, Answers lists every reply, and Playground lets you try a check yourself." },
  ],
  "/bot": [
    { el: ".page-head", title: "The demo bot", text: "Voltkart is a made-up electronics store. Its chatbot reads a one-page policy and a prompt, then answers customers." },
    { el: ".table-wrap", title: "The four versions", text: "One live version and three changes. Each changed one thing: the prompt, the model, or one rule. Pass rate and speed are from the real runs." },
    { el: "pre.sql", title: "The store policy", text: "Everything the bot is allowed to know. A good answer sticks to this; a made-up policy counts as a failure." },
    { el: "details.case", title: "The prompts", text: "Open each one to compare. The friendlier rewrite dropped the rules list, and you can see what that cost on The gate page." },
  ],
  "/gate": [
    { el: ".page-head", title: "The gate", text: "Each change is compared with the live version on all 44 messages, then the gate decides: ship it, or block it." },
    { el: ".tabs", title: "Pick a change", text: "Switch between the three changes to see each decision." },
    { el: ".card:has(.gate-head)", title: "The verdict", text: "Pass rate before and after, and whether the gate passes. A change can look almost the same overall and still fail." },
    { el: ".table-wrap", title: "The three rules", text: "Fail if the pass rate is below the floor, if it dropped at all, or if any answer that was right is now wrong." },
    { el: ".cases", title: "What broke", text: "Every answer that used to be right, with what the live bot said, what the new version says, and why the check failed." },
  ],
  "/runs": [
    { el: ".page-head", title: "Every answer", text: "All 44 answers from each version, word for word, with the result of every check." },
    { el: ".grid.g4", title: "Pick a version", text: "Click a version to see its answers. The number is its pass rate." },
    { el: ".table-wrap", title: "Score by skill", text: "Where each version is strong or weak: policy facts, privacy, prompt injection and the rest." },
    { el: ".cases", title: "Open any answer", text: "Click a row to read the bot's reply and see which checks it passed or failed, and why." },
  ],
  "/judge": [
    { el: ".page-head", title: "Can an AI grade AI?", text: "Many teams let another AI mark answers. This page tests that idea against 100 answers already graded by people." },
    { el: ".callout", title: "The short answer", text: "How many bad answers each free judge caught, and whether it beat simply guessing the same grade every time." },
    { el: ".card:has(.cm)", title: "The details", text: "The grid shows where the judge and the people agreed (the diagonal) and where they didn't." },
  ],
  "/playground": [
    { el: ".page-head", title: "Try a check", text: "The same checks the exam uses, running in your browser. Nothing is sent anywhere." },
    { el: ".card.grid", title: "Your answer", text: "Pick a check, paste an answer and what you expected." },
    { el: ".card[aria-live]", title: "The result", text: "Pass or fail, and the exact lines to put the same check in your own exam file." },
  ],
  "/docs": [
    { el: ".page-head", title: "Get started", text: "Everything you need to add Evalgate to your own project." },
    { el: ".code", title: "Three commands", text: "Install it, create an example exam, and run it. The example has one wrong answer on purpose so you see a failure." },
    { el: ".table-wrap", title: "All 12 checks", text: "From exact text to JSON, numbers, SQL results and an AI judge." },
  ],
};

const SEEN_KEY = "evalgate-tour-seen";

function scrollToY(y: number) {
  const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis;
  if (lenis) lenis.scrollTo(y, { duration: 0.6 });
  else window.scrollTo({ top: y, behavior: "smooth" });
}

export default function Tour() {
  const path = usePathname();
  const key = Object.keys(TOURS).find((k) => k === path) ?? (path.startsWith("/gate") ? "/gate" : "");
  const [steps, setSteps] = useState<Step[]>([]);
  const [at, setAt] = useState(-1);
  const [hint, setHint] = useState(false);
  const [box, setBox] = useState<{ ring: React.CSSProperties; card: React.CSSProperties }>({ ring: {}, card: {} });
  const cardRef = useRef<HTMLDivElement>(null);
  const open = at >= 0;

  const close = useCallback(() => {
    setAt(-1);
    setHint(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  const start = useCallback(() => {
    const list = (TOURS[key] ?? []).filter((s) => !s.el || document.querySelector(s.el));
    if (!list.length) return;
    setHint(false);
    setSteps(list);
    setAt(0);
  }, [key]);

  // any button marked data-tour-start (e.g. in the home page hero) opens the tour
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-tour-start]")) start();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  // first visit to the home page: offer the tour (never forced)
  useEffect(() => {
    if (path !== "/") return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    const t = setTimeout(() => setHint(true), 1600);
    return () => clearTimeout(t);
  }, [path]);

  // leaving the page ends the tour
  useEffect(() => {
    const t = setTimeout(() => setAt(-1), 0);
    return () => clearTimeout(t);
  }, [path]);

  const place = useCallback(() => {
    if (at < 0 || !steps[at]) return;
    const s = steps[at];
    const el = s.el ? document.querySelector(s.el) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(360, vw - 32);
    const ch = cardRef.current?.offsetHeight ?? 180;
    if (!el) {
      setBox({ ring: { top: vh / 2, left: vw / 2, width: 0, height: 0 }, card: { top: Math.max(16, vh / 2 - ch / 2), left: (vw - cw) / 2 } });
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    const below = r.bottom + 16;
    const above = r.top - 16 - ch;
    const top = below + ch < vh ? below : above > 8 ? above : Math.max(8, vh - ch - 8);
    setBox({
      ring: { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 },
      card: { top, left: Math.min(Math.max(16, r.left), vw - cw - 16) },
    });
  }, [at, steps]);

  // bring the step's element into view, then place the spotlight and the note
  useEffect(() => {
    if (!open) return;
    const s = steps[at];
    const el = s?.el ? document.querySelector(s.el) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const tall = r.height > window.innerHeight * 0.6;
      if (r.top < 80 || r.bottom > window.innerHeight - 40) scrollToY(window.scrollY + r.top - (tall ? 90 : 120));
    }
    const t1 = setTimeout(place, 0);
    const t2 = setTimeout(place, 650);
    cardRef.current?.querySelector<HTMLButtonElement>("[data-next]")?.focus({ preventScroll: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, at, steps, place]);

  useEffect(() => {
    if (!open) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setAt((i) => (i < steps.length - 1 ? i + 1 : (close(), -1)));
      if (e.key === "ArrowLeft") setAt((i) => Math.max(0, i - 1));
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
      window.removeEventListener("keydown", keys);
    };
  }, [open, steps.length, place, close]);

  if (!TOURS[key]) return null;
  const s = steps[at];
  const last = at === steps.length - 1;

  return (
    <>
      {!open && (
        <button type="button" className="tour-fab" onClick={start} aria-label="Start a guided tour of this page">
          <i aria-hidden="true" />Guide
        </button>
      )}
      {hint && !open && (
        <div className="tour-hint" role="dialog" aria-label="Guided tour">
          <span>New here? A one-minute tour shows what this is.</span>
          <button type="button" className="btn primary" onClick={start}>Start</button>
          <button type="button" className="tour-x" aria-label="No thanks" onClick={close}>×</button>
        </div>
      )}
      {open && s && (
        <>
          <div className="tour-shade" onClick={close} />
          <div className="tour-ring" style={box.ring} />
          <div className="tour-card" ref={cardRef} style={box.card} role="dialog" aria-label="Guided tour">
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="tour-row">
              <span>{at + 1} / {steps.length}</span>
              <button type="button" className="tour-skip" onClick={close}>{last ? "Close" : "Skip"}</button>
              {at > 0 && <button type="button" className="btn" onClick={() => setAt(at - 1)}>Back</button>}
              <button type="button" className="btn primary" data-next onClick={() => (last ? close() : setAt(at + 1))}>
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
