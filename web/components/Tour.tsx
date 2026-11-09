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

type Lenis = { scrollTo: (y: number, o?: { duration?: number; onComplete?: () => void }) => void };

// Scroll the page to y and call done once it has stopped (Lenis when it's running, otherwise the browser).
function scrollToY(y: number, done: () => void) {
  let called = false;
  const finish = () => {
    if (called) return;
    called = true;
    done();
  };
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
  if (lenis && !calm) lenis.scrollTo(y, { duration: 0.7, onComplete: finish });
  else {
    window.addEventListener("scrollend", finish, { once: true });
    window.scrollTo({ top: y, behavior: calm ? "auto" : "smooth" });
  }
  setTimeout(finish, 900); // in case no end event comes
}

export default function Tour() {
  const path = usePathname();
  const key = Object.keys(TOURS).find((k) => k === path) ?? (path.startsWith("/gate") ? "/gate" : "");
  const [steps, setSteps] = useState<Step[]>([]);
  const [at, setAt] = useState(-1);
  const [hint, setHint] = useState(false);
  // where the highlight and the note sit; the note is hidden while the page scrolls to the next step
  const [ring, setRing] = useState<React.CSSProperties | null>(null);
  const [card, setCard] = useState<React.CSSProperties>({});
  const [shown, setShown] = useState(false);
  const [view, setView] = useState(0); // the step the note is showing; it changes only while the note is hidden
  const [glide, setGlide] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const open = at >= 0;

  const close = useCallback(() => {
    setAt(-1);
    setHint(false);
    setShown(false);
    setRing(null);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  // move to another step: the note hides first, the effect below brings it back at the new spot
  const go = useCallback((i: number) => {
    setShown(false);
    setAt(i);
  }, []);

  const start = useCallback(() => {
    const list = (TOURS[key] ?? []).filter((s) => !s.el || document.querySelector(s.el));
    if (!list.length) return;
    setHint(false);
    setShown(false);
    setView(0);
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

  // measure the step's element and put the highlight on it and the note next to it
  const place = useCallback(() => {
    const s = steps[at];
    if (!s) return;
    const el = s.el ? document.querySelector(s.el) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(360, vw - 32);
    const ch = cardRef.current?.offsetHeight ?? 180;
    if (!el) {
      // no element: the highlight shrinks to nothing in the middle (so the whole page is dimmed) and the note sits there
      setRing({ top: vh / 2, left: vw / 2, width: 0, height: 0 });
      setCard({ top: Math.max(16, (vh - ch) / 2), left: (vw - cw) / 2 });
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    const below = r.bottom + pad + 12;
    const above = r.top - pad - 12 - ch;
    const top = below + ch < vh - 8 ? below : above > 8 ? above : Math.max(8, vh - ch - 8);
    setRing({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    setCard({ top, left: Math.min(Math.max(16, r.left), vw - cw - 16) });
  }, [at, steps]);

  // each step: hide the note, scroll the element into view (the highlight rides along with the page),
  // then show the note once the page has stopped. One movement per step, nothing chasing anything.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const s = steps[at];
    const el = s?.el ? document.querySelector(s.el) : null;
    const reveal = () => {
      if (!live) return;
      setView(at); // swap the text while the note is invisible
      requestAnimationFrame(() => {
        if (!live) return;
        setGlide(false);
        place(); // measured after the new text is in, so the note fits
        setShown(true);
        cardRef.current?.querySelector<HTMLButtonElement>("[data-next]")?.focus({ preventScroll: true });
      });
    };
    let needScroll = false;
    let y = 0;
    if (el) {
      const r = el.getBoundingClientRect();
      const tall = r.height > window.innerHeight * 0.6;
      needScroll = r.top < 80 || r.bottom > window.innerHeight - 40;
      y = window.scrollY + r.top - (tall ? 90 : 120);
    }
    const t = setTimeout(() => {
      if (!live) return;
      // same screen: the highlight glides to the new spot. Otherwise it jumps to the element and scrolls in with it.
      setGlide(!needScroll);
      place();
      if (needScroll) scrollToY(y, reveal);
      else setTimeout(reveal, 220);
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, at, steps, place]);

  useEffect(() => {
    if (!open) return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") {
        if (at < steps.length - 1) go(at + 1);
        else close();
      }
      if (e.key === "ArrowLeft" && at > 0) go(at - 1);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
      window.removeEventListener("keydown", keys);
    };
  }, [open, at, steps.length, place, close, go]);

  if (!TOURS[key]) return null;
  const s = steps[at];
  const v = steps[view] ?? s;
  const last = view === steps.length - 1;

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
          <div className={`tour-ring${glide ? " glide" : ""}${s.el ? "" : " empty"}`} style={ring ?? { top: "50%", left: "50%", width: 0, height: 0 }} />
          <div className={`tour-card${shown ? " in" : ""}`} ref={cardRef} style={card} role="dialog" aria-label="Guided tour">
            <button type="button" className="tour-x tour-close" aria-label="Close the tour" onClick={close}>×</button>
            <h3>{v.title}</h3>
            <p>{v.text}</p>
            <div className="tour-row">
              <span className="tour-dots" aria-label={`Step ${view + 1} of ${steps.length}`}>
                {steps.map((_, i) => <i key={i} className={i === view ? "on" : ""} />)}
              </span>
              {view > 0 && <button type="button" className="btn" onClick={() => go(view - 1)}>Back</button>}
              <button type="button" className="btn primary" data-next onClick={() => (last ? close() : go(view + 1))}>
                {last ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
