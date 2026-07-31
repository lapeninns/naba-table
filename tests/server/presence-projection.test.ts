import { describe, expect, it } from 'vitest';

import { buildVenuePresenceProjection } from '@/server/presence/projection';

describe('VenuePresenceProjectionV1', () => {
  it('projects canonical regular, special, and service hours without booking data', () => {
    const result = buildVenuePresenceProjection({
      generatedAt: '2026-07-30T18:00:00.000Z',
      profile: {
        restaurantId: 'restaurant-1',
        name: 'Old Crown Girton',
        slug: 'old-crown-girton',
        timezone: 'Europe/London',
        capacity: 80,
        contactEmail: 'private@example.test',
        contactPhone: '+441223000000',
        address: '89 High Street, Girton',
        businessDescription: 'A village pub.',
        managerDailySummaryEnabled: true,
        managerWhatsappEnabled: true,
        managerName: 'Private manager',
        managerNotificationPhone: '+447700900000',
        googleMapUrl: 'https://maps.google.com/example',
        googleReviewUrl: 'https://search.google.com/local/writereview',
        bookingPolicy: 'Private booking policy',
        logoUrl: null,
        updatedAt: '2026-07-30T17:00:00.000Z',
      },
      operatingHours: {
        restaurantId: 'restaurant-1',
        timezone: 'Europe/London',
        updatedAt: '2026-07-30T17:30:00.000Z',
        weekly: [
          {
            dayOfWeek: 1,
            opensAt: '11:00',
            closesAt: '23:00',
            isClosed: false,
            notes: 'Private note',
            reservationIntervalMinutes: 15,
            reservationSlotTimes: ['12:00'],
          },
          {
            dayOfWeek: 2,
            opensAt: null,
            closesAt: null,
            isClosed: true,
            notes: null,
            reservationIntervalMinutes: null,
            reservationSlotTimes: null,
          },
        ],
        overrides: [
          {
            id: 'override-1',
            effectiveDate: '2026-12-25',
            opensAt: null,
            closesAt: null,
            isClosed: true,
            notes: 'Private note',
            reservationIntervalMinutes: null,
            reservationSlotTimes: null,
          },
        ],
      },
      servicePeriods: [
        {
          id: 'service-1',
          name: 'Lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '15:00',
          bookingOption: 'lunch',
          updatedAt: '2026-07-30T17:40:00.000Z',
        },
      ],
    });

    expect(result.projection).toMatchObject({
      schemaVersion: 'VenuePresenceProjectionV1',
      restaurantId: 'restaurant-1',
      profile: {
        name: 'Old Crown Girton',
        phone: '+441223000000',
        structuredAddress: {
          formatted: '89 High Street, Girton',
        },
        timezone: 'Europe/London',
      },
      hours: {
        regular: [
          {
            dayOfWeek: 1,
            opensAt: '11:00',
            closesAt: '23:00',
            isClosed: false,
          },
          {
            dayOfWeek: 2,
            opensAt: null,
            closesAt: null,
            isClosed: true,
          },
        ],
        special: [
          {
            effectiveDate: '2026-12-25',
            opensAt: null,
            closesAt: null,
            isClosed: true,
          },
        ],
        servicePeriods: [
          {
            stableKey: '1:lunch',
            name: 'Lunch',
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '15:00',
            bookingOption: 'lunch',
          },
        ],
      },
    });
    expect(JSON.stringify(result.projection)).not.toContain('private@example');
    expect(JSON.stringify(result.projection)).not.toContain('Private manager');
    expect(JSON.stringify(result.projection)).not.toContain('Private note');
    expect(result.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(result.projection.revision).toContain('2026-07-30T17:40:00.000Z');
  });
});
