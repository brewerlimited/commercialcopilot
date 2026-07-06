import type { MetadataRoute } from "next";

const siteUrl = "https://commercialcopilot.co.uk";

const publicRoutes = [
  "",
  "/pricing",
  "/contact",
  "/privacy",
  "/terms",
  "/disclaimer",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/pricing" || route === "/contact" ? 0.8 : 0.4,
  }));
}
