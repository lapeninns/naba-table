import { describe, expect, it } from 'vitest';

import { resolveBookingCreateScheduleSelection } from '@/server/bookings/create-schedule-selection';
import { OperatingHoursError } from '@/server/bookings/timeValidation';

import type { BookingType } from '@/lib/enums';
import type { RestaurantSchedule } from '@/server/restaurants/schedule';

function buildSchedule(overrides: Partial<RestaurantSchedule> = {}): RestaurantSchedule {
  return {
    restaurantId: 'restaurant-1',
    date: '2026-07-01',
    timezone: 'Europe/London',
    notes: null,
    intervalMinutes: 15,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 0,
    window: {
      opensAt: '12:00',
      closesAt: '22:00',
    },
    isClosed: false,
    availableBookingOptions: ['lunch', 'dinner'],
    occasionCatalog: [],
    slots: [
      {
        value: '12:30',
        display: '12:30',
        periodId: 'period-lunch',
        periodName: 'Lunch',
        bookingOption: 'lunch',
        defaultBookingOption: 'lunch',
        availability: {
          services: { lunch: 'enabled', dinner: 'disabled' },
          labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
        },
        disabled: false,
      },
      {
        value: '19:00',
        display: '19:00',
        periodId: 'period-dinner',
        periodName: 'Dinner',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
        availability: {
          services: { lunch: 'disabled', dinner: 'enabled' },
          labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
        },
        disabled: false,
      },
    ],
    ...overrides,
  };
}

describe('resolveBookingCreateScheduleSelection', () => {
  it('selects the enabled slot booking option and schedule timezone', () => {
    expect(
      resolveBookingCreateScheduleSelection({
        schedule: buildSchedule(),
        requestedTime: '12:30',
        fallbackBookingType: 'dinner',
      }),
    ).toEqual({
      startTime: '12:30',
      bookingType: 'lunch',
      scheduleTimezone: 'Europe/London',
    });
  });

  it('preserves the fallback booking type when the matched slot option is not lunch or dinner', () => {
    const fallbackBookingType: BookingType = 'dinner';
    const schedule = buildSchedule({
      slots: [
        {
          ...buildSchedule().slots[0],
          bookingOption: 'brunch' as RestaurantSchedule['slots'][number]['bookingOption'],
        },
      ],
    });

    expect(
      resolveBookingCreateScheduleSelection({
        schedule,
        requestedTime: '12:30',
        fallbackBookingType,
      }).bookingType,
    ).toBe(fallbackBookingType);
  });

  it('throws the existing operating-hours error for disabled matched slots', () => {
    const schedule = buildSchedule({
      slots: [{ ...buildSchedule().slots[0], disabled: true }],
    });

    expect(() =>
      resolveBookingCreateScheduleSelection({
        schedule,
        requestedTime: '12:30',
        fallbackBookingType: 'lunch',
      }),
    ).toThrow(OperatingHoursError);
  });

  it('throws the existing operating-hours error for closed schedules', () => {
    expect(() =>
      resolveBookingCreateScheduleSelection({
        schedule: buildSchedule({ isClosed: true }),
        requestedTime: '12:30',
        fallbackBookingType: 'lunch',
      }),
    ).toThrow(OperatingHoursError);
  });
});
