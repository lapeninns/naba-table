import { describe, expect, it } from 'vitest';

import {
  buildProfileValues,
  deriveReadiness,
  displayProfileValue,
  hasProfileValue,
  PROFILE_DIRTY_SECTIONS,
  PROFILE_SECTION_FORMS,
} from '@/components/features/restaurant-settings/restaurantProfileModel';

import type { RestaurantProfile } from '@/services/ops/restaurants';

describe('restaurantProfileModel', () => {
  it('keeps profile dirty sections mapped to stable form ids', () => {
    expect(PROFILE_SECTION_FORMS).toEqual({
      advanced: 'restaurant-profile-advanced-form',
      brand: 'restaurant-profile-brand-form',
      contact: 'restaurant-profile-contact-form',
      notifications: 'restaurant-profile-notifications-form',
    });
    expect(PROFILE_DIRTY_SECTIONS.map((section) => section.key)).toEqual([
      'brand',
      'contact',
      'notifications',
      'advanced',
    ]);
    expect(PROFILE_DIRTY_SECTIONS.every((section) => typeof section.formId === 'string')).toBe(
      true,
    );
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
