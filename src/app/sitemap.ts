import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://shipfa.st";

const guestRoutes = [
  "/",
  "/browse",
  "/pricing",
  "/create",
  "/blog",
  "/blog/category",
  "/blog/author",
  "/privacy-policy",
  "/terms",
  "/signin",
  "/checkout",
  "/thank-you",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return guestRoutes.map((path) => ({
    url: `${normalizedBase}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
