import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordBookingForCustomerProfileMock = vi.hoisted(() => vi.fn());
const recordCancellationForCustomerProfileMock = vi.hoisted(() => vi.fn());
const assertActiveOccasionKeyMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/customers', () => ({
  findCustomerByContact: vi.fn(),
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  normalizePhone: (value: string | null | undefined) => value ?? null,
  recordBookingForCustomerProfile: recordBookingForCustomerProfileMock,
  recordCancellationForCustomerProfile: recordCancellationForCustomerProfileMock,
}));

vi.mock('@/server/occasions/validateBookingType', () => ({
  assertActiveOccasionKey: assertActiveOccasionKeyMock,
}));

import {
  insertBookingRecord,
  softCancelBooking,
  updateBookingAndClearAssignmentsAtomically,
} from '@/server/bookings';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    booking_date: '2026-07-01',
    start_time: '19:00',
    end_time: '20:30',
    party_size: 4,
    booking_type: 'dinner',
    seating_preference: 'any',
    status: 'pending',
    reference: 'ABC123',
    customer_name: 'Guest',
    customer_email: 'guest@example.com',
    customer_phone: '+447700900123',
    customer_id: 'customer-1',
    notes: null,
    marketing_opt_in: false,
    loyalty_points_awarded: 0,
    source: 'web',
    client_request_id: 'request-1',
    idempotency_key: null,
    details: null,
    auto_assign_idempotency_key: 'auto-key',
    created_at: '2026-05-16T09:52:00.000Z',
    updated_at: '2026-05-16T09:52:00.000Z',
    ...overrides,
  };
}

function makeQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    insert: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    neq: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => result),
    update: vi.fn(() => query),
  };
  return query;
}

function makeClientForQueries(queries: ReturnType<typeof makeQuery>[], rpcResult?: unknown) {
  const queue = [...queries];
  return {
    from: vi.fn(() => {
      const query = queue.shift();
      if (!query) {
        throw new Error('Unexpected query');
      }
      return query;
    }),
    rpc: vi.fn(async () => ({ data: rpcResult ?? makeBooking(), error: null })),
  };
}

describe('booking profile consistency helpers', () => {
  beforeEach(() => {
    recordBookingForCustomerProfileMock.mockReset();
    recordCancellationForCustomerProfileMock.mockReset();
    assertActiveOccasionKeyMock.mockReset();
    assertActiveOccasionKeyMock.mockImplementation(async (value) => value);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the inserted booking when derived customer profile maintenance fails', async () => {
    const insertQuery = makeQuery({ data: makeBooking(), error: null });
    const client = makeClientForQueries([insertQuery]);
    recordBookingForCustomerProfileMock.mockRejectedValue(new Error('profile unavailable'));

    const booking = await insertBookingRecord(client as never, {
      restaurant_id: 'rest-1',
      booking_date: '2026-07-01',
      start_time: '19:00',
      end_time: '20:30',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      reference: 'ABC123',
      customer_name: 'Guest',
      customer_email: 'guest@example.com',
      customer_phone: '+447700900123',
      customer_id: 'customer-1',
      client_request_id: 'request-1',
    });

    expect(booking.id).toBe('booking-1');
    expect(recordBookingForCustomerProfileMock).toHaveBeenCalledTimes(1);
  });

  it('records cancellation profile data only on a real non-cancelled transition', async () => {
    const updateQuery = makeQuery({
      data: makeBooking({ status: 'cancelled' }),
      error: null,
    });
    const client = makeClientForQueries([updateQuery]);
    recordCancellationForCustomerProfileMock.mockRejectedValue(new Error('profile unavailable'));

    const result = await softCancelBooking(client as never, 'booking-1');

    expect(result).toMatchObject({ cancelled: true, booking: { status: 'cancelled' } });
    expect(updateQuery.neq).toHaveBeenCalledWith('status', 'cancelled');
    expect(recordCancellationForCustomerProfileMock).toHaveBeenCalledTimes(1);
  });

  it('scopes soft cancellation updates and readback to the authorized restaurant when provided', async () => {
    const updateQuery = makeQuery({ data: null, error: null });
    const readQuery = makeQuery({
      data: makeBooking({ status: 'cancelled' }),
      error: null,
    });
    const client = makeClientForQueries([updateQuery, readQuery]);

    await softCancelBooking(client as never, 'booking-1', { restaurantId: 'rest-1' });

    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(updateQuery.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(readQuery.eq).toHaveBeenCalledWith('id', 'booking-1');
    expect(readQuery.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
  });

  it('does not double-count customer cancellations for an already-cancelled booking', async () => {
    const updateQuery = makeQuery({ data: null, error: null });
    const readQuery = makeQuery({
      data: makeBooking({ status: 'cancelled' }),
      error: null,
    });
    const client = makeClientForQueries([updateQuery, readQuery]);

    const result = await softCancelBooking(client as never, 'booking-1');

    expect(result).toMatchObject({ cancelled: false, booking: { status: 'cancelled' } });
    expect(recordCancellationForCustomerProfileMock).not.toHaveBeenCalled();
  });

  it('sends modification updates and assignment cleanup through one RPC', async () => {
    const client = makeClientForQueries([], makeBooking({ status: 'pending' }));

    const booking = await updateBookingAndClearAssignmentsAtomically(
      client as never,
      'booking-1',
      {
        booking_date: '2026-07-02',
        start_time: '20:00',
        status: 'pending',
      },
      { restaurantId: 'rest-1' },
    );

    expect(booking.status).toBe('pending');
    expect(client.rpc).toHaveBeenCalledWith('update_booking_and_clear_assignments', {
      p_booking_id: 'booking-1',
      p_patch: {
        booking_date: '2026-07-02',
        start_time: '20:00',
        status: 'pending',
      },
      p_restaurant_id: 'rest-1',
    });
  });
});
