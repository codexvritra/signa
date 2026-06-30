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
    page("/messages", 0.99),
    page("/onchain", 0.96),
    page("/pay", 0.95),
    page("/signa", 0.95),
    page("/docs", 0.95),
    page("/docs/messaging", 0.85),
    page("/docs/brain", 0.85),
    page("/docs/budgets", 0.85),
    page("/docs/x402", 0.85),
    page("/docs/capabilities", 0.8),
    page("/docs/sdks", 0.85),
    page("/docs/verify", 0.8),
    page("/docs/transparency", 0.85),
    page("/network", 0.95),
    page("/economy", 0.9),
    page("/oracle", 0.9),
    page("/reputation", 0.9),
    page("/verified", 0.92),
    page("/spawn", 0.98),
    page("/jobs", 0.95),
    page("/social", 0.9),
    page("/aletheia", 0.97),
    page("/vera", 0.97),
    page("/os", 0.95),
    page("/bus", 0.95),
    page("/a2a", 0.9),
    page("/autonomy", 0.9),
    page("/x402", 0.9),
    page("/b20", 0.92),
    page("/b20live", 0.9),
    page("/telegram", 0.88),
    page("/brain", 0.85),
    page("/marketplace", 0.85),
    page("/capabilities", 0.8),
    page("/pipelines", 0.75),
    page("/swarm", 0.75),
    page("/realtime", 0.7),
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
