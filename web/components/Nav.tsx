"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/bot", label: "The bot" },
  { href: "/gate", label: "The gate" },
  { href: "/runs", label: "Answers" },
  { href: "/judge", label: "Judge check" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
];

export function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" />
      <path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand" aria-label="evalgate home">
          <Mark />
          <span>evalgate</span>
        </Link>
        <div className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
