// Search-engine and AI-assistant settings in one place:
// the site address, who built it, and the other projects to link to.
// Change HUB_URL here if the portfolio page moves.

export const SITE_URL = "https://evalgate-ak.vercel.app";
export const SITE_NAME = "Evalgate";

// the portfolio page about Aditya: every project links back to it
export const HUB_URL = "https://adityakhetarpal.vercel.app";

// the same person, described the same way on every site
export const AUTHOR = {
  name: "Aditya Khetarpal",
  jobTitle: "Data Analyst and AI Builder",
  location: "Delhi, India",
  url: HUB_URL,
  sameAs: [
    "https://www.linkedin.com/in/adityakhetarpal",
    "https://github.com/AdityaKhetarpal",
    "https://degenfinds.substack.com",
    "https://x.com/0xAditya_k",
  ],
};

// Aditya's other live projects (footer only; Evalgate's demo stays independent of them)
export const OTHER_PROJECTS = [
  { name: "UPI Merchant Discount Rate (MDR) Impact Simulator", text: "what India's 0.4% UPI fee costs a payment and raises in a year", url: "https://upi-mdr-simulator.vercel.app" },
  { name: "India KYC MCP", text: "MCP server that checks IFSC, PIN, GSTIN and PAN for AI assistants", url: "https://indiakyc.vercel.app" },
  { name: "AI Data Analyst Agent", text: "read-only, self-correcting text-to-SQL agent", url: "https://ai-data-analyst-agent-ten.vercel.app" },
];

// Person, as schema.org JSON-LD. The @id lets every site point at the same person.
export const PERSON_LD = {
  "@type": "Person",
  "@id": `${HUB_URL}/#person`,
  name: AUTHOR.name,
  jobTitle: AUTHOR.jobTitle,
  url: AUTHOR.url,
  address: { "@type": "PostalAddress", addressLocality: "Delhi", addressCountry: "IN" },
  sameAs: AUTHOR.sameAs,
};

// "Evalgate > Docs" trail, as schema.org JSON-LD
export function breadcrumbLd(pageName: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: pageName, item: `${SITE_URL}${path}` },
    ],
  };
}
