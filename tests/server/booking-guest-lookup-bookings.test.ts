import { describe, expect, it, vi } from 'vitest';

import { toGuestBookingDTO, type GuestBookingSource } from '@/server/bookings/guest-booking-dto';
import {
  buildGuestLookupAccessDiagnostics,
  markGuestLookupRateSource,
} from '@/server/bookings/guest-lookup-access';
import { fetchGuestLookupBookings } from '@/server/bookings/guest-lookup-bookings';

type FetchGuestLookupBookingsParams = Parameters<typeof fetchGuestLookupBookings>[0];

const legacyClient = {} as FetchGuestLookupBookingsParams['legacyClient'];
const policyClient = { kind: 'policy-client' };

function buildAccess() {
  return markGuestLookupRateSource(buildGuestLookupAccessDiagnostics({ accessToken: null }), {
    rateSource: 'memory',
  });
}

function bookingSource(id: string): GuestBookingSource {
  return {
    id,
    restaurant_id: 'restaurant-1',
    booking_date: '2026-05-23',
    start_time: '18:30',
    end_time: '20:00',
    party_size: 2,
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    customer_name: 'Guest',
  };
}

describe('fetchGuestLookupBookings', () => {
  it('returns policy bookings and policy observability when policy lookup matches', async () => {
    const policyBookings = [toGuestBookingDTO(bookingSource('policy-1'))];
    const policyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['policyFetch']>>(
      async () => ({
        status: 'matched',
        bookings: policyBookings,
      }),
    );
    const legacyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['legacyFetch']>>();

    await expect(
      fetchGuestLookupBookings({
        policyClient,
        legacyClient,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '+447700900123',
        access: buildAccess(),
        policyEnabled: true,
        source: 'api.bookings',
        ipScope: '127.0.0.0/24',
        contactHashFor: vi.fn(() => 'hash-1'),
        policyFetch,
        legacyFetch,
      }),
    ).resolves.toMatchObject({
      bookings: [expect.objectContaining({ id: 'policy-1' })],
      access: {
        policyEnabled: true,
        lookupStrategy: 'policy',
      },
      allowedEvent: {
        eventType: 'guest_lookup.allowed',
        context: {
          count: 1,
          policy_enabled: true,
          lookup_strategy: 'policy',
          rate_source: 'memory',
        },
      },
    });

    expect(policyFetch).toHaveBeenCalledWith({
      client: policyClient,
      restaurantId: 'restaurant-1',
      contactHash: 'hash-1',
    });
    expect(legacyFetch).not.toHaveBeenCalled();
  });

  it('falls back to legacy lookup and returns policy RPC log metadata', async () => {
    const policyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['policyFetch']>>(
      async () => ({
        status: 'fallback',
        errorMessage: 'database unavailable',
        shouldLogError: true,
      }),
    );
    const legacyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['legacyFetch']>>(
      async () => [bookingSource('legacy-1')],
    );

    await expect(
      fetchGuestLookupBookings({
        policyClient,
        legacyClient,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '+447700900123',
        access: buildAccess(),
        policyEnabled: true,
        source: 'api.bookings',
        ipScope: '127.0.0.0/24',
        contactHashFor: () => 'hash-1',
        policyFetch,
        legacyFetch,
      }),
    ).resolves.toMatchObject({
      bookings: [expect.objectContaining({ id: 'legacy-1' })],
      access: {
        policyEnabled: true,
        lookupStrategy: 'legacy-fallback',
      },
      allowedEvent: {
        context: {
          policy_enabled: true,
          lookup_strategy: 'legacy-fallback',
        },
      },
      policyLog: {
        kind: 'rpc_failed',
        message: 'database unavailable',
      },
    });

    expect(legacyFetch).toHaveBeenCalledWith(
      legacyClient,
      'restaurant-1',
      'guest@example.com',
      '+447700900123',
    );
  });

  it('falls back to legacy lookup and captures unexpected policy errors', async () => {
    const legacyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['legacyFetch']>>(
      async () => [bookingSource('legacy-after-throw')],
    );

    await expect(
      fetchGuestLookupBookings({
        policyClient,
        legacyClient,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '+447700900123',
        access: buildAccess(),
        policyEnabled: true,
        source: 'api.bookings',
        ipScope: '127.0.0.0/24',
        contactHashFor: () => 'hash-1',
        policyFetch: async () => {
          throw new Error('policy exploded');
        },
        legacyFetch,
      }),
    ).resolves.toMatchObject({
      bookings: [expect.objectContaining({ id: 'legacy-after-throw' })],
      access: {
        lookupStrategy: 'legacy-fallback',
      },
      policyLog: {
        kind: 'unexpected_error',
        message: expect.stringContaining('policy exploded'),
      },
    });
  });

  it('uses legacy lookup directly when policy is disabled', async () => {
    const legacyFetch = vi.fn<NonNullable<FetchGuestLookupBookingsParams['legacyFetch']>>(
      async () => [bookingSource('legacy-only')],
    );
    const contactHashFor = vi.fn(() => 'hash-should-not-be-used');

    await expect(
      fetchGuestLookupBookings({
        policyClient,
        legacyClient,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '+447700900123',
        access: buildAccess(),
        policyEnabled: false,
        source: 'api.bookings',
        ipScope: '127.0.0.0/24',
        contactHashFor,
        policyFetch: async () => ({
          status: 'matched',
          bookings: [],
        }),
        legacyFetch,
      }),
    ).resolves.toMatchObject({
      bookings: [expect.objectContaining({ id: 'legacy-only' })],
      access: {
        policyEnabled: false,
        lookupStrategy: 'legacy',
      },
      allowedEvent: {
        context: {
          policy_enabled: false,
          lookup_strategy: 'legacy',
        },
      },
    });

    expect(contactHashFor).not.toHaveBeenCalled();
    expect(legacyFetch).toHaveBeenCalledOnce();
  });
});
