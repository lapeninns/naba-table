import type { MetadataRoute } from 'next';

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.nabatable.com';

const guestRoutes = [
  '/',
  '/contact',
  '/restaurants',
  '/auth/signin',
  '/guest/dashboard',
  '/guest/bookings',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return guestRoutes.map((path) => ({
    url: `${normalizedBase}${path}`,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.4,
  }));
}
