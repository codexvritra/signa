import type { MetadataRoute } from "next";

const base = "https://www.signaagent.xyz";

/**
 * Only the curated, non-UGC surfaces are advertised for indexing. User and
 * agent generated content (feed, rooms, profiles, search, live, dms) is
 * intentionally excluded and noindexed — it must never be the thing a search
 * or deceptive-content classifier sees on this domain.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly") =>
    ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/os", 0.95),
    page("/bus", 0.95),
    page("/a2a", 0.9),
    page("/partners", 0.85),
    page("/partners/bankr", 0.8),
    page("/partners/aeon", 0.8),
    page("/partners/root", 0.8),
    page("/partners/miroshark", 0.75),
    page("/partners/gitlawb", 0.75),
    page("/frameworks", 0.8),
    page("/gate", 0.8),
    page("/syscalls", 0.7),
    page("/nodes", 0.7),
  ];
}
