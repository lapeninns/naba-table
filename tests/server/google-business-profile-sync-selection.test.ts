import { describe, expect, it } from 'vitest';

import {
  buildProfileVerificationSummary,
  buildPullOperatingHoursPayload,
  buildPullServicePeriodsPayload,
  buildPushOperatingHoursLocationPatch,
  buildPushProfileLocationPatch,
  buildPushServicePeriodsLocationPatch,
} from '@/server/google-business-profile/core-sync';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';
import type { OperatingHoursSnapshot } from '@/server/restaurants/operatingHours';
import type { RestaurantDetails } from '@/server/restaurants/details';
import type { ServicePeriod } from '@/server/restaurants/servicePeriods';

function buildBusinessInfo(overrides: Partial<GoogleBusinessProfileBusinessInfo>): GoogleBusinessProfileBusinessInfo {
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
        source: 'public',
        matchStatus: 'drifted',
        summary: 'Operating hours differ.',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'more_hours',
        matchStatus: 'drifted',
        summary: 'Service periods differ.',
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
  };
}

function buildRestaurantProfile(overrides: Partial<RestaurantDetails>): RestaurantDetails {
  return {
    restaurantId: 'rest-1',
    name: 'Old Crown Girton',
    slug: 'old-crown-girton',
    timezone: 'Europe/London',
    capacity: 120,
    contactEmail: 'hello@example.com',
    contactPhone: '01223 277217',
    address: '89 High Street, Girton, Cambridge CB3 0QD',
    managerDailySummaryEnabled: false,
    managerNotificationPhone: null,
    googleMapUrl: null,
    googleReviewUrl: null,
    bookingPolicy: null,
    logoUrl: null,
    updatedAt: '2026-04-18T13:00:00.000Z',
    ...overrides,
  };
}

describe('google business profile sync selection', () => {
  it('marks flat addresses as verification-only and warns that export is disabled', () => {
    const summary = buildProfileVerificationSummary({
      profile: buildRestaurantProfile({}),
      businessInfo: buildBusinessInfo({
        addresses: [
          {
            id: 'addr-1',
            formattedAddress: '89 High Street, Girton, Cambridge CB3 0QD',
            isPrimary: true,
          },
        ],
      }),
      lastPulledAt: '2026-04-18T11:00:00.000Z',
      lastPushedAt: '2026-04-18T12:00:00.000Z',
      externalLocationTitle: 'Old Crown Girton',
    });

    expect(summary.providerUpdatedAt).toBe('2026-04-18T12:00:00.000Z');
    expect(summary.fields.find((field) => field.field === 'address')).toEqual(
      expect.objectContaining({
        status: 'verified',
        canPull: true,
        canPush: false,
      }),
    );
    expect(summary.warnings).toContain(
      'Address verification compares Nabatable’s flat address string with GBP, but address export stays disabled until Nabatable stores structured postal address fields.',
    );
  });

  it('omits address updates from the default profile push patch', () => {
    const patch = buildPushProfileLocationPatch({
      profile: buildRestaurantProfile({}),
      location: {
        name: 'locations/123',
      },
    });

    expect(patch.updateMask).toEqual(['title', 'phoneNumbers']);
    expect(patch.payload).not.toHaveProperty('storefrontAddress');
  });

  it('rejects explicit address pushes from the flat core address field', () => {
    expect(() =>
      buildPushProfileLocationPatch({
        profile: buildRestaurantProfile({}),
        location: {
          name: 'locations/123',
          storefrontAddress: {
            addressLines: ['Old line'],
            locality: 'Cambridge',
            administrativeArea: 'Cambridgeshire',
            postalCode: 'CB3 0QD',
            regionCode: 'GB',
          },
        },
        fields: ['address'],
      }),
    ).toThrow(
      'Selected GBP export fields are not safely pushable from Nabatable yet: address.',
    );
  });

  it('pulls only the selected operating-hours rows and preserves the rest', () => {
    const snapshot: OperatingHoursSnapshot = {
      weekly: [
        {
          dayOfWeek: 0,
          opensAt: '12:00',
          closesAt: '21:00',
          isClosed: false,
          notes: 'Sunday core',
          reservationIntervalMinutes: 15,
          reservationSlotTimes: ['12:00'],
        },
        {
          dayOfWeek: 1,
          opensAt: '09:00',
          closesAt: '17:00',
          isClosed: false,
          notes: 'Monday core',
          reservationIntervalMinutes: 30,
          reservationSlotTimes: ['09:00'],
        },
      ],
      overrides: [
        {
          id: 'override-1',
          effectiveDate: '2026-12-24',
          opensAt: '10:00',
          closesAt: '18:00',
          isClosed: false,
          notes: 'Christmas Eve core',
          reservationIntervalMinutes: 15,
          reservationSlotTimes: ['10:00'],
        },
        {
          id: 'override-2',
          effectiveDate: '2026-12-25',
          opensAt: null,
          closesAt: null,
          isClosed: true,
          notes: 'Christmas core',
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
      updatedAt: '2026-04-18T13:00:00.000Z',
    };

    const payload = buildPullOperatingHoursPayload({
      currentSnapshot: snapshot,
      selection: {
        weeklyDays: [1],
        overrideDates: ['2026-12-25'],
      },
      businessInfo: buildBusinessInfo({
        coreNormalization: {
          operatingHours: {
            source: 'public',
            matchStatus: 'drifted',
            summary: 'Operating hours differ.',
            warnings: [],
            weekly: [
              { dayOfWeek: 0, opensAt: '12:00', closesAt: '21:00', isClosed: false, matchesCore: false },
              { dayOfWeek: 1, opensAt: '11:00', closesAt: '22:00', isClosed: false, matchesCore: false },
            ],
            overrides: [
              { effectiveDate: '2026-12-25', opensAt: '12:00', closesAt: '20:00', isClosed: false, matchesCore: false },
            ],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'unavailable',
            summary: 'n/a',
            warnings: [],
            periods: [],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'n/a',
            warnings: [],
            missingInputs: [],
          },
        },
      }),
    });

    expect(payload.weekly).toEqual([
      expect.objectContaining({ dayOfWeek: 0, opensAt: '12:00', closesAt: '21:00' }),
      expect.objectContaining({ dayOfWeek: 1, opensAt: '11:00', closesAt: '22:00' }),
    ]);
    expect(payload.overrides).toEqual([
      expect.objectContaining({ effectiveDate: '2026-12-24', opensAt: '10:00', closesAt: '18:00' }),
      expect.objectContaining({ effectiveDate: '2026-12-25', opensAt: '12:00', closesAt: '20:00' }),
    ]);
  });

  it('pushes only the selected operating-hours rows and preserves provider rows outside the selection', () => {
    const snapshot: OperatingHoursSnapshot = {
      weekly: [
        {
          dayOfWeek: 0,
          opensAt: '12:00',
          closesAt: '21:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
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
          effectiveDate: '2026-12-25',
          opensAt: '12:00',
          closesAt: '20:00',
          isClosed: false,
          notes: null,
          reservationIntervalMinutes: null,
          reservationSlotTimes: null,
        },
      ],
      updatedAt: '2026-04-18T13:00:00.000Z',
    };

    const location: GoogleBusinessProfileLocationProfile = {
      name: 'locations/123',
      regularHours: {
        periods: [
          { openDay: 'SUNDAY', closeDay: 'SUNDAY', openTime: '10:00', closeTime: '20:00' },
          { openDay: 'MONDAY', closeDay: 'MONDAY', openTime: '09:00', closeTime: '17:00' },
        ],
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
          {
            startDate: { year: 2026, month: 12, day: 25 },
            endDate: { year: 2026, month: 12, day: 25 },
            openTime: '09:00',
            closeTime: '15:00',
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
        overrideDates: ['2026-12-25'],
      },
    });

    expect(patch.updateMask).toEqual(expect.arrayContaining(['regularHours', 'specialHours']));
    expect(patch.payload.regularHours).toMatchObject({
      periods: expect.arrayContaining([
        expect.objectContaining({ openDay: 'SUNDAY', closeDay: 'SUNDAY' }),
        expect.objectContaining({ openDay: 'MONDAY', closeDay: 'MONDAY' }),
      ]),
    });
    expect(patch.payload.specialHours).toMatchObject({
      specialHourPeriods: expect.arrayContaining([
        expect.objectContaining({
          startDate: { year: 2026, month: 12, day: 24 },
        }),
        expect.objectContaining({
          startDate: { year: 2026, month: 12, day: 25 },
          openTime: { hours: 12, minutes: 0 },
          closeTime: { hours: 20, minutes: 0 },
        }),
      ]),
    });
  });

  it('pulls only the selected service-period days and preserves non-selected plus custom periods', () => {
    const currentPeriods: ServicePeriod[] = [
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
      {
        id: 'dinner-tue',
        restaurantId: 'rest-1',
        name: 'Dinner',
        dayOfWeek: 2,
        startTime: '17:00',
        endTime: '21:00',
        bookingOption: 'dinner',
        createdAt: '2026-04-18T12:00:00.000Z',
        updatedAt: '2026-04-18T12:00:00.000Z',
      },
      {
        id: 'brunch-sat',
        restaurantId: 'rest-1',
        name: 'Brunch',
        dayOfWeek: 6,
        startTime: '10:00',
        endTime: '13:00',
        bookingOption: 'brunch',
        createdAt: '2026-04-18T12:00:00.000Z',
        updatedAt: '2026-04-18T12:00:00.000Z',
      },
    ];

    const payload = buildPullServicePeriodsPayload({
      currentPeriods,
      selection: {
        dayOfWeeks: [1],
      },
      businessInfo: buildBusinessInfo({
        coreNormalization: {
          operatingHours: {
            source: 'public',
            matchStatus: 'unavailable',
            summary: 'n/a',
            warnings: [],
            weekly: [],
            overrides: [],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'drifted',
            summary: 'Service periods differ.',
            warnings: [],
            periods: [
              { bookingOption: 'lunch', name: 'Lunch', dayOfWeek: 1, startTime: '11:30', endTime: '15:30', matchesCore: false },
              { bookingOption: 'dinner', name: 'Dinner', dayOfWeek: 1, startTime: '17:00', endTime: '22:00', matchesCore: false },
            ],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: 'n/a',
            warnings: [],
            missingInputs: [],
          },
        },
      }),
    });

    expect(payload).toEqual([
      expect.objectContaining({ bookingOption: 'dinner', dayOfWeek: 2 }),
      expect.objectContaining({ bookingOption: 'brunch', dayOfWeek: 6 }),
      expect.objectContaining({ bookingOption: 'lunch', dayOfWeek: 1, startTime: '11:30' }),
      expect.objectContaining({ bookingOption: 'dinner', dayOfWeek: 1, endTime: '22:00' }),
    ]);
  });

  it('pushes only the selected service-period days and preserves provider kitchen rows outside the selection', () => {
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
      {
        id: 'dinner-mon',
        restaurantId: 'rest-1',
        name: 'Dinner',
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
        createdAt: '2026-04-18T12:00:00.000Z',
        updatedAt: '2026-04-18T12:00:00.000Z',
      },
    ];

    const location: GoogleBusinessProfileLocationProfile = {
      name: 'locations/123',
      categories: {
        primaryCategory: {
          moreHoursTypes: [{ hoursTypeId: 'KITCHEN_HOURS' }],
        },
      },
      moreHours: [
        {
          hoursTypeId: 'KITCHEN_HOURS',
          periods: [
            { openDay: 'MONDAY', closeDay: 'MONDAY', openTime: '10:00', closeTime: '20:00' },
            { openDay: 'TUESDAY', closeDay: 'TUESDAY', openTime: '11:00', closeTime: '21:00' },
          ],
        },
        {
          hoursTypeId: 'DRIVE_THROUGH',
          periods: [{ openDay: 'SUNDAY', closeDay: 'SUNDAY', openTime: '08:00', closeTime: '12:00' }],
        },
      ],
    };

    const patch = buildPushServicePeriodsLocationPatch({
      periods,
      location,
      selection: {
        dayOfWeeks: [1],
      },
    });

    expect(patch).not.toBeNull();
    expect(patch?.updateMask).toEqual(['moreHours']);
    expect(patch?.payload.moreHours).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hoursTypeId: 'DRIVE_THROUGH' }),
        expect.objectContaining({
          hoursTypeId: 'KITCHEN_HOURS',
          periods: expect.arrayContaining([
            expect.objectContaining({ openDay: 'TUESDAY', closeDay: 'TUESDAY' }),
            expect.objectContaining({ openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 12, minutes: 0 } }),
            expect.objectContaining({ openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 17, minutes: 0 } }),
          ]),
        }),
      ]),
    );
  });
});
