import { describe, expect, it, vi } from 'vitest';

import { finalizeBookingCreateCommit } from '@/server/bookings/create-finalization';

import type { BookingRecord } from '@/server/bookings';

const client = { from: vi.fn() };
const customer = { id: 'customer-1' };

const pendingBooking = {
  id: 'booking-1',
  status: 'pending',
  customer_email: 'alex@example.com',
  customer_phone: '+447700900123',
} as BookingRecord;

const confirmedBooking = {
  ...pendingBooking,
  status: 'confirmed',
} as BookingRecord;

const baseArgs = {
  actor: 'alex@example.com',
  autoAssignEnabled: true,
  booking: pendingBooking,
  client: client as never,
  customer,
  idempotencyKey: 'idem-1',
  inlineAutoAssignTimeoutMs: 4000,
  isOpsWalkIn: false,
  opsEmailProvidedHeader: false,
  restaurantId: 'restaurant-1',
  reusedExisting: false,
};

describe('finalizeBookingCreateCommit', () => {
  it('dispatches post-commit effects in order and returns the inline-updated booking', async () => {
    const calls: string[] = [];
    const auditDispatcher = vi.fn(async () => {
      calls.push('audit');
    });
    const inlineAutoAssignRunner = vi.fn(async () => {
      calls.push('inline');
      return confirmedBooking;
    });
    const sideEffectsDispatcher = vi.fn(async () => {
      calls.push('side-effects');
    });
    const autoAssignRetryScheduler = vi.fn(async () => {
      calls.push('retry');
    });

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        auditDispatcher,
        inlineAutoAssignRunner,
        sideEffectsDispatcher,
        autoAssignRetryScheduler,
      }),
    ).resolves.toEqual({ booking: confirmedBooking });

    expect(calls).toEqual(['audit', 'inline', 'side-effects', 'retry']);
    expect(sideEffectsDispatcher).toHaveBeenCalledWith({
      booking: confirmedBooking,
      client,
      idempotencyKey: 'idem-1',
      isOpsWalkIn: false,
      opsEmailProvidedHeader: false,
      restaurantId: 'restaurant-1',
    });
    expect(autoAssignRetryScheduler).toHaveBeenCalledWith({
      autoAssignEnabled: true,
      bookingId: 'booking-1',
      bookingStatus: 'confirmed',
    });
  });

  it('skips all post-commit effects for reused bookings', async () => {
    const auditDispatcher = vi.fn();
    const inlineAutoAssignRunner = vi.fn();
    const sideEffectsDispatcher = vi.fn();
    const autoAssignRetryScheduler = vi.fn();

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        reusedExisting: true,
        auditDispatcher,
        inlineAutoAssignRunner,
        sideEffectsDispatcher,
        autoAssignRetryScheduler,
      }),
    ).resolves.toEqual({ booking: pendingBooking });

    expect(auditDispatcher).not.toHaveBeenCalled();
    expect(inlineAutoAssignRunner).not.toHaveBeenCalled();
    expect(sideEffectsDispatcher).not.toHaveBeenCalled();
    expect(autoAssignRetryScheduler).not.toHaveBeenCalled();
  });

  it('continues with the original booking when inline auto-assign returns null', async () => {
    const sideEffectsDispatcher = vi.fn();
    const inlineAutoAssignRunner = vi.fn(async () => null);

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        auditDispatcher: vi.fn(),
        inlineAutoAssignRunner,
        sideEffectsDispatcher,
        autoAssignRetryScheduler: vi.fn(),
      }),
    ).resolves.toEqual({ booking: pendingBooking });

    expect(sideEffectsDispatcher).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: pendingBooking,
      }),
    );
  });

  it('keeps inline auto-assign errors non-fatal', async () => {
    const inlineError = new Error('inline failed');
    const onInlineAutoAssignError = vi.fn();
    const sideEffectsDispatcher = vi.fn();
    const autoAssignRetryScheduler = vi.fn();

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        auditDispatcher: vi.fn(),
        inlineAutoAssignRunner: vi.fn(async () => {
          throw inlineError;
        }),
        onInlineAutoAssignError,
        sideEffectsDispatcher,
        autoAssignRetryScheduler,
      }),
    ).resolves.toEqual({ booking: pendingBooking });

    expect(onInlineAutoAssignError).toHaveBeenCalledWith(inlineError);
    expect(sideEffectsDispatcher).toHaveBeenCalled();
    expect(autoAssignRetryScheduler).toHaveBeenCalled();
  });

  it('keeps side-effect dispatch errors non-fatal and still schedules retry', async () => {
    const sideEffectError = new Error('side effects failed');
    const onSideEffectsError = vi.fn();
    const autoAssignRetryScheduler = vi.fn();

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        auditDispatcher: vi.fn(),
        inlineAutoAssignRunner: vi.fn(async () => null),
        onSideEffectsError,
        sideEffectsDispatcher: vi.fn(async () => {
          throw sideEffectError;
        }),
        autoAssignRetryScheduler,
      }),
    ).resolves.toEqual({ booking: pendingBooking });

    expect(onSideEffectsError).toHaveBeenCalledWith(sideEffectError);
    expect(autoAssignRetryScheduler).toHaveBeenCalled();
  });

  it('keeps retry scheduling errors non-fatal', async () => {
    const retryError = new Error('retry failed');
    const onAutoAssignError = vi.fn();

    await expect(
      finalizeBookingCreateCommit({
        ...baseArgs,
        auditDispatcher: vi.fn(),
        inlineAutoAssignRunner: vi.fn(async () => null),
        sideEffectsDispatcher: vi.fn(),
        onAutoAssignError,
        autoAssignRetryScheduler: vi.fn(async () => {
          throw retryError;
        }),
      }),
    ).resolves.toEqual({ booking: pendingBooking });

    expect(onAutoAssignError).toHaveBeenCalledWith(retryError);
  });
});
