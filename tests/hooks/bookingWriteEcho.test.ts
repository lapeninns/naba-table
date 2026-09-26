import { createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import {
  BOOKING_WRITE_ECHO_WINDOW_MS,
  bookingIdFromRealtimePayload,
  isOwnBookingWriteEcho,
  recordBookingWrite,
} from '@src/hooks/ops/bookingWriteEcho';

const bookingsPayload = (status: string, updatedAt?: string) => ({
  new: { id: 'b1', status, ...(updatedAt ? { updated_at: updatedAt } : {}) },
  old: { id: 'b1' },
});

describe('bookingWriteEcho', () => {
  it('@contract reads the booking id from `id` on bookings rows and `booking_id` elsewhere', () => {
    expect(bookingIdFromRealtimePayload('bookings', { new: { id: 'b1' } })).toBe('b1');
    expect(bookingIdFromRealtimePayload('booking_history', { new: { booking_id: 'b2' } })).toBe(
      'b2',
    );
    expect(bookingIdFromRealtimePayload('allocations', { old: { booking_id: 'b3' } })).toBe('b3');
    expect(bookingIdFromRealtimePayload('table_holds', { new: {} })).toBeNull();
    expect(bookingIdFromRealtimePayload('bookings', null)).toBeNull();
  });

  it('@contract treats events for a recent own write as echoes, within the window only', () => {
    const queryClient = createTestQueryClient();
    const now = 1_000_000;
    recordBookingWrite(queryClient, 'b1', { status: 'checked_in' }, now);

    expect(
      isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('checked_in'), now + 100),
    ).toBe(true);
    expect(
      isOwnBookingWriteEcho(
        queryClient,
        'booking_history',
        { new: { booking_id: 'b1' } },
        now + 100,
      ),
    ).toBe(true);
    expect(
      isOwnBookingWriteEcho(
        queryClient,
        'bookings',
        bookingsPayload('checked_in'),
        now + BOOKING_WRITE_ECHO_WINDOW_MS + 1,
      ),
    ).toBe(false);
  });

  it('@contract lets a different status through: another client changed the booking', () => {
    const queryClient = createTestQueryClient();
    const now = 1_000_000;
    recordBookingWrite(queryClient, 'b1', { status: 'checked_in' }, now);

    expect(
      isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('cancelled'), now + 50),
    ).toBe(false);
  });

  it('@contract matches on updated_at when the server returned it', () => {
    const queryClient = createTestQueryClient();
    const now = 1_000_000;
    recordBookingWrite(queryClient, 'b1', { status: null, updatedAt: '2026-07-11T18:00:00Z' }, now);

    expect(
      isOwnBookingWriteEcho(
        queryClient,
        'bookings',
        bookingsPayload('confirmed', '2026-07-11T18:00:00Z'),
        now,
      ),
    ).toBe(true);
  });

  it('@contract lets a same-status edit by someone else through when updated_at differs', () => {
    const queryClient = createTestQueryClient();
    const now = 1_000_000;
    recordBookingWrite(
      queryClient,
      'b1',
      { status: 'checked_in', updatedAt: '2026-07-11T18:00:00Z' },
      now,
    );

    expect(
      isOwnBookingWriteEcho(
        queryClient,
        'bookings',
        bookingsPayload('checked_in', '2026-07-11T18:00:02Z'),
        now + 50,
      ),
    ).toBe(false);
    // Without updated_at on the event, status still identifies the echo.
    expect(
      isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('checked_in'), now + 50),
    ).toBe(true);
  });

  it('@contract a write with unknown status and version suppresses no bookings-row event', () => {
    const queryClient = createTestQueryClient();
    const now = 1_000_000;
    recordBookingWrite(queryClient, 'b1', { status: null }, now);

    expect(
      isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('confirmed'), now + 50),
    ).toBe(false);
    // The assignment echo of that write is still suppressed.
    expect(
      isOwnBookingWriteEcho(
        queryClient,
        'booking_table_assignments',
        { new: { booking_id: 'b1' } },
        now + 50,
      ),
    ).toBe(true);
  });

  it('@contract suppresses events while a write for the booking is in flight', async () => {
    const queryClient = createTestQueryClient();
    let release!: () => void;
    const pending = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      })
      .execute({ bookingId: 'b1' });

    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('cancelled'))).toBe(true);
    expect(
      isOwnBookingWriteEcho(queryClient, 'bookings', { new: { id: 'other', status: 'cancelled' } }),
    ).toBe(false);

    release();
    await pending;
    expect(isOwnBookingWriteEcho(queryClient, 'bookings', bookingsPayload('cancelled'))).toBe(
      false,
    );
  });

  it('@contract keeps registries per query client', () => {
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    recordBookingWrite(first, 'b1', { status: 'checked_in' });

    expect(isOwnBookingWriteEcho(second, 'bookings', bookingsPayload('checked_in'))).toBe(false);
  });
});
