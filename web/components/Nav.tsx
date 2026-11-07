"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Mark from "@/components/Mark";

const LINKS = [
  { href: "/bot", label: "The bot" },
  { href: "/gate", label: "The gate" },
  { href: "/runs", label: "Answers" },
  { href: "/judge", label: "Judge check" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand" aria-label="evalgate home">
          <Mark />
          <span>evalgate</span>
        </Link>
        <div className="nav-links" aria-label="Pages">
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
