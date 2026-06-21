import { describe, expect, it } from 'vitest';

import { buildOperatingHoursClosedResponse } from '@/server/bookings/operating-hours-response';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

import type { RestaurantSchedule } from '@/server/restaurants/schedule';

const schedule = {
  restaurantId: 'restaurant-1',
  date: '2026-05-23',
  timezone: 'Europe/London',
  notes: null,
  intervalMinutes: 30,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 0,
  window: {
    opensAt: '12:00',
    closesAt: '22:00',
  },
  isClosed: false,
  availableBookingOptions: ['lunch', 'dinner'],
  slots: [
    { value: '11:30', disabled: true },
    { value: '12:00', disabled: false },
    { value: '12:30', disabled: false },
    { value: '21:30', disabled: false },
    { value: '22:00', disabled: true },
  ].map((slot) => ({
    display: slot.value,
    periodId: null,
    periodName: null,
    bookingOption: 'dinner',
    defaultBookingOption: 'dinner',
    availability: {
      services: {
        breakfast: 'disabled',
        lunch: 'enabled',
        dinner: 'enabled',
        drinks: 'disabled',
      },
      labels: {
        kitchenClosed: false,
        lunchWindow: true,
        dinnerWindow: true,
      },
    },
    ...slot,
  })),
  occasionCatalog: [],
} as RestaurantSchedule;

describe('buildOperatingHoursClosedResponse', () => {
  it('builds the route-equivalent closed response with available slot bounds', () => {
    expect(
      buildOperatingHoursClosedResponse({
        error: new OperatingHoursError(
          'OUTSIDE_WINDOW',
          'Selected time is outside operating hours.',
        ),
        schedule,
        requestedTime: '10:00',
        bookingType: 'dinner',
      }),
    ).toEqual({
      body: {
        error: 'Selected time is outside operating hours.',
        code: 'OPERATING_HOURS_CLOSED',
        details: {
          reason: 'OUTSIDE_WINDOW',
          requestedTime: '10:00',
          bookingType: 'dinner',
          opensAt: '12:00',
          closesAt: '22:00',
          firstAvailableSlot: '12:00',
          lastAvailableSlot: '21:30',
          timezone: 'Europe/London',
        },
      },
      init: { status: 400 },
    });
  });

  it('returns null slot bounds when all captured schedule slots are disabled', () => {
    const disabledSchedule = {
      ...schedule,
      slots: schedule.slots.map((slot) => ({ ...slot, disabled: true })),
    };

    expect(
      buildOperatingHoursClosedResponse({
        error: new OperatingHoursError('CLOSED', 'Restaurant is closed on the selected date.'),
        schedule: disabledSchedule,
        requestedTime: '18:00',
        bookingType: 'lunch',
      }).body.details,
    ).toMatchObject({
      reason: 'CLOSED',
      firstAvailableSlot: null,
      lastAvailableSlot: null,
    });
  });

  it('preserves undefined schedule fields when no schedule was captured', () => {
    expect(
      buildOperatingHoursClosedResponse({
        error: new OperatingHoursError('INVALID_TIME', 'Selected time is invalid.'),
        schedule: null,
        requestedTime: 'bad-time',
        bookingType: 'dinner',
      }).body.details,
    ).toEqual({
      reason: 'INVALID_TIME',
      requestedTime: 'bad-time',
      bookingType: 'dinner',
      opensAt: undefined,
      closesAt: undefined,
      firstAvailableSlot: null,
      lastAvailableSlot: null,
      timezone: undefined,
    });
  });
});
