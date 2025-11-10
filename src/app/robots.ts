import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://shipfa.st";

export default function robots(): MetadataRoute.Robots {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/ops", "/ops/*", "/api", "/api/*"],
      },
    ],
    sitemap: `${normalizedBase}/sitemap.xml`,
  };
}
