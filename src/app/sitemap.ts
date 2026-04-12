import { guestFacingSitemapEntries } from './guest-facing-pages';

import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://nabatable.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return guestFacingSitemapEntries.map((entry) => ({
    url: `${normalizedBase}${entry.href}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
