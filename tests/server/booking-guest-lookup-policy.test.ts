import { describe, expect, it, vi } from 'vitest';

import {
  fetchGuestLookupPolicyBookings,
  isMissingGuestLookupPolicyFunction,
  mapGuestLookupPolicyRows,
  type GuestLookupPolicyRpcClient,
} from '@/server/bookings/guest-lookup-policy';

describe('guest lookup policy helper', () => {
  it('maps valid RPC rows and filters non-booking payloads', () => {
    expect(
      mapGuestLookupPolicyRows([
        null,
        'not-a-row',
        { restaurant_id: 'missing-id' },
        {
          id: 'booking-1',
          restaurant_id: 'restaurant-1',
          booking_date: '2026-05-23',
          start_time: '18:30',
          party_size: 2,
          customer_email: 'guest@example.com',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'booking-1',
        restaurant_id: 'restaurant-1',
        booking_date: '2026-05-23',
        start_time: '18:30',
        party_size: 2,
        customer_email: 'guest@example.com',
        notes: null,
      }),
    ]);
  });

  it('calls the guest lookup RPC and returns mapped bookings', async () => {
    const client: GuestLookupPolicyRpcClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ id: 'booking-1', booking_date: '2026-05-23', start_time: '19:00' }],
        error: null,
      }),
    };

    await expect(
      fetchGuestLookupPolicyBookings({
        client,
        restaurantId: 'restaurant-1',
        contactHash: 'hash-1',
      }),
    ).resolves.toEqual({
      status: 'matched',
      bookings: [
        expect.objectContaining({
          id: 'booking-1',
          booking_date: '2026-05-23',
          start_time: '19:00',
        }),
      ],
    });

    expect(client.rpc).toHaveBeenCalledWith('get_guest_bookings', {
      p_restaurant_id: 'restaurant-1',
      p_hash: 'hash-1',
    });
  });

  it('falls back silently when the RPC returns a non-array payload without an error', async () => {
    const client: GuestLookupPolicyRpcClient = {
      rpc: vi.fn().mockResolvedValue({ data: { unexpected: true }, error: null }),
    };

    await expect(
      fetchGuestLookupPolicyBookings({
        client,
        restaurantId: 'restaurant-1',
        contactHash: 'hash-1',
      }),
    ).resolves.toEqual({
      status: 'fallback',
      errorMessage: null,
      shouldLogError: false,
    });
  });

  it('suppresses logs for missing policy RPC function errors', async () => {
    const client: GuestLookupPolicyRpcClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42883', message: 'function get_guest_bookings does not exist' },
      }),
    };

    await expect(
      fetchGuestLookupPolicyBookings({
        client,
        restaurantId: 'restaurant-1',
        contactHash: 'hash-1',
      }),
    ).resolves.toEqual({
      status: 'fallback',
      errorMessage: expect.stringContaining('get_guest_bookings'),
      shouldLogError: false,
    });
  });

  it('flags unexpected RPC errors for route logging', async () => {
    const client: GuestLookupPolicyRpcClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'database unavailable' },
      }),
    };

    await expect(
      fetchGuestLookupPolicyBookings({
        client,
        restaurantId: 'restaurant-1',
        contactHash: 'hash-1',
      }),
    ).resolves.toEqual({
      status: 'fallback',
      errorMessage: expect.stringContaining('database unavailable'),
      shouldLogError: true,
    });
  });

  it('classifies missing-function errors by postgrest code, postgres code, or message', () => {
    expect(isMissingGuestLookupPolicyFunction({ code: 'PGRST100' }, 'other')).toBe(true);
    expect(isMissingGuestLookupPolicyFunction({ code: '42883' }, 'other')).toBe(true);
    expect(isMissingGuestLookupPolicyFunction({}, 'missing get_guest_bookings')).toBe(true);
    expect(isMissingGuestLookupPolicyFunction({ code: 'XX000' }, 'other')).toBe(false);
  });
});
