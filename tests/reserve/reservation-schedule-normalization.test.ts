import { describe, expect, it } from 'vitest';

import { normalizeReservationSchedulePayload } from '@reserve/features/reservations/wizard/services/schedule';

describe('normalizeReservationSchedulePayload', () => {
  it('fills in missing array fields with safe defaults', () => {
    const result = normalizeReservationSchedulePayload({
      restaurantId: 'rest-1',
      date: '2026-03-16',
      timezone: 'Europe/London',
      intervalMinutes: 30,
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 90,
      window: {},
    });

    expect(result.availableBookingOptions).toEqual([]);
    expect(result.slots).toEqual([]);
    expect(result.occasionCatalog).toEqual([]);
    expect(result.notes).toBeNull();
    expect(result.window).toEqual({ opensAt: null, closesAt: null });
  });

  it('preserves an explicit zero last-seating buffer and does not invent party metadata', () => {
    const result = normalizeReservationSchedulePayload({
      restaurantId: 'restaurant-1',
      date: '2026-04-14',
      defaultDurationMinutes: 90,
      lastSeatingBufferMinutes: 0,
      slots: [],
    });

    expect(result.lastSeatingBufferMinutes).toBe(0);
    expect(result.evaluatedPartySize).toBeUndefined();
  });

  it('drops malformed slots and normalizes nullable nested fields', () => {
    const result = normalizeReservationSchedulePayload({
      restaurantId: 'rest-1',
      date: '2026-03-16',
      timezone: 'Europe/London',
      notes: '  Final kitchen orders at 20:30. ',
      slots: [
        null,
        {
          value: '18:00',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: {
            services: { dinner: 'enabled', lunch: 'invalid' },
            labels: { dinnerWindow: true },
          },
        },
      ],
    });

    expect(result.slots).toHaveLength(1);
    expect(result.notes).toBe('Final kitchen orders at 20:30.');
    expect(result.slots[0]).toMatchObject({
      value: '18:00',
      display: '18:00',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      periodId: null,
      periodName: null,
      disabled: false,
      availability: {
        services: { dinner: 'enabled' },
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
    });
  });
});
