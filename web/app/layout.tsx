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
import JsonLd from "@/components/JsonLd";
import { SITE_URL, SITE_NAME, HUB_URL, AUTHOR, OTHER_PROJECTS, PERSON_LD } from "@/lib/seo";

const ONE_LINER =
  "Open-source LLM eval harness: test an AI app on a fixed question set, block regressions in CI, and check that your AI judge agrees with humans.";

// Title, description and preview card used by Google and when the link is shared.
// Each page sets its own title, description and canonical address; "%s" is replaced by the page's title.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Evalgate · LLM eval harness", template: "%s · Evalgate" },
  description: ONE_LINER,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: HUB_URL }],
  creator: AUTHOR.name,
  openGraph: { title: "Evalgate · catch the change that makes your LLM app worse", description: ONE_LINER, type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image", title: "Evalgate · LLM eval harness", description: ONE_LINER, creator: "@0xAditya_k" },
};

// Who made the site and what it is, as structured data (read by search engines and AI assistants)
const SITE_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, inLanguage: "en", author: { "@id": PERSON_LD["@id"] } },
    PERSON_LD,
  ],
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
              <a href={HUB_URL} rel="author">{AUTHOR.name}</a>, {AUTHOR.jobTitle}, {AUTHOR.location}
            </span>
            <span>
              <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a> ·{" "}
              <a href="https://www.linkedin.com/in/adityakhetarpal" target="_blank" rel="noreferrer">LinkedIn</a> · MIT licence · data built{" "}
              {site.generated_at.slice(0, 10)}
            </span>
          </div>
          <div className="wrap footer-more-wrap">
            <p className="footer-more-title">More projects by {AUTHOR.name}</p>
            <ul className="footer-more">
              {OTHER_PROJECTS.map((p) => (
                <li key={p.url}>
                  <a href={p.url}>{p.name}</a>: {p.text}
                </li>
              ))}
            </ul>
          </div>
        </footer>
        <JsonLd data={SITE_LD} />
      </body>
    </html>
  );
}
