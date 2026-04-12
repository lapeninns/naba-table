import { describe, expect, it } from 'vitest';

import {
  guestFacingPageCategories,
  guestFacingPages,
  guestFacingPagesByCategory,
  guestFacingSitemapEntries,
} from '@/app/guest-facing-pages';
import sitemap from '@/app/sitemap';

describe('guest-facing pages catalog', () => {
  it('assigns every tracked route to a known category', () => {
    const categoryIds = new Set(guestFacingPageCategories.map((category) => category.id));

    for (const page of guestFacingPages) {
      expect(categoryIds.has(page.categoryId)).toBe(true);
    }
  });

  it('keeps each category group aligned with the route catalog', () => {
    const groupedCount = guestFacingPagesByCategory.reduce(
      (total, category) => total + category.pages.length,
      0,
    );

    expect(groupedCount).toBe(guestFacingPages.length);
  });

  it('limits XML sitemap entries to explicitly indexed static routes', () => {
    expect(guestFacingSitemapEntries).toEqual([
      { href: '/', changeFrequency: 'weekly', priority: 1 },
      { href: '/restaurants', changeFrequency: 'weekly', priority: 0.9 },
      { href: '/bookings', changeFrequency: 'monthly', priority: 0.7 },
      { href: '/contact', changeFrequency: 'yearly', priority: 0.5 },
      { href: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
      { href: '/site-map', changeFrequency: 'monthly', priority: 0.4 },
    ]);
  });

  it('builds the Next.js sitemap from the shared catalog', () => {
    const entries = sitemap();

    expect(entries).toEqual([
      {
        url: 'https://nabatable.com/',
        changeFrequency: 'weekly',
        priority: 1,
      },
      {
        url: 'https://nabatable.com/restaurants',
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: 'https://nabatable.com/bookings',
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://nabatable.com/contact',
        changeFrequency: 'yearly',
        priority: 0.5,
      },
      {
        url: 'https://nabatable.com/privacy',
        changeFrequency: 'yearly',
        priority: 0.4,
      },
      {
        url: 'https://nabatable.com/site-map',
        changeFrequency: 'monthly',
        priority: 0.4,
      },
    ]);
  });
});
