import { describe, expect, it, vi } from 'vitest';

import { hashIdempotencyKey } from '@/server/bookings/idempotency';
import {
  findBookingByIdempotencyKey,
  recoverBookingRecord,
  recoverBookingRecordWithMethod,
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
  | { op: 'eq'; column: string; value: string | number }
  | { op: 'not'; column: string; operator: string; value: string }
  | { op: 'order'; column: string; options: { ascending: boolean } }
  | { op: 'limit'; count: number }
  | { op: 'maybeSingle' }
>;

function createClient(results: QueryResult[]) {
  const log: QueryLog = [];
  let index = 0;

  class FilterableQuery {
    eq(column: string, value: string | number) {
      log.push({ op: 'eq', column, value });
      return this;
    }

    not(column: string, operator: string, value: string) {
      log.push({ op: 'not', column, operator, value });
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
  partySize: 4,
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
      { op: 'eq', column: 'party_size', value: 4 },
      { op: 'not', column: 'status', operator: 'in', value: '(cancelled,no_show)' },
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
    const recoverer = vi.fn(async () => ({ booking: recovered, method: 'idempotency_key' as const }));
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
        keyHash: hashIdempotencyKey('idem-1'),
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
        keyHash: hashIdempotencyKey('idem-1'),
      },
    });
  });

  it('reports whether the match came from the idempotency key or the slot signature', async () => {
    const keyed = createClient([{ data: { id: 'booking-idem' }, error: null }]);
    await expect(recoverBookingRecordWithMethod(keyed.client, args)).resolves.toEqual({
      booking: { id: 'booking-idem' },
      method: 'idempotency_key',
    });

    const signature = createClient([
      { data: null, error: null },
      { data: { id: 'booking-signature' }, error: null },
    ]);
    await expect(recoverBookingRecordWithMethod(signature.client, args)).resolves.toEqual({
      booking: { id: 'booking-signature' },
      method: 'signature',
    });
  });

  it('never logs the raw key in recovery observability', async () => {
    const observabilityRecorder = vi.fn<BookingCreateObservabilityRecorder>(async () => undefined);
    await resolveMissingBookingCreateRecord({
      client: {} as Parameters<typeof resolveMissingBookingCreateRecord>[0]['client'],
      observabilityRecorder,
      recoverer: vi.fn(async () => ({
        booking: { id: 'booking-signature' } as BookingRecord,
        method: 'signature' as const,
      })),
      resolveArgs: missingRecordArgs,
    });

    expect(JSON.stringify(observabilityRecorder.mock.calls)).not.toContain('idem-1');
    expect(observabilityRecorder.mock.calls[0]?.[0].context).toMatchObject({ method: 'signature' });
  });

  it('looks a key up per restaurant without a customer filter (unique index scope)', async () => {
    const booking = { id: 'booking-idem' };
    const { client, log } = createClient([{ data: booking, error: null }]);

    await expect(
      findBookingByIdempotencyKey(client, { restaurantId: 'restaurant-1', idempotencyKey: 'idem-1' }),
    ).resolves.toBe(booking);
    expect(log).toEqual([
      { op: 'from', table: 'bookings' },
      { op: 'select', columns: '*' },
      { op: 'eq', column: 'restaurant_id', value: 'restaurant-1' },
      { op: 'eq', column: 'idempotency_key', value: 'idem-1' },
      { op: 'maybeSingle' },
    ]);
  });
});

type Row = Record<string, string | number | null>;

/** Evaluates the recovery query's filters against in-memory rows, like PostgREST would. */
function createRowsClient(rows: Row[]): BookingRecoveryClient {
  class Query {
    private filters: Array<(row: Row) => boolean> = [];
    private sortColumn: string | null = null;
    private ascending = true;
    private max: number | null = null;

    eq(column: string, value: string | number) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    not(column: string, operator: string, value: string) {
      if (operator !== 'in') throw new Error(`unsupported operator ${operator}`);
      const excluded = value.replace(/^\(|\)$/g, '').split(',');
      this.filters.push((row) => !excluded.includes(String(row[column])));
      return this;
    }

    order(column: string, options: { ascending: boolean }) {
      this.sortColumn = column;
      this.ascending = options.ascending;
      return this;
    }

    limit(count: number) {
      this.max = count;
      return this;
    }

    async maybeSingle() {
      let matched = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.sortColumn) {
        const column = this.sortColumn;
        matched = [...matched].sort((a, b) =>
          String(a[column]).localeCompare(String(b[column])) * (this.ascending ? 1 : -1),
        );
      }
      if (this.max !== null) matched = matched.slice(0, this.max);
      if (matched.length > 1) return { data: null, error: new Error('multiple rows') };
      return { data: matched[0] ?? null, error: null };
    }
  }

  return {
    from() {
      return { select: () => new Query() };
    },
  };
}

describe('signature recovery ignores finished bookings (create, cancel, rebook)', () => {
  const slot = {
    restaurant_id: 'restaurant-1',
    customer_id: 'customer-1',
    booking_date: '2026-05-22',
    start_time: '18:30',
    end_time: '20:00',
    party_size: 4,
    idempotency_key: 'first-attempt-key',
  };
  const rebook: RecoverBookingRecordArgs = { ...args, idempotencyKey: 'second-attempt-key' };

  it('does not return a cancelled booking in the same slot, so the rebook inserts a new one', async () => {
    const client = createRowsClient([
      { ...slot, id: 'booking-cancelled', status: 'cancelled', created_at: '2026-05-01T10:00:00Z' },
    ]);

    await expect(recoverBookingRecord(client, rebook)).resolves.toBeNull();
  });

  it('does not return a no-show booking in the same slot', async () => {
    const client = createRowsClient([
      { ...slot, id: 'booking-no-show', status: 'no_show', created_at: '2026-05-01T10:00:00Z' },
    ]);

    await expect(recoverBookingRecord(client, rebook)).resolves.toBeNull();
  });

  it('does not treat a different party size as the same booking', async () => {
    const client = createRowsClient([
      { ...slot, id: 'booking-two', party_size: 2, status: 'confirmed', created_at: '2026-05-01T10:00:00Z' },
    ]);

    await expect(recoverBookingRecord(client, rebook)).resolves.toBeNull();
  });

  it('still recovers the live booking when a cancelled one shares the slot', async () => {
    const client = createRowsClient([
      { ...slot, id: 'booking-cancelled', status: 'cancelled', created_at: '2026-05-01T10:00:00Z' },
      {
        ...slot,
        id: 'booking-live',
        status: 'confirmed',
        idempotency_key: 'another-key',
        created_at: '2026-05-02T10:00:00Z',
      },
    ]);

    await expect(recoverBookingRecord(client, rebook)).resolves.toMatchObject({ id: 'booking-live' });
  });
});
