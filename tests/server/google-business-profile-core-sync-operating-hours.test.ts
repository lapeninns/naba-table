import { describe, expect, it } from 'vitest';

import {
  buildOperatingHoursVerificationSummary,
  buildPushOperatingHoursLocationPatch,
} from '@/server/google-business-profile/core-sync-operating-hours';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';

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
        matchStatus: 'drifted',
        summary: 'Operating hours differ.',
        warnings: ['Review holiday overrides before publishing.'],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'more_hours',
        matchStatus: 'matched',
        summary: 'Service periods match.',
        warnings: [],
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

describe('google business profile core sync operating-hours domain', () => {
  it('builds verification summaries from operating-hours normalization state', () => {
    const summary = buildOperatingHoursVerificationSummary({
      snapshot: {
        weekly: [],
        overrides: [],
        updatedAt: '2026-05-03T12:00:00.000Z',
      },
      businessInfo: makeBusinessInfo(),
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
    });

    expect(summary).toEqual({
      status: 'drifted',
      summary: 'Operating hours differ.',
      recommendedDirection: 'push_to_gbp',
      canPull: true,
      canPush: true,
      coreUpdatedAt: '2026-05-03T12:00:00.000Z',
      providerUpdatedAt: '2026-05-02T12:00:00.000Z',
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
      warnings: ['Review holiday overrides before publishing.'],
    });
  });

  it('builds selected push patches while preserving provider rows outside the selection', () => {
    const snapshot: OperatingHoursSnapshot = {
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '11:00',
          closesAt: '22:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
      overrides: [
        {
          id: 'override-1',
          effectiveDate: '2026-12-23',
          opensAt: '12:00',
          closesAt: '20:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
      updatedAt: '2026-05-03T12:00:00.000Z',
    };
    const location: GoogleBusinessProfileLocationProfile = {
      name: 'locations/123',
      regularHours: {
        periods: [{ openDay: 'SUNDAY', closeDay: 'SUNDAY', openTime: '10:00', closeTime: '20:00' }],
      },
      specialHours: {
        specialHourPeriods: [
          {
            startDate: { year: 2026, month: 12, day: 24 },
            endDate: { year: 2026, month: 12, day: 24 },
            openTime: '10:00',
            closeTime: '18:00',
            closed: false,
          },
        ],
      },
    };

    const patch = buildPushOperatingHoursLocationPatch({
      snapshot,
      location,
      selection: {
        weeklyDays: [1],
        overrideDates: ['2026-12-23'],
      },
    });

    expect(patch.updateMask).toEqual(['regularHours', 'specialHours']);
    expect(patch.payload.regularHours).toEqual({
      periods: [
        expect.objectContaining({ openDay: 'SUNDAY', closeDay: 'SUNDAY' }),
        expect.objectContaining({ openDay: 'MONDAY', closeDay: 'MONDAY' }),
      ],
    });
    expect(patch.payload.specialHours).toEqual({
      specialHourPeriods: [
        expect.objectContaining({
          startDate: { year: 2026, month: 12, day: 23 },
          openTime: { hours: 12, minutes: 0 },
          closeTime: { hours: 20, minutes: 0 },
        }),
        expect.objectContaining({
          startDate: { year: 2026, month: 12, day: 24 },
        }),
      ],
    });
  });
});
