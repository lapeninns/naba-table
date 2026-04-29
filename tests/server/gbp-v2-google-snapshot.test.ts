import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readGoogleSnapshot } from '@/server/google-business-profile-v2/snapshot/google';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';

const { readGoogleBusinessProfileBusinessInfo } = vi.hoisted(() => ({
  readGoogleBusinessProfileBusinessInfo: vi.fn(),
}));

vi.mock('@/server/google-business-profile/business-info', () => ({
  readGoogleBusinessProfileBusinessInfo,
}));

function businessInfo(
  overrides: Partial<GoogleBusinessProfileBusinessInfo> = {},
): GoogleBusinessProfileBusinessInfo {
  return {
    details: {
      businessName: 'Old Crown Girton',
      description: null,
      languageCode: null,
      openingDate: null,
      businessStatus: null,
      isServiceAreaBusiness: false,
      canReopen: null,
      source: 'gbp',
      managedBy: 'gbp',
      lastSyncedAt: null,
    },
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    coreNormalization: {
      operatingHours: {
        source: 'public',
        matchStatus: 'matched',
        summary: 'GBP regular public hours match Nabatable operating hours.',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'more_hours',
        matchStatus: 'matched',
        summary: 'GBP more hours match Nabatable lunch/dinner service periods.',
        warnings: [],
        periods: [],
      },
      bookingHours: {
        matchStatus: 'partial',
        summary: 'GBP can inform the outer booking envelope.',
        warnings: [],
        missingInputs: [],
      },
    },
    ...overrides,
  };
}

describe('readGoogleSnapshot', () => {
  beforeEach(() => {
    readGoogleBusinessProfileBusinessInfo.mockReset();
  });

  it('uses canonical lower-case Google link types stored by the GBP integration', async () => {
    readGoogleBusinessProfileBusinessInfo.mockResolvedValue(
      businessInfo({
        links: [
          {
            id: 'maps',
            linkType: 'google_map',
            linkStatus: 'current',
            label: 'Google Maps',
            url: 'https://maps.google.com/maps?cid=123',
            isPrimary: false,
            lastSyncedAt: null,
          },
          {
            id: 'review',
            linkType: 'google_review',
            linkStatus: 'current',
            label: 'Google reviews',
            url: 'https://search.google.com/local/writereview?placeid=abc',
            isPrimary: false,
            lastSyncedAt: null,
          },
        ],
      }),
    );

    const result = await readGoogleSnapshot({ client: {} as never, restaurantId: 'restaurant-1' });

    expect(result.canonical.profile.googleMapUrl).toBe('https://maps.google.com/maps?cid=123');
    expect(result.canonical.profile.googleReviewUrl).toBe(
      'https://search.google.com/local/writereview?placeid=abc',
    );
  });

  it('uses core-normalized public hours and meal service periods for V2 comparison', async () => {
    readGoogleBusinessProfileBusinessInfo.mockResolvedValue(
      businessInfo({
        hours: [
          {
            id: 'legacy-public-row',
            hoursType: 'public',
            periodLabel: null,
            periodCode: null,
            openDay: 0,
            closeDay: 0,
            startDate: null,
            endDate: null,
            openTime: '09:00',
            closeTime: '23:00',
            isClosed: false,
            lastSyncedAt: null,
          },
        ],
        coreNormalization: {
          operatingHours: {
            source: 'public',
            matchStatus: 'matched',
            summary: 'GBP regular public hours match Nabatable operating hours.',
            warnings: [],
            weekly: [
              {
                dayOfWeek: 0,
                opensAt: '12:00',
                closesAt: '21:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 1,
                opensAt: null,
                closesAt: null,
                isClosed: true,
                matchesCore: true,
              },
            ],
            overrides: [],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'matched',
            summary: 'GBP more hours match Nabatable lunch/dinner service periods.',
            warnings: [],
            periods: [
              {
                bookingOption: 'lunch',
                name: 'Lunch',
                dayOfWeek: 0,
                startTime: '12:00',
                endTime: '17:00',
                matchesCore: true,
              },
              {
                bookingOption: 'dinner',
                name: 'Dinner',
                dayOfWeek: 0,
                startTime: '17:00',
                endTime: '21:00',
                matchesCore: true,
              },
            ],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'GBP can inform the outer booking envelope.',
            warnings: [],
            missingInputs: [],
          },
        },
      }),
    );

    const result = await readGoogleSnapshot({ client: {} as never, restaurantId: 'restaurant-1' });

    expect(result.canonical.operatingHours.weekly).toEqual([
      { dayOfWeek: 0, opensAt: '12:00', closesAt: '21:00', isClosed: false },
      { dayOfWeek: 1, opensAt: null, closesAt: null, isClosed: true },
    ]);
    expect(result.canonical.servicePeriods.periods).toEqual([
      {
        stableKey: '0|12:00|17:00|lunch|lunch',
        name: 'Lunch',
        dayOfWeek: 0,
        startTime: '12:00',
        endTime: '17:00',
        bookingOption: 'lunch',
      },
      {
        stableKey: '0|17:00|21:00|dinner|dinner',
        name: 'Dinner',
        dayOfWeek: 0,
        startTime: '17:00',
        endTime: '21:00',
        bookingOption: 'dinner',
      },
    ]);
  });
});
