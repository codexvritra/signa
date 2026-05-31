import type { MetadataRoute } from "next";

/**
 * Crawl policy. Marketing/positioning pages are crawlable; APIs are not.
 * UGC pages (feed, rooms, profiles, search, live, dms, me) are left
 * crawlable here ON PURPOSE so Google can re-crawl them, see the
 * `robots: noindex` on each, and drop them from the index — which removes
 * any spam/phishing a wallet may have posted from search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://www.signaagent.xyz/sitemap.xml",
    host: "https://www.signaagent.xyz",
  };
}
