import { describe, expect, it } from 'vitest';

import {
  buildBookingInlineAutoAssignRequest,
  runBookingCreateInlineAutoAssign,
  scheduleBookingCreateAutoAssignRetry,
  shouldScheduleBookingAutoAssignRetry,
} from '@/server/bookings/auto-assign-domain';

import type { BookingRecord } from '@/server/bookings';
import type { InlineAutoAssignOptions } from '@/services/inline-auto-assign';

const inlineAutoAssignClient = {} as InlineAutoAssignOptions['client'];

describe('booking auto-assign domain helpers', () => {
  it('builds the public booking inline auto-assign request constants', () => {
    expect(
      buildBookingInlineAutoAssignRequest({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        timeoutMs: 4000,
      }),
    ).toEqual({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      timeoutMs: 4000,
      createdBy: 'api-booking',
      historyReason: 'api_inline_auto_assign',
      observabilitySource: 'bookings.inline_auto_assign',
    });
  });

  it('passes through the configured inline auto-assign timeout', () => {
    expect(
      buildBookingInlineAutoAssignRequest({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        timeoutMs: 2500,
      }).timeoutMs,
    ).toBe(2500);
  });

  it('runs inline auto-assign through the provided runner', async () => {
    const updatedBooking = { id: 'booking-1' } as BookingRecord;
    const runner = vi.fn(async () => updatedBooking);

    await expect(
      runBookingCreateInlineAutoAssign({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        client: inlineAutoAssignClient,
        restaurantId: 'restaurant-1',
        runner,
        timeoutMs: 2500,
      }),
    ).resolves.toBe(updatedBooking);

    expect(runner).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
      timeoutMs: 2500,
      createdBy: 'api-booking',
      historyReason: 'api_inline_auto_assign',
      observabilitySource: 'bookings.inline_auto_assign',
      client: inlineAutoAssignClient,
    });
  });

  it('uses the booking-create inline auto-assign default timeout', async () => {
    const runner = vi.fn(async () => null);

    await runBookingCreateInlineAutoAssign({
      autoAssignEnabled: true,
      bookingId: 'booking-1',
      client: inlineAutoAssignClient,
      restaurantId: 'restaurant-1',
      runner,
    });

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 4000,
      }),
    );
  });

  it('does not call the inline auto-assign runner when disabled', async () => {
    const runner = vi.fn(async () => ({ id: 'booking-1' }) as BookingRecord);

    await expect(
      runBookingCreateInlineAutoAssign({
        autoAssignEnabled: false,
        bookingId: 'booking-1',
        client: inlineAutoAssignClient,
        restaurantId: 'restaurant-1',
        runner,
      }),
    ).resolves.toBeNull();

    expect(runner).not.toHaveBeenCalled();
  });

  it('returns null when inline auto-assign does not update the booking', async () => {
    const runner = vi.fn(async () => null);

    await expect(
      runBookingCreateInlineAutoAssign({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        client: inlineAutoAssignClient,
        restaurantId: 'restaurant-1',
        runner,
      }),
    ).resolves.toBeNull();
  });

  it('propagates inline auto-assign runner failures so the route can log them', async () => {
    const runnerError = new Error('inline failed');

    await expect(
      runBookingCreateInlineAutoAssign({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        client: inlineAutoAssignClient,
        restaurantId: 'restaurant-1',
        runner: async () => {
          throw runnerError;
        },
      }),
    ).rejects.toThrow(runnerError);
  });

  it('schedules background retry when auto-assign is enabled and the booking is not confirmed', () => {
    expect(
      shouldScheduleBookingAutoAssignRetry({
        autoAssignEnabled: true,
        bookingStatus: 'pending',
      }),
    ).toBe(true);
  });

  it('does not schedule background retry when auto-assign is disabled', () => {
    expect(
      shouldScheduleBookingAutoAssignRetry({
        autoAssignEnabled: false,
        bookingStatus: 'pending',
      }),
    ).toBe(false);
  });

  it('does not schedule background retry for confirmed bookings', () => {
    expect(
      shouldScheduleBookingAutoAssignRetry({
        autoAssignEnabled: true,
        bookingStatus: 'confirmed',
      }),
    ).toBe(false);
  });

  it('schedules the background retry through the provided scheduler', async () => {
    const scheduler = vi.fn();

    await expect(
      scheduleBookingCreateAutoAssignRetry({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        bookingStatus: 'pending',
        scheduler,
      }),
    ).resolves.toBe(true);

    expect(scheduler).toHaveBeenCalledWith('booking-1');
  });

  it('does not call the scheduler when auto-assign is disabled', async () => {
    const scheduler = vi.fn();

    await expect(
      scheduleBookingCreateAutoAssignRetry({
        autoAssignEnabled: false,
        bookingId: 'booking-1',
        bookingStatus: 'pending',
        scheduler,
      }),
    ).resolves.toBe(false);

    expect(scheduler).not.toHaveBeenCalled();
  });

  it('does not call the scheduler for confirmed bookings', async () => {
    const scheduler = vi.fn();

    await expect(
      scheduleBookingCreateAutoAssignRetry({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        bookingStatus: 'confirmed',
        scheduler,
      }),
    ).resolves.toBe(false);

    expect(scheduler).not.toHaveBeenCalled();
  });

  it('propagates scheduler failures so the route can log them', async () => {
    const schedulerError = new Error('scheduler failed');

    await expect(
      scheduleBookingCreateAutoAssignRetry({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        bookingStatus: 'pending',
        scheduler: () => {
          throw schedulerError;
        },
      }),
    ).rejects.toThrow(schedulerError);
  });

  it('propagates async scheduler failures so import errors remain visible to the route', async () => {
    const schedulerError = new Error('import failed');

    await expect(
      scheduleBookingCreateAutoAssignRetry({
        autoAssignEnabled: true,
        bookingId: 'booking-1',
        bookingStatus: 'pending',
        scheduler: async () => {
          throw schedulerError;
        },
      }),
    ).rejects.toThrow(schedulerError);
  });
});
