// Pass/fail is always shown as an icon AND a word, never colour alone

const Tick = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Cross = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);

export function Verdict({ ok, pass = "PASS", fail = "FAIL" }: { ok: boolean; pass?: string; fail?: string }) {
  return (
    <span className={`verdict ${ok ? "pass" : "fail"}`}>
      {ok ? <Tick /> : <Cross />}
      {ok ? pass : fail}
    </span>
  );
}

export function Dot({ ok }: { ok: boolean }) {
  return <span className={`dot ${ok ? "pass" : "fail"}`}>{ok ? "✓ pass" : "✗ fail"}</span>;
}
