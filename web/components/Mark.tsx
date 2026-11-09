// The Evalgate logo: a barrier gate. The arm is down and a red answer is held back,
// which is what the gate does to a change that makes the app worse.
// Shapes only, so it needs no font. Colours come from globals.css.
export default function Mark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="2 2 28 28" aria-hidden="true">
      <path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5H9.5a1.5 1.5 0 0 1 1.5 1.5V28H4Z" fill="var(--logo-post)" />
      <g className="mark-arm">
        <path d="M11 9H27.5a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H11Z" fill="var(--accent)" />
        <path d="M16.5 9H20.5L17.5 16H13.5Z M24.5 9H28.5L25.5 16H21.5Z" fill="var(--logo-stripe)" />
      </g>
      <circle className="mark-stop" cx="22" cy="23.5" r="4.5" fill="var(--logo-stop)" />
    </svg>
  );
}
