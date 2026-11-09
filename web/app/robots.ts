// robots.txt: every crawler, including AI search bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot),
// may read every page.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
