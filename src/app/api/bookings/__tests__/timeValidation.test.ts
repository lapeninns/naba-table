process.env.BASE_URL ??= 'http://localhost:3000';

import { describe, expect, it } from 'vitest';

import {
  OperatingHoursError,
  assertBookingWithinOperatingWindow,
  type BookingOperatingWindow,
} from '@/server/bookings/timeValidation';

import type { ServiceAvailability } from '@/server/restaurants/schedule';
import type { ReservationTime } from '@reserve/shared/time';

const baseAvailability: ServiceAvailability = {
  services: {
    lunch: 'disabled',
    dinner: 'enabled',
    drinks: 'disabled',
  },
  labels: {
    happyHour: false,
    drinksOnly: false,
    kitchenClosed: false,
    lunchWindow: false,
    dinnerWindow: true,
  },
};

const toReservationTime = (value: string): ReservationTime => value as ReservationTime;

function buildSchedule(overrides: Partial<BookingOperatingWindow> = {}): BookingOperatingWindow {
  const defaultSchedule: BookingOperatingWindow = {
    isClosed: false,
    window: {
      opensAt: '10:00',
      closesAt: '22:00',
    },
    slots: [
      {
        value: toReservationTime('19:00'),
        display: '7:00 PM',
        periodId: null,
        periodName: 'Dinner',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
        availability: baseAvailability,
        disabled: false,
      },
      {
        value: toReservationTime('21:30'),
        display: '9:30 PM',
        periodId: null,
        periodName: 'Late Dinner',
        bookingOption: 'dinner',
        defaultBookingOption: 'dinner',
        availability: baseAvailability,
        disabled: false,
      },
    ],
  };

  return {
    ...defaultSchedule,
    ...overrides,
    slots: overrides.slots ?? defaultSchedule.slots,
  } satisfies BookingOperatingWindow;
}

function captureError(action: () => void): OperatingHoursError {
  try {
    action();
  } catch (error) {
    if (error instanceof OperatingHoursError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected action to throw OperatingHoursError');
}

describe('assertBookingWithinOperatingWindow', () => {
  it('throws when restaurant is closed', () => {
    const schedule = buildSchedule({ isClosed: true });

    const error = captureError(() =>
      assertBookingWithinOperatingWindow({ schedule, requestedTime: '19:00', bookingType: 'dinner' }),
    );

    expect(error.reason).toBe('CLOSED');
    expect(error.message).toBe('Restaurant is closed on the selected date.');
  });

  it('throws when time cannot be normalized', () => {
    const schedule = buildSchedule();

    const error = captureError(() =>
      assertBookingWithinOperatingWindow({ schedule, requestedTime: '25:00', bookingType: 'dinner' }),
    );

    expect(error.reason).toBe('INVALID_TIME');
    expect(error.message).toBe('Selected time is invalid.');
  });

  it('throws when no slot matches the requested time', () => {
    const schedule = buildSchedule();

    const error = captureError(() =>
      assertBookingWithinOperatingWindow({ schedule, requestedTime: '18:45', bookingType: 'dinner' }),
    );

    expect(error.reason).toBe('OUTSIDE_WINDOW');
    expect(error.message).toBe('Selected time is outside operating hours.');
  });

  it('throws when duration extends past closing time', () => {
    const schedule = buildSchedule();

    const error = captureError(() =>
      assertBookingWithinOperatingWindow({ schedule, requestedTime: '21:30', bookingType: 'dinner' }),
    );

    expect(error.reason).toBe('AFTER_CLOSE');
    expect(error.message).toBe('Selected time extends beyond closing hours.');
  });

  it('returns normalized time for valid submissions', () => {
    const schedule = buildSchedule();

    const result = assertBookingWithinOperatingWindow({
      schedule,
      requestedTime: '19:00',
      bookingType: 'dinner',
    });

    expect(result.time).toBe('19:00');
  });

  it('treats disabled slots as invalid', () => {
    const schedule = buildSchedule({
      slots: [
        {
          value: toReservationTime('19:00'),
          display: '7:00 PM',
          periodId: null,
          periodName: 'Dinner',
          bookingOption: 'dinner',
          defaultBookingOption: 'dinner',
          availability: baseAvailability,
          disabled: true,
        },
      ],
    });

    const error = captureError(() =>
      assertBookingWithinOperatingWindow({ schedule, requestedTime: '19:00', bookingType: 'dinner' }),
    );

    expect(error.reason).toBe('OUTSIDE_WINDOW');
  });
});
