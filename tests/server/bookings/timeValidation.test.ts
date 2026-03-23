import { describe, expect, it } from 'vitest';

import {
  OperatingHoursError,
  assertBookingWithinOperatingWindow,
  type BookingOperatingWindow,
} from '@/server/bookings/timeValidation';

const buildSchedule = (): BookingOperatingWindow => ({
  isClosed: false,
  window: {
    opensAt: '12:00',
    closesAt: '22:00',
  },
  slots: [
    {
      value: '17:00',
      display: '17:00',
      periodId: 'dinner-1',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: {
          dinner: 'enabled',
        },
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    },
    {
      value: '21:30',
      display: '21:30',
      periodId: 'dinner-1',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: {
          dinner: 'enabled',
        },
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    },
  ],
});

describe('assertBookingWithinOperatingWindow', () => {
  it('accepts the last configured slot even when duration would previously exceed closing', () => {
    const result = assertBookingWithinOperatingWindow({
      schedule: buildSchedule(),
      requestedTime: '21:30',
    });

    expect(result.time).toBe('21:30');
  });

  it('rejects a time that is not present in the configured slot list', () => {
    expect(() =>
      assertBookingWithinOperatingWindow({
        schedule: buildSchedule(),
        requestedTime: '22:00',
      }),
    ).toThrowError(OperatingHoursError);

    try {
      assertBookingWithinOperatingWindow({
        schedule: buildSchedule(),
        requestedTime: '22:00',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(OperatingHoursError);
      expect((error as OperatingHoursError).reason).toBe('OUTSIDE_WINDOW');
    }
  });
});
