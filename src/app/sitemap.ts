import type { MetadataRoute } from "next";
import { loadPrices } from "@/lib/prices";

const SITE = "https://cs2collector.lt";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await loadPrices();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/kainos`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/inventorius`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/apie`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const items: MetadataRoute.Sitemap = db.items.slice(0, 2000).map((i) => ({
    url: `${SITE}/skin/${encodeURIComponent(i.h)}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...items];
}
