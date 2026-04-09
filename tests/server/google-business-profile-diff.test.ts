import { describe, expect, it } from 'vitest';

import { summarizeGoogleBusinessProfileChanges } from '@/server/google-business-profile/diff';

import type { RestaurantGoogleBusinessProfileNormalized } from '@/lib/restaurants/google-business-profile';

function buildNormalized(
  overrides: Partial<RestaurantGoogleBusinessProfileNormalized> = {},
): RestaurantGoogleBusinessProfileNormalized {
  return {
    title: 'The Fox',
    description: 'Neighbourhood pub',
    primaryCategory: 'Pub',
    additionalCategories: ['Gastropub'],
    addressText: '1 High Street',
    locality: 'Cambridge',
    regionCode: 'GB',
    postalCode: 'CB1 2AB',
    placeId: 'place-1',
    openStatus: 'OPEN',
    primaryPhone: '+44 1234 567890',
    additionalPhones: [],
    websiteUri: 'https://thefox.example.com',
    mapsUri: 'https://maps.example.com/the-fox',
    reviewUri: 'https://reviews.example.com/the-fox',
    regularHoursSummary: ['MONDAY 12:00 - MONDAY 22:00'],
    moreHoursSummary: [],
    specialHoursSummary: [],
    attributeLabels: ['Outdoor seating: Yes'],
    serviceItems: ['Takeout'],
    rating: 4.5,
    reviewCount: 398,
    reviewSnippets: [],
    media: [],
    metrics30d: [
      {
        metric: 'WEBSITE_CLICKS',
        total: 84,
        startDate: '2026-03-08',
        endDate: '2026-04-06',
      },
    ],
    ...overrides,
  };
}

describe('summarizeGoogleBusinessProfileChanges', () => {
  it('returns a baseline-only summary when no previous snapshot exists', () => {
    const summary = summarizeGoogleBusinessProfileChanges(null, buildNormalized(), '2026-04-08T10:00:00Z');

    expect(summary).toEqual({
      generatedAt: '2026-04-08T10:00:00Z',
      hasBaseline: false,
      totalChanges: 0,
      remainingChanges: 0,
      highlights: [],
    });
  });

  it('captures important field, list, and metric changes between syncs', () => {
    const summary = summarizeGoogleBusinessProfileChanges(
      buildNormalized(),
      buildNormalized({
        description: 'Neighbourhood pub with garden dining',
        serviceItems: ['Delivery', 'Takeout'],
        reviewCount: 412,
        metrics30d: [
          {
            metric: 'WEBSITE_CLICKS',
            total: 96,
            startDate: '2026-03-09',
            endDate: '2026-04-07',
          },
          {
            metric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
            total: 242,
            startDate: '2026-03-09',
            endDate: '2026-04-07',
          },
        ],
      }),
      '2026-04-08T10:30:00Z',
    );

    expect(summary.hasBaseline).toBe(true);
    expect(summary.totalChanges).toBeGreaterThanOrEqual(4);
    expect(summary.highlights).toContainEqual(
      expect.objectContaining({
        key: 'description',
        family: 'location',
        kind: 'updated',
        before: 'Neighbourhood pub',
        after: 'Neighbourhood pub with garden dining',
      }),
    );
    expect(summary.highlights).toContainEqual(
      expect.objectContaining({
        key: 'serviceItems',
        family: 'attributes',
        kind: 'updated',
        before: 'Takeout',
        after: 'Delivery | Takeout',
      }),
    );
    expect(summary.highlights).toContainEqual(
      expect.objectContaining({
        key: 'reviewCount',
        family: 'reviews',
        kind: 'updated',
        before: '398',
        after: '412',
      }),
    );
    expect(summary.highlights).toContainEqual(
      expect.objectContaining({
        key: 'metric:BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
        family: 'performance',
        kind: 'added',
        before: null,
      }),
    );
  });
});
