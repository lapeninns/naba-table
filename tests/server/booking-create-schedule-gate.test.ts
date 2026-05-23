import { beforeEach, describe, expect, it, vi } from 'vitest';

const anonymizeIpMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/request', () => ({
  anonymizeIp: anonymizeIpMock,
}));

import { runBookingCreateScheduleGate } from '@/server/bookings/create-schedule-gate';
import { PastBookingError } from '@/server/bookings/pastTimeValidation';

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

describe('runBookingCreateScheduleGate', () => {
  beforeEach(() => {
    anonymizeIpMock.mockReset();
    anonymizeIpMock.mockImplementation((ip: string) => `anon:${ip}`);
  });

  it('returns schedule-derived fields when the requested slot passes validation', async () => {
    const schedule = buildSchedule();
    const scheduleFetcher = vi.fn(async () => schedule);
    const pastTimeChecker = vi.fn();
    const observabilityRecorder = vi.fn();

    await expect(
      runBookingCreateScheduleGate({
        restaurantId: 'restaurant-1',
        date: '2026-07-01',
        requestedTime: '12:30',
        fallbackBookingType: 'dinner',
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 7,
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
        scheduleFetcher,
        pastTimeChecker,
        observabilityRecorder,
      }),
    ).resolves.toEqual({
      kind: 'continue',
      startTime: '12:30',
      bookingType: 'lunch',
      scheduleTimezone: 'Europe/London',
    });

    expect(scheduleFetcher).toHaveBeenCalledWith('restaurant-1', {
      date: '2026-07-01',
      client: undefined,
    });
    expect(pastTimeChecker).toHaveBeenCalledWith('Europe/London', '2026-07-01', '12:30', {
      graceMinutes: 7,
    });
    expect(observabilityRecorder).not.toHaveBeenCalled();
  });

  it('returns a past-time response and records observability when past-time blocking fails', async () => {
    const details = {
      bookingTime: '2026-05-23T10:00:00 BST',
      serverTime: '2026-05-23T11:00:00 BST',
      timezone: 'Europe/London',
      gracePeriodMinutes: 5,
      timeDeltaMinutes: -60,
    };
    const scheduleFetcher = vi.fn(async () => buildSchedule());
    const pastTimeError = new PastBookingError('Booking time is in the past.', details);
    const pastTimeChecker = vi.fn(() => {
      throw pastTimeError;
    });
    const observabilityRecorder = vi.fn();

    await expect(
      runBookingCreateScheduleGate({
        restaurantId: 'restaurant-1',
        date: '2026-05-23',
        requestedTime: '12:30',
        fallbackBookingType: 'lunch',
        pastTimeBlocking: true,
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
        scheduleFetcher,
        pastTimeChecker,
        observabilityRecorder,
      }),
    ).resolves.toEqual({
      kind: 'response',
      body: {
        error: 'Booking time is in the past.',
        code: 'BOOKING_IN_PAST',
        details,
      },
      init: { status: 422 },
    });

    expect(observabilityRecorder).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.past_time.blocked',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        endpoint: 'bookings.create',
        actorRole: null,
        ipScope: 'anon:203.0.113.10',
        ...details,
      },
    });
  });

  it('returns an operating-hours response when schedule selection blocks the requested slot', async () => {
    const schedule = buildSchedule({
      slots: buildSchedule().slots.map((slot) => ({ ...slot, disabled: true })),
    });
    const scheduleFetcher = vi.fn(async () => schedule);
    const pastTimeChecker = vi.fn();

    await expect(
      runBookingCreateScheduleGate({
        restaurantId: 'restaurant-1',
        date: '2026-07-01',
        requestedTime: '12:30',
        fallbackBookingType: 'lunch',
        pastTimeBlocking: true,
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
        scheduleFetcher,
        pastTimeChecker,
      }),
    ).resolves.toEqual({
      kind: 'response',
      body: {
        error: 'Selected time is outside operating hours.',
        code: 'OPERATING_HOURS_CLOSED',
        details: {
          reason: 'OUTSIDE_WINDOW',
          requestedTime: '12:30',
          bookingType: 'lunch',
          opensAt: '12:00',
          closesAt: '22:00',
          firstAvailableSlot: null,
          lastAvailableSlot: null,
          timezone: 'Europe/London',
        },
      },
      init: { status: 400 },
    });
    expect(pastTimeChecker).not.toHaveBeenCalled();
  });

  it('propagates unexpected schedule errors', async () => {
    const scheduleError = new Error('schedule lookup failed');
    const scheduleFetcher = vi.fn(async () => {
      throw scheduleError;
    });

    await expect(
      runBookingCreateScheduleGate({
        restaurantId: 'restaurant-1',
        date: '2026-07-01',
        requestedTime: '12:30',
        fallbackBookingType: 'lunch',
        pastTimeBlocking: true,
        requestSource: 'api.bookings',
        clientIp: '203.0.113.10',
        scheduleFetcher,
      }),
    ).rejects.toThrow(scheduleError);
  });
});
