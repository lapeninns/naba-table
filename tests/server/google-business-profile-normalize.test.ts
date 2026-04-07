import { describe, expect, it } from 'vitest';

import { normalizeGoogleBusinessProfileSnapshot } from '@/server/google-business-profile/normalize';

describe('normalizeGoogleBusinessProfileSnapshot', () => {
  it('maps core location, review, media, and metrics data into the shared landing-page shape', () => {
    const normalized = normalizeGoogleBusinessProfileSnapshot({
      location: {
        name: 'locations/123',
        title: 'The Fox',
        storefrontAddress: {
          addressLines: ['1 High Street'],
          locality: 'Cambridge',
          administrativeArea: 'Cambridgeshire',
          postalCode: 'CB1 2AB',
          regionCode: 'GB',
        },
        phoneNumbers: {
          primaryPhone: '+44 1234 567890',
          additionalPhones: ['+44 1234 567891'],
        },
        websiteUri: 'https://thefox.example.com',
        profile: {
          description: 'Popular neighbourhood pub with seasonal specials.',
        },
        primaryCategory: {
          displayName: 'Pub',
        },
        additionalCategories: [{ displayName: 'Restaurant' }],
        regularHours: {
          periods: [{ openDay: 'MONDAY', openTime: '12:00', closeDay: 'MONDAY', closeTime: '22:00' }],
        },
        metadata: {
          mapsUri: 'https://maps.example.com/the-fox',
          newReviewUri: 'https://reviews.example.com/the-fox',
        },
      },
      attributes: {
        attributes: [
          {
            displayName: 'Outdoor seating',
            values: [{ boolValue: true }],
          },
        ],
      },
      reviews: {
        averageRating: 4.7,
        totalReviewCount: 182,
        reviews: [
          {
            reviewId: 'review-1',
            starRating: 'FIVE',
            comment: 'Fantastic roast and warm service.',
            reviewer: { displayName: 'Local Guide' },
            createTime: '2026-03-01T12:00:00Z',
            updateTime: '2026-03-01T12:00:00Z',
          },
        ],
      },
      media: {
        mediaItems: [
          {
            name: 'media-1',
            mediaFormat: 'PHOTO',
            googleUrl: 'https://images.example.com/the-fox.jpg',
            thumbnailUrl: 'https://images.example.com/the-fox-thumb.jpg',
            description: 'Dining room',
            locationAssociation: { category: 'COVER' },
          },
        ],
      },
      performance: {
        multiDailyMetricTimeSeries: [
          {
            dailyMetricTimeSeries: [
              {
                dailyMetric: 'WEBSITE_CLICKS',
                timeSeries: {
                  datedValues: [
                    { date: { year: 2026, month: 3, day: 1 }, value: '4' },
                    { date: { year: 2026, month: 3, day: 2 }, value: '6' },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    expect(normalized).toMatchObject({
      title: 'The Fox',
      description: 'Popular neighbourhood pub with seasonal specials.',
      primaryCategory: 'Pub',
      additionalCategories: ['Restaurant'],
      addressText: '1 High Street, Cambridge, Cambridgeshire, CB1 2AB, GB',
      primaryPhone: '+44 1234 567890',
      websiteUri: 'https://thefox.example.com',
      mapsUri: 'https://maps.example.com/the-fox',
      reviewUri: 'https://reviews.example.com/the-fox',
      attributeLabels: ['Outdoor seating: Yes'],
      rating: 4.7,
      reviewCount: 182,
    });
    expect(normalized.reviewSnippets[0]).toMatchObject({
      reviewId: 'review-1',
      comment: 'Fantastic roast and warm service.',
    });
    expect(normalized.media[0]).toMatchObject({
      name: 'media-1',
      category: 'COVER',
      googleUrl: 'https://images.example.com/the-fox.jpg',
    });
    expect(normalized.metrics30d).toEqual([
      {
        metric: 'WEBSITE_CLICKS',
        total: 10,
        startDate: '2026-03-01',
        endDate: '2026-03-02',
      },
    ]);
  });
});
