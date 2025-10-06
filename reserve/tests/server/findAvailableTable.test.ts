import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as bookingsModule from '../../../server/bookings';

import type { SupabaseClient } from '@supabase/supabase-js';

type TableRow = bookingsModule.TableRecord & { restaurant_id: string };

type BookingRow = {
  id: string;
  table_id: string | null;
  restaurant_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type Metrics = {
  queries: number;
};

class BookingsQuery {
  private filters: Array<(row: BookingRow) => boolean> = [];

  constructor(
    private readonly rows: BookingRow[],
    private readonly metrics: Metrics,
  ) {}

  select(): this {
    return this;
  }

  eq(field: keyof BookingRow, value: string): this {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: keyof BookingRow, values: string[]): this {
    this.filters.push((row) => values.includes(String(row[field] ?? '')));
    return this;
  }

  order(): this {
    return this;
  }

  private execute() {
    this.metrics.queries += 1;
    let data = this.rows;
    for (const filter of this.filters) {
      data = data.filter(filter);
    }
    return { data, error: null } as const;
  }

  then<TResult1 = { data: BookingRow[]; error: null }, TResult2 = never>(
    onFulfilled?:
      | ((value: { data: BookingRow[]; error: null }) => TResult1 | Promise<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      if (onFulfilled) {
        return Promise.resolve(onFulfilled(result));
      }
      return Promise.resolve(result as unknown as TResult1);
    } catch (error) {
      if (onRejected) {
        return Promise.resolve(onRejected(error));
      }
      return Promise.reject(error);
    }
  }
}

class TablesQuery {
  private filters: Array<(row: TableRow) => boolean> = [];
  private orderField: keyof TableRow | null = null;
  private ascending = true;

  constructor(private readonly rows: TableRow[]) {}

  select(): this {
    return this;
  }

  eq(field: keyof TableRow, value: string): this {
    this.filters.push((row) => String(row[field]) === value);
    return this;
  }

  gte(field: keyof TableRow, value: number): this {
    this.filters.push((row) => Number(row[field]) >= value);
    return this;
  }

  in(field: keyof TableRow, values: string[]): this {
    this.filters.push((row) => values.includes(String(row[field])));
    return this;
  }

  order(field: keyof TableRow, options?: { ascending?: boolean }): this {
    this.orderField = field;
    this.ascending = options?.ascending !== false;
    return this;
  }

  private execute() {
    let data = this.rows;
    for (const filter of this.filters) {
      data = data.filter(filter);
    }

    if (this.orderField) {
      const key = this.orderField;
      data = [...data].sort((a, b) => {
        const left = Number(a[key]);
        const right = Number(b[key]);
        return this.ascending ? left - right : right - left;
      });
    }

    const mapped = data.map<TableRow>((row) => ({ ...row }));
    return {
      data: mapped.map<bookingsModule.TableRecord>(
        ({ restaurant_id: _restaurant_id, ...rest }) => rest,
      ),
      error: null,
    } as const;
  }

  then<TResult1 = { data: bookingsModule.TableRecord[]; error: null }, TResult2 = never>(
    onFulfilled?:
      | ((value: {
          data: bookingsModule.TableRecord[];
          error: null;
        }) => TResult1 | Promise<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      if (onFulfilled) {
        return Promise.resolve(onFulfilled(result));
      }
      return Promise.resolve(result as unknown as TResult1);
    } catch (error) {
      if (onRejected) {
        return Promise.resolve(onRejected(error));
      }
      return Promise.reject(error);
    }
  }
}

class FakeSupabaseClient {
  constructor(
    private readonly tableRows: TableRow[],
    private readonly bookingsRows: BookingRow[],
    private readonly metrics: Metrics,
  ) {}

  from(table: string) {
    if (table === 'restaurant_tables') {
      return new TablesQuery(this.tableRows);
    }
    if (table === 'bookings') {
      return new BookingsQuery(this.bookingsRows, this.metrics);
    }
    throw new Error(`Unexpected table ${table}`);
  }
}

const cacheStore = new Map<string, BookingRow[]>();

vi.mock('../../../server/cache/availability', async () => {
  return {
    isAvailabilityCacheEnabled: vi.fn(() => true),
    readAvailabilitySnapshot: vi.fn(async (restaurantId: string, bookingDate: string) => {
      const key = `${restaurantId}:${bookingDate}`;
      if (!cacheStore.has(key)) {
        return { status: 'miss' } as const;
      }
      return { status: 'hit', value: cacheStore.get(key)! } as const;
    }),
    writeAvailabilitySnapshot: vi.fn(
      async (restaurantId: string, bookingDate: string, snapshot: BookingRow[]) => {
        cacheStore.set(`${restaurantId}:${bookingDate}`, snapshot);
      },
    ),
    invalidateAvailabilitySnapshot: vi.fn(async (restaurantId: string, bookingDate: string) => {
      cacheStore.delete(`${restaurantId}:${bookingDate}`);
    }),
  };
});

vi.mock('../../../server/observability', () => ({
  recordObservabilityEvent: vi.fn(async () => {}),
}));

const restaurantId = 'restaurant-1';
const bookingDate = '2024-07-19';

const baseTables: TableRow[] = [
  {
    id: 'table-1',
    label: 'Table 1',
    seating_type: 'indoor',
    capacity: 2,
    features: null,
    restaurant_id: restaurantId,
  },
  {
    id: 'table-2',
    label: 'Table 2',
    seating_type: 'indoor',
    capacity: 4,
    features: null,
    restaurant_id: restaurantId,
  },
  {
    id: 'table-3',
    label: 'Table 3',
    seating_type: 'patio',
    capacity: 4,
    features: null,
    restaurant_id: restaurantId,
  },
];

function cloneTables(): TableRow[] {
  return baseTables.map((row) => ({ ...row }));
}

describe('findAvailableTable', () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns the first non-conflicting table', async () => {
    const metrics: Metrics = { queries: 0 };
    const bookings: BookingRow[] = [
      {
        id: 'booking-1',
        table_id: 'table-1',
        restaurant_id: restaurantId,
        booking_date: bookingDate,
        start_time: '18:00',
        end_time: '20:00',
        status: 'confirmed',
      },
    ];
    const client = new FakeSupabaseClient(
      cloneTables(),
      bookings,
      metrics,
    ) as unknown as SupabaseClient;

    const table = await bookingsModule.findAvailableTable(
      client,
      restaurantId,
      bookingDate,
      '20:30',
      '22:00',
      2,
      'indoor',
    );

    expect(table?.id).toBe('table-1');
    expect(metrics.queries).toBe(1);
  });

  it('skips conflicting tables and reuses cached snapshot', async () => {
    const metrics: Metrics = { queries: 0 };
    const rows: BookingRow[] = [
      {
        id: 'booking-1',
        table_id: 'table-1',
        restaurant_id: restaurantId,
        booking_date: bookingDate,
        start_time: '18:30',
        end_time: '20:00',
        status: 'confirmed',
      },
      {
        id: 'booking-2',
        table_id: 'table-2',
        restaurant_id: restaurantId,
        booking_date: bookingDate,
        start_time: '19:00',
        end_time: '21:00',
        status: 'confirmed',
      },
    ];

    const client = new FakeSupabaseClient(
      cloneTables(),
      rows,
      metrics,
    ) as unknown as SupabaseClient;

    const first = await bookingsModule.findAvailableTable(
      client,
      restaurantId,
      bookingDate,
      '19:30',
      '21:00',
      4,
      'any',
    );

    expect(first?.id).toBe('table-3');
    expect(metrics.queries).toBe(1);

    const second = await bookingsModule.findAvailableTable(
      client,
      restaurantId,
      bookingDate,
      '19:30',
      '21:00',
      4,
      'any',
    );

    expect(second?.id).toBe('table-3');
    expect(metrics.queries).toBe(1);
  });
});
