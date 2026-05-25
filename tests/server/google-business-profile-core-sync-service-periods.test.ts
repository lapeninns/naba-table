import { describe, expect, it } from 'vitest';

import {
  buildServicePeriodsVerificationSummary,
  buildPushServicePeriodsLocationPatch,
  canPushServicePeriodsToGoogle,
} from '@/server/google-business-profile/core-sync-service-periods';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

function makeBusinessInfo(
  overrides: Partial<GoogleBusinessProfileBusinessInfo> = {},
): GoogleBusinessProfileBusinessInfo {
  return {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    coreNormalization: {
      operatingHours: {
        source: 'regular_hours',
        matchStatus: 'matched',
        summary: 'Operating hours match.',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'more_hours',
        matchStatus: 'drifted',
        summary: 'Service periods differ.',
        warnings: ['Kitchen hours need review.'],
        periods: [],
      },
      bookingHours: {
        matchStatus: 'partial',
        summary: 'Booking hours remain partial.',
        warnings: [],
        missingInputs: [],
      },
    },
    ...overrides,
  } as GoogleBusinessProfileBusinessInfo;
}

describe('google business profile core sync service periods domain', () => {
  it('builds verification summaries from service-period normalization state', () => {
    const summary = buildServicePeriodsVerificationSummary({
      periodsUpdatedAt: '2026-05-03T12:00:00.000Z',
      businessInfo: makeBusinessInfo(),
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
      canPush: true,
    });

    expect(summary).toEqual({
      status: 'drifted',
      summary: 'Service periods differ.',
      recommendedDirection: 'push_to_gbp',
      canPull: true,
      canPush: true,
      coreUpdatedAt: '2026-05-03T12:00:00.000Z',
      providerUpdatedAt: '2026-05-02T12:00:00.000Z',
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
      warnings: ['Kitchen hours need review.'],
    });
  });

  it('detects writable kitchen more-hours capability from existing rows or category types', () => {
    expect(
      canPushServicePeriodsToGoogle({
        name: 'locations/1',
        moreHours: [{ hoursTypeId: 'KITCHEN_HOURS', periods: [] }],
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(true);

    expect(
      canPushServicePeriodsToGoogle({
        name: 'locations/1',
        categories: {
          primaryCategory: {
            moreHoursTypes: [{ hoursTypeId: 'MORE_HOURS_TYPE_KITCHEN' }],
          },
        },
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(true);

    expect(
      canPushServicePeriodsToGoogle({
        name: 'locations/1',
        moreHours: [{ hoursTypeId: 'DRIVE_THROUGH', periods: [] }],
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(false);
  });

  it('returns null when no kitchen hours type can be resolved for a push patch', () => {
    const periods: ServicePeriod[] = [
      {
        id: 'lunch-mon',
        restaurantId: 'rest-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
        createdAt: '2026-04-18T12:00:00.000Z',
        updatedAt: '2026-04-18T12:00:00.000Z',
      },
    ];

    expect(
      buildPushServicePeriodsLocationPatch({
        periods,
        location: {
          name: 'locations/1',
          moreHours: [{ hoursTypeId: 'DRIVE_THROUGH', periods: [] }],
        } as GoogleBusinessProfileLocationProfile,
      }),
    ).toBeNull();
  });
});
