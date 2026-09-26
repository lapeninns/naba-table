import { describe, expect, it } from 'vitest';

import {
  PROFILE_FIELD_GROUPS,
  PROFILE_FIELD_ORDER,
  PROFILE_SECTION_DEFINITIONS,
  STAFF_COMMUNICATIONS_SECTION_DEFINITIONS,
} from '@/components/features/restaurant-settings/profile/profileSections';
import {
  buildProfileValues,
  deriveReadiness,
  displayProfileValue,
  hasProfileValue,
} from '@/components/features/restaurant-settings/restaurantProfileModel';

import { mapInitialValues } from '../../components/ops/restaurants/restaurantDetailsFormModel';

import type { RestaurantProfile } from '@/services/ops/restaurants';

describe('restaurantProfileModel', () => {
  it('keeps Profile to public details and manager alerts on Staff communications', () => {
    expect(
      PROFILE_SECTION_DEFINITIONS.map((section) => [
        section.id,
        section.name,
        section.analyticsSection,
      ]),
    ).toEqual([['public', 'Public details', 'public_details']]);
    // Older deep links (#profile-identity, #profile-contact) land on these groups.
    expect(PROFILE_FIELD_GROUPS.map((group) => [group.name, group.anchorId])).toEqual([
      ['Name and booking link', 'profile-identity'],
      ['Location and contact', 'profile-contact'],
    ]);
    expect(PROFILE_FIELD_ORDER).toEqual([
      'name',
      'slug',
      'businessDescription',
      'timezone',
      'address',
      'googleMapUrl',
      'contactPhone',
      'contactEmail',
      'googleReviewUrl',
    ]);
    for (const field of [
      'managerName',
      'managerNotificationPhone',
      'managerDailySummaryEnabled',
      'managerWhatsappEnabled',
      'bookingPolicy',
      'reservationIntervalMinutes',
    ] as const) {
      expect(PROFILE_FIELD_ORDER).not.toContain(field);
    }
    expect(
      STAFF_COMMUNICATIONS_SECTION_DEFINITIONS.map((section) => [
        section.id,
        section.name,
        section.analyticsSection,
        section.fields,
      ]),
    ).toEqual([
      [
        'notifications',
        'Manager alerts',
        'manager_notifications',
        [
          'managerName',
          'managerNotificationPhone',
          'managerDailySummaryEnabled',
          'managerWhatsappEnabled',
        ],
      ],
    ]);
  });

  it('builds each section payload from only its own fields', () => {
    const state = mapInitialValues({
      ...buildProfileValues(profile({ bookingPolicy: null })),
      name: '  The Old Crown ',
      contactEmail: '',
      managerName: 'Sam',
    });

    expect(PROFILE_SECTION_DEFINITIONS[0]?.buildPayload(state)).toEqual({
      name: 'The Old Crown',
      slug: 'old-crown',
      businessDescription: 'Family pub',
      timezone: 'Europe/London',
      contactEmail: null,
      contactPhone: '+441223000000',
      address: '1 High Street',
      googleMapUrl: 'https://maps.example.test',
      googleReviewUrl: 'https://reviews.example.test',
    });
    expect(STAFF_COMMUNICATIONS_SECTION_DEFINITIONS[0]?.buildPayload(state)).toEqual({
      managerName: 'Sam',
      managerNotificationPhone: '+441223111111',
      managerDailySummaryEnabled: true,
      managerWhatsappEnabled: false,
    });
  });

  it('builds shared form values from a loaded profile and preserves booking-rule fields', () => {
    const values = buildProfileValues(profile({ slug: null, timezone: null }));

    expect(values).toMatchObject({
      address: '1 High Street',
      bookingPolicy: { maxPartySize: 8 },
      businessDescription: 'Family pub',
      contactEmail: 'ops@example.test',
      contactPhone: '+441223000000',
      googleMapUrl: 'https://maps.example.test',
      googleReviewUrl: 'https://reviews.example.test',
      managerDailySummaryEnabled: true,
      managerNotificationPhone: '+441223111111',
      name: 'Old Crown',
      reservationDefaultDurationMinutes: 90,
      reservationIntervalMinutes: 15,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      slug: '',
    });
    expect(values.timezone).toBeTruthy();
  });

  it('derives required and optional readiness from profile form values', () => {
    const values = buildProfileValues(
      profile({
        address: null,
        businessDescription: null,
        googleMapUrl: null,
        slug: '',
      }),
    );
    const readiness = deriveReadiness(values, 'https://cdn.example/logo.png');

    expect(readiness.blockingComplete).toBe(false);
    expect(readiness.missingRequired.map((item) => item.key)).toEqual(['bookingUrl']);
    expect(readiness.completed.map((item) => item.key)).toEqual(
      expect.arrayContaining(['name', 'contactPhone', 'timezone', 'logo', 'contactEmail']),
    );
    expect(readiness.missing.map((item) => item.key)).toEqual(
      expect.arrayContaining(['bookingUrl', 'description', 'address', 'mapUrl']),
    );
    expect(readiness.score).toBe(Math.round((5 / 9) * 100));
    expect(readiness.items.map((item) => [item.key, item.required, item.complete])).toEqual([
      ['name', true, true],
      ['bookingUrl', true, false],
      ['contactPhone', true, true],
      ['timezone', true, true],
      ['logo', false, true],
      ['description', false, false],
      ['contactEmail', false, true],
      ['address', false, false],
      ['mapUrl', false, false],
    ]);
  });

  it('formats optional profile values for display', () => {
    expect(hasProfileValue('  Old Crown  ')).toBe(true);
    expect(hasProfileValue('   ')).toBe(false);
    expect(displayProfileValue('  Old Crown  ', 'Fallback')).toBe('Old Crown');
    expect(displayProfileValue(null, 'Fallback')).toBe('Fallback');
  });
});

function profile(overrides: Partial<RestaurantProfile> = {}): RestaurantProfile {
  return {
    address: '1 High Street',
    bookingPolicy: { maxPartySize: 8 },
    businessDescription: 'Family pub',
    capacity: 40,
    contactEmail: 'ops@example.test',
    contactPhone: '+441223000000',
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
    googleMapUrl: 'https://maps.example.test',
    googleReviewUrl: 'https://reviews.example.test',
    id: 'rest-1',
    logoUrl: null,
    managerDailySummaryEnabled: true,
    managerNotificationPhone: '+441223111111',
    name: 'Old Crown',
    reservationDefaultDurationMinutes: 90,
    reservationIntervalMinutes: 15,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
    slug: 'old-crown',
    timezone: 'Europe/London',
    updatedAt: '2026-05-01T12:00:00.000Z',
    ...overrides,
  };
}
