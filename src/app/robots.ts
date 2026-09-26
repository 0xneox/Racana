import { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/s/", "/dashboard", "/settings", "/create", "/ready"],
      },
    ],
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
