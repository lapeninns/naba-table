import { describe, expect, it, vi } from 'vitest';

import { BookingNotCancellableError, softCancelBooking } from '@/server/bookings';

function clientWithRpc(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(async () => result) } as never;
}

describe('softCancelBooking status guard', () => {
  it('turns the DB booking_not_cancellable raise into BookingNotCancellableError', async () => {
    const client = clientWithRpc({
      data: null,
      error: {
        code: 'P0004',
        message: 'booking_not_cancellable',
        details: '{"currentStatus": "checked_in"}',
      },
    });

    const failure = await softCancelBooking(client, 'booking-1', {
      restaurantId: 'restaurant-1',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BookingNotCancellableError);
    expect(failure).toMatchObject({
      code: 'BOOKING_NOT_CANCELLABLE',
      currentStatus: 'checked_in',
    });
  });

  it('ignores an unexpected DETAIL payload rather than trusting it', async () => {
    const client = clientWithRpc({
      data: null,
      error: { code: 'P0004', message: 'booking_not_cancellable', details: 'not json' },
    });

    await expect(
      softCancelBooking(client, 'booking-1', { restaurantId: 'restaurant-1' }),
    ).rejects.toMatchObject({ code: 'BOOKING_NOT_CANCELLABLE', currentStatus: null });
  });

  it('rethrows other RPC errors unchanged', async () => {
    const rpcError = {
      code: 'P0002',
      message: 'Booking not found for restaurant-scoped cancellation',
    };
    const client = clientWithRpc({ data: null, error: rpcError });

    await expect(
      softCancelBooking(client, 'booking-1', { restaurantId: 'restaurant-1' }),
    ).rejects.toBe(rpcError);
  });
});
