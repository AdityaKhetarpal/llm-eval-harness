// Shown for any address that doesn't exist (Next.js still sends a 404 status and noindex).
import Link from "next/link";
import { HUB_URL } from "@/lib/seo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">404</div>
        <h1>This page doesn&apos;t exist.</h1>
        <p>The address may be mistyped, or the page has moved. Try one of these:</p>
      </div>
      <ul className="list-plain">
        <li><Link href="/">Evalgate home</Link></li>
        <li><Link href="/docs">Docs: install Evalgate and gate your LLM app in CI</Link></li>
        <li><Link href="/gate">What the gate caught in the demo</Link></li>
        <li><Link href="/judge">Can an AI judge be trusted? The calibration results</Link></li>
        <li><a href={HUB_URL}>Other projects by Aditya Khetarpal</a></li>
      </ul>
    </div>
  );
}
