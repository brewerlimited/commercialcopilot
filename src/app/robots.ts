import type { MetadataRoute } from "next";

const siteUrl = "https://commercialcopilot.co.uk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/contact", "/privacy", "/terms", "/disclaimer"],
      disallow: ["/app", "/app/", "/api", "/api/", "/login"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
