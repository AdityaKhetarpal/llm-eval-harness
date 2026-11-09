// sitemap.xml: the list of pages, with the date the demo data was last built,
// so search engines find every page and know when to come back.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { site } from "@/lib/data";

const PAGES = [
  { path: "", priority: 1 },
  { path: "/docs", priority: 0.9 },
  { path: "/gate", priority: 0.8 },
  { path: "/judge", priority: 0.8 },
  { path: "/bot", priority: 0.6 },
  { path: "/runs", priority: 0.6 },
  { path: "/playground", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(site.generated_at);
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: updated,
    changeFrequency: "monthly",
    priority: p.priority,
  }));
}
