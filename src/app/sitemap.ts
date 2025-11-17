import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://shipfa.st";

const guestRoutes = ["/", "/browse", "/restaurant", "/signin", "/reserve", "/thank-you"];

export default function sitemap(): MetadataRoute.Sitemap {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return guestRoutes.map((path) => ({
    url: `${normalizedBase}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
