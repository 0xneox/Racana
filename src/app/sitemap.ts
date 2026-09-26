import { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();
  const routes = [
    { url: "/", lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: "/upload", lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.9 },
    { url: "/book-formatting", lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: "/kdp-formatting", lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: "/privacy", lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.3 },
    { url: "/terms", lastModified: new Date(), changeFrequency: "yearly" as const, priority: 0.3 },
  ];
  return routes.map((r) => ({ ...r, url: `${baseUrl}${r.url}` }));
}
