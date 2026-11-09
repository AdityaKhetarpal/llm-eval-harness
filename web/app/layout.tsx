import type { Metadata } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import Nav from "@/components/Nav";
import SmoothScroll from "@/components/SmoothScroll";
import Tour from "@/components/Tour";
import { REPO, site } from "@/lib/data";

const ONE_LINER =
  "Open-source LLM eval harness: test an AI app on a fixed question set, block regressions in CI, and check that your AI judge agrees with humans.";

export const metadata: Metadata = {
  metadataBase: new URL("https://evalgate-ak.vercel.app"),
  title: { default: "Evalgate · LLM eval harness", template: "%s · Evalgate" },
  description: ONE_LINER,
  openGraph: { title: "Evalgate · catch the change that makes your LLM app worse", description: ONE_LINER, type: "website" },
  twitter: { card: "summary_large_image", title: "Evalgate · LLM eval harness", description: ONE_LINER },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        <Nav />
        <main>{children}</main>
        <Tour />
        <footer>
          <div className="wrap row">
            <span>
              Evalgate {site.version} · built by{" "}
              <a href="https://www.linkedin.com/in/adityakhetarpal" target="_blank" rel="noreferrer">Aditya Khetarpal</a>
            </span>
            <span>
              <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a> · MIT licence · data built{" "}
              {site.generated_at.slice(0, 10)}
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
