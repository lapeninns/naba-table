import { describe, expect, it, vi } from 'vitest';

import {
  recoverBookingRecord,
  resolveMissingBookingCreateRecord,
  type BookingCreateObservabilityRecorder,
  type MissingBookingCreateRecordArgs,
  type BookingRecoveryClient,
  type RecoverBookingRecordArgs,
} from '@/server/bookings/recovery';

import type { BookingRecord } from '@/server/bookings';

type QueryResult = {
  data: unknown;
  error: unknown;
};

type QueryLog = Array<
  | { op: 'from'; table: string }
  | { op: 'select'; columns: string }
  | { op: 'eq'; column: string; value: string }
  | { op: 'order'; column: string; options: { ascending: boolean } }
  | { op: 'limit'; count: number }
  | { op: 'maybeSingle' }
>;

function createClient(results: QueryResult[]) {
  const log: QueryLog = [];
  let index = 0;

  class FilterableQuery {
    eq(column: string, value: string) {
      log.push({ op: 'eq', column, value });
      return this;
    }

    order(column: string, options: { ascending: boolean }) {
      log.push({ op: 'order', column, options });
      return this;
    }

    limit(count: number) {
      log.push({ op: 'limit', count });
      return this;
    }

    async maybeSingle() {
      log.push({ op: 'maybeSingle' });
      const result = results[index] ?? { data: null, error: null };
      index += 1;
      return result;
    }
  }

  class TableQuery {
    select(columns: string) {
      log.push({ op: 'select', columns });
      return new FilterableQuery();
    }
  }

  const client: BookingRecoveryClient = {
    from(table: 'bookings') {
      log.push({ op: 'from', table });
      return new TableQuery();
    },
  };

  return { client, log };
}

const args: RecoverBookingRecordArgs = {
  restaurantId: 'restaurant-1',
  idempotencyKey: 'idem-1',
  customerId: 'customer-1',
  bookingDate: '2026-05-22',
  startTime: '18:30',
  endTime: '20:00',
};

const missingRecordArgs: MissingBookingCreateRecordArgs = {
  recovery: args,
  fallback: {
    request: {
      restaurantId: '11111111-1111-4111-8111-111111111111',
      restaurantSlug: 'old-crown',
      date: '2026-05-22',
      time: '18:00',
      party: 4,
      bookingType: 'dinner',
      notes: undefined,
      name: 'Ada Lovelace',
      email: ' Ada@Example.COM ',
      phone: ' 07123456789 ',
      marketingOptIn: undefined,
    },
    customer: { id: 'customer-1' },
    restaurantId: 'restaurant-1',
    bookingType: 'dinner',
    startTime: '18:30',
    endTime: '20:00',
    durationMinutes: 90,
    idempotencyKey: 'idem-1',
    bookingSource: 'api',
    clientRequestId: 'request-1',
    bookingDetails: { channel: 'api' },
  },
  restaurantId: 'restaurant-1',
  source: 'api.bookings',
};

describe('booking record recovery', () => {
  it('returns the idempotency-key match before trying signature fallback', async () => {
    const booking = { id: 'booking-idem' };
    const { client, log } = createClient([{ data: booking, error: null }]);

    await expect(recoverBookingRecord(client, args)).resolves.toBe(booking);

    expect(log).toEqual([
      { op: 'from', table: 'bookings' },
      { op: 'select', columns: '*' },
      { op: 'eq', column: 'restaurant_id', value: 'restaurant-1' },
      { op: 'eq', column: 'customer_id', value: 'customer-1' },
      { op: 'eq', column: 'idempotency_key', value: 'idem-1' },
      { op: 'maybeSingle' },
    ]);
  });

  it('falls back to the booking signature when idempotency lookup misses', async () => {
    const booking = { id: 'booking-signature' };
    const { client, log } = createClient([
      { data: null, error: null },
      { data: booking, error: null },
    ]);

    await expect(recoverBookingRecord(client, args)).resolves.toBe(booking);

    expect(log).toEqual([
      { op: 'from', table: 'bookings' },
      { op: 'select', columns: '*' },
      { op: 'eq', column: 'restaurant_id', value: 'restaurant-1' },
      { op: 'eq', column: 'customer_id', value: 'customer-1' },
      { op: 'eq', column: 'idempotency_key', value: 'idem-1' },
      { op: 'maybeSingle' },
      { op: 'from', table: 'bookings' },
      { op: 'select', columns: '*' },
      { op: 'eq', column: 'restaurant_id', value: 'restaurant-1' },
      { op: 'eq', column: 'customer_id', value: 'customer-1' },
      { op: 'eq', column: 'booking_date', value: '2026-05-22' },
      { op: 'eq', column: 'start_time', value: '18:30' },
      { op: 'eq', column: 'end_time', value: '20:00' },
      { op: 'order', column: 'created_at', options: { ascending: false } },
      { op: 'limit', count: 1 },
      { op: 'maybeSingle' },
    ]);
  });

  it('skips idempotency lookup when no key is available', async () => {
    const booking = { id: 'booking-signature' };
    const { client, log } = createClient([{ data: booking, error: null }]);

    await expect(recoverBookingRecord(client, { ...args, idempotencyKey: null })).resolves.toBe(
      booking,
    );

    expect(log[0]).toEqual({ op: 'from', table: 'bookings' });
    expect(log).not.toContainEqual({ op: 'eq', column: 'idempotency_key', value: 'idem-1' });
  });

  it('returns null when both recovery strategies miss or error', async () => {
    const { client } = createClient([
      { data: { id: 'ignored-error' }, error: new Error('idempotency failed') },
      { data: { id: 'ignored-signature' }, error: new Error('signature failed') },
    ]);

    await expect(recoverBookingRecord(client, args)).resolves.toBeNull();
  });

  it('resolves a missing create result with a recovered booking and records observability', async () => {
    const recovered = { id: 'booking-recovered' } as BookingRecord;
    const recoverer = vi.fn(async () => recovered);
    const observabilityRecorder = vi.fn<BookingCreateObservabilityRecorder>(async () => undefined);
    const client = {} as Parameters<typeof resolveMissingBookingCreateRecord>[0]['client'];

    await expect(
      resolveMissingBookingCreateRecord({
        client,
        observabilityRecorder,
        recoverer,
        resolveArgs: missingRecordArgs,
      }),
    ).resolves.toBe(recovered);

    expect(observabilityRecorder).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.create.recovered',
      severity: 'warning',
      context: {
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
        method: 'idempotency_key',
      },
    });
  });

  it('returns null when recovery misses and records guarded failure observability', async () => {
    const recoverer = vi.fn(async () => null);
    const observabilityRecorder = vi.fn<BookingCreateObservabilityRecorder>(async () => undefined);
    const client = {} as Parameters<typeof resolveMissingBookingCreateRecord>[0]['client'];

    await expect(
      resolveMissingBookingCreateRecord({
        client,
        observabilityRecorder,
        recoverer,
        resolveArgs: missingRecordArgs,
      }),
    ).resolves.toBeNull();

    expect(observabilityRecorder).toHaveBeenCalledWith({
      source: 'api.bookings',
      eventType: 'booking.create.recovery_failed',
      severity: 'error',
      context: {
        restaurantId: 'restaurant-1',
        idempotencyKey: 'idem-1',
      },
    });
  });
});
