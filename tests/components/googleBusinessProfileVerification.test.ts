import { describe, expect, it } from 'vitest';

import {
  deriveOperatingHoursRowComparisons,
  deriveServicePeriodDayComparisons,
} from '@/components/features/restaurant-settings/googleBusinessProfileVerification';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

function buildConnection(overrides?: Partial<GoogleBusinessProfileConnection>): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    connectedGoogleEmail: 'owner@example.com',
    connectedGoogleName: 'Owner',
    externalAccountId: 'acct-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'loc-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Old Crown Girton',
    externalPlaceId: 'place-1',
    lastPullAt: '2026-04-18T12:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {
      details: null,
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
          matchStatus: 'drifted',
          summary: 'GBP regular public hours differ from Nabatable operating hours.',
          warnings: [],
          weekly: [],
          overrides: [],
        },
        servicePeriods: {
          source: 'more_hours',
          matchStatus: 'drifted',
          summary: 'GBP meal-like more hours differ from Nabatable lunch/dinner service periods.',
          warnings: [],
          periods: [],
        },
        bookingHours: {
          matchStatus: 'partial',
          summary:
            'GBP can inform the outer booking envelope, but full booking hours still depend on Nabatable-only slot, interval, and duration settings.',
          warnings: [],
          missingInputs: [],
        },
      },
    },
    ...overrides,
  };
}

describe('google business profile verification helpers', () => {
  it('builds row-level operating-hours comparisons from normalized GBP hours', () => {
    const connection = buildConnection({
      businessInfo: {
        details: null,
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
            matchStatus: 'drifted',
            summary: 'GBP regular public hours differ from Nabatable operating hours.',
            warnings: [],
            weekly: [
              {
                dayOfWeek: 0,
                opensAt: '12:00',
                closesAt: '21:00',
                isClosed: false,
                matchesCore: false,
              },
            ],
            overrides: [
              {
                effectiveDate: '2026-04-03',
                opensAt: '12:00',
                closesAt: '23:00',
                isClosed: false,
                matchesCore: true,
              },
            ],
          },
          servicePeriods: {
            source: 'unavailable',
            matchStatus: 'unavailable',
            summary: 'Unavailable',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            missingInputs: [],
          },
        },
      },
    });

    const comparisons = deriveOperatingHoursRowComparisons({
      weekly: [
        {
          dayOfWeek: 0,
          opensAt: '12:00',
          closesAt: '22:00',
          isClosed: false,
        },
      ],
      overrides: [
        {
          effectiveDate: '2026-04-03',
          opensAt: '12:00',
          closesAt: '23:00',
          isClosed: false,
        },
      ],
      connection,
    });

    expect(comparisons.weeklyByDay[0]).toMatchObject({
      status: 'drifted',
      tooltipLines: ['GBP storefront hours: 12:00 – 21:00'],
    });
    expect(comparisons.overridesByDate['2026-04-03']).toMatchObject({
      status: 'verified',
      tooltipLines: ['GBP special hours: 12:00 – 23:00'],
    });
  });

  it('marks split kitchen windows as verified service periods when they match core day windows', () => {
    const connection = buildConnection({
      businessInfo: {
        details: null,
        addresses: [],
        phoneNumbers: [],
        links: [],
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        hours: [
          {
            id: 'h1',
            hoursType: 'service',
            periodLabel: 'Kitchen',
            periodCode: 'KITCHEN',
            openDay: 2,
            closeDay: 2,
            startDate: null,
            endDate: null,
            openTime: '12:00',
            closeTime: '15:00',
            isClosed: false,
            lastSyncedAt: null,
            verificationStatus: null,
          },
          {
            id: 'h2',
            hoursType: 'service',
            periodLabel: 'Kitchen',
            periodCode: 'KITCHEN',
            openDay: 2,
            closeDay: 2,
            startDate: null,
            endDate: null,
            openTime: '17:00',
            closeTime: '22:00',
            isClosed: false,
            lastSyncedAt: null,
            verificationStatus: null,
          },
        ],
        coreNormalization: {
          operatingHours: {
            source: 'kitchen',
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            weekly: [],
            overrides: [],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'matched',
            summary: 'Matched',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            missingInputs: [],
          },
        },
      },
    });

    const comparisons = deriveServicePeriodDayComparisons({
      days: [
        {
          dayOfWeek: 2,
          lunch: { enabled: true, startTime: '12:00', endTime: '15:00' },
          dinner: { enabled: true, startTime: '17:00', endTime: '22:00' },
        },
      ],
      connection,
    });

    expect(comparisons[2]).toMatchObject({
      status: 'verified',
      tooltipLines: ['GBP lunch: 12:00 – 15:00', 'GBP dinner: 17:00 – 22:00'],
    });
  });

  it('infers lunch and dinner from a single kitchen window when it spans the 17:00 split', () => {
    const connection = buildConnection({
      businessInfo: {
        details: null,
        addresses: [],
        phoneNumbers: [],
        links: [],
        categories: [],
        serviceAreas: [],
        attributes: [],
        serviceItems: [],
        hours: [
          {
            id: 'h1',
            hoursType: 'service',
            periodLabel: 'Kitchen',
            periodCode: 'KITCHEN',
            openDay: 0,
            closeDay: 0,
            startDate: null,
            endDate: null,
            openTime: '12:00',
            closeTime: '21:00',
            isClosed: false,
            lastSyncedAt: null,
            verificationStatus: null,
          },
        ],
        coreNormalization: {
          operatingHours: {
            source: 'kitchen',
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            weekly: [],
            overrides: [],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'Partial',
            warnings: [],
            missingInputs: [],
          },
        },
      },
    });

    const comparisons = deriveServicePeriodDayComparisons({
      days: [
        {
          dayOfWeek: 0,
          lunch: { enabled: true, startTime: '12:00', endTime: '17:00' },
          dinner: { enabled: true, startTime: '17:00', endTime: '21:00' },
        },
      ],
      connection,
    });

    expect(comparisons[0]).toMatchObject({
      status: 'verified',
      tooltipLines: [
        'GBP lunch: 12:00 – 17:00',
        'GBP dinner: 17:00 – 21:00',
      ],
    });
  });
});
