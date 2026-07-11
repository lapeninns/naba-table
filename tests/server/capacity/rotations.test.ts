import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { getVenuePolicy } from '@/server/capacity/policy';
import {
  calculateCapacityForTables,
  calculateRestaurantCapacityByService,
} from '@/server/capacity/rotations';

import type { VenuePolicy } from '@/server/capacity/policy';

type TableRow = {
  id: string;
  table_number: string;
  capacity: number | null;
  status: string;
  min_party_size?: number | null;
  max_party_size?: number | null;
};

function table(overrides: Partial<TableRow> = {}): TableRow {
  return {
    id: 't1',
    table_number: '1',
    capacity: 2,
    status: 'available',
    ...overrides,
  };
}

const asTables = (rows: TableRow[]) => rows as never[];

describe('calculateCapacityForTables (rotation math)', () => {
  it('@contract computes rotations and covers per table for the default lunch service', () => {
    // Default policy: lunch 12:00-15:00 (180 min), no buffers, bands 2->60, 4->75.
    const summary = calculateCapacityForTables('lunch', asTables([
      table({ id: 't1', table_number: '1', capacity: 2 }),
      table({ id: 't2', table_number: '2', capacity: 4 }),
    ]))!;

    expect(summary.service).toBe('lunch');
    expect(summary.serviceMinutes).toBe(180);
    expect(summary.tables).toHaveLength(2);
    expect(summary.tables[0]).toEqual({
      tableId: 't1',
      tableNumber: '1',
      capacity: 2,
      minPartySize: 1,
      maxPartySize: null,
      status: 'available',
      effectivePartySize: 2,
      diningMinutes: 60,
      buffer: { pre: 0, post: 0 },
      blockMinutes: 60,
      rotations: 3, // floor(180 / 60)
      covers: 6,
    });
    expect(summary.tables[1]).toMatchObject({
      effectivePartySize: 4,
      diningMinutes: 75,
      rotations: 2, // floor(180 / 75)
      covers: 8,
    });
    expect(summary.totalRotations).toBe(5);
    expect(summary.totalCovers).toBe(14);
  });

  it('@contract exact-fit boundary: a block equal to the window yields one rotation, one minute more yields zero', () => {
    const exact = getVenuePolicy();
    exact.services.lunch!.turnBands = [{ maxPartySize: 99, durationMinutes: 180 }];
    const fit = calculateCapacityForTables('lunch', asTables([table()]), { policy: exact })!;
    expect(fit.tables[0]).toMatchObject({ blockMinutes: 180, rotations: 1, covers: 2 });

    const over = getVenuePolicy();
    over.services.lunch!.turnBands = [{ maxPartySize: 99, durationMinutes: 181 }];
    const noFit = calculateCapacityForTables('lunch', asTables([table()]), { policy: over })!;
    // The table is still reported, pinned at zero rotations.
    expect(noFit.tables[0]).toMatchObject({ blockMinutes: 181, rotations: 0, covers: 0 });
    expect(noFit.totalRotations).toBe(0);
    expect(noFit.totalCovers).toBe(0);
  });

  it('@contract zero tables yields an empty summary with zero totals', () => {
    const summary = calculateCapacityForTables('lunch', asTables([]))!;

    expect(summary).toEqual({
      service: 'lunch',
      serviceMinutes: 180,
      tables: [],
      totalRotations: 0,
      totalCovers: 0,
    });
  });

  it('@contract excludes out-of-service and zero/null-capacity tables from the rotation plan', () => {
    const summary = calculateCapacityForTables('lunch', asTables([
      table({ id: 'oos', status: 'out_of_service', capacity: 4 }),
      table({ id: 'zero', capacity: 0 }),
      table({ id: 'null-cap', capacity: null }),
      table({ id: 'ok', table_number: '9', capacity: 2 }),
    ]))!;

    expect(summary.tables.map((t) => t.tableId)).toEqual(['ok']);
    expect(summary.totalRotations).toBe(3);
    expect(summary.totalCovers).toBe(6);
  });

  it('@contract derives the effective party size from min/max bounds but keeps covers on raw capacity', () => {
    const summary = calculateCapacityForTables('lunch', asTables([
      // min above capacity: the larger min drives the turn band.
      table({ id: 'min-heavy', capacity: 2, min_party_size: 6 }),
      // max below capacity: the capped max drives the band, covers still use capacity.
      table({ id: 'max-capped', table_number: '2', capacity: 8, max_party_size: 2 }),
    ]))!;

    expect(summary.tables[0]).toMatchObject({
      effectivePartySize: 6,
      diningMinutes: 85, // band for parties <= 6
      rotations: 2, // floor(180 / 85)
      covers: 4, // rotations * capacity(2)
      minPartySize: 6,
      maxPartySize: null,
    });
    expect(summary.tables[1]).toMatchObject({
      effectivePartySize: 2,
      diningMinutes: 60,
      rotations: 3,
      covers: 24, // rotations * capacity(8), not party size
      maxPartySize: 2,
    });
  });

  it('@contract pre/post buffers extend the block and reduce rotations', () => {
    const policy = getVenuePolicy();
    policy.services.lunch!.buffer = { pre: 10, post: 15 };

    const summary = calculateCapacityForTables('lunch', asTables([table()]), { policy })!;

    expect(summary.tables[0]).toMatchObject({
      diningMinutes: 60,
      buffer: { pre: 10, post: 15 },
      blockMinutes: 85,
      rotations: 2, // floor(180 / 85)
      covers: 4,
    });
  });

  it('@contract overnight service windows (end before start) span midnight', () => {
    const policy = getVenuePolicy();
    policy.services.dinner!.start = { hour: 22, minute: 0 };
    policy.services.dinner!.end = { hour: 2, minute: 0 };

    const summary = calculateCapacityForTables('dinner', asTables([table()]), {
      policy,
      referenceDate: '2026-06-10',
    })!;

    expect(summary.serviceMinutes).toBe(240);
    expect(summary.tables[0]).toMatchObject({ rotations: 4, covers: 8 });
  });

  it('@contract DST spring-forward shrinks the real service window (Europe/London 2026-03-29)', () => {
    const policy = getVenuePolicy(); // Europe/London
    policy.services.lunch!.start = { hour: 0, minute: 30 };
    policy.services.lunch!.end = { hour: 2, minute: 30 };

    const dstDay = calculateCapacityForTables('lunch', asTables([table()]), {
      policy,
      referenceDate: '2026-03-29',
    })!;
    const normalDay = calculateCapacityForTables('lunch', asTables([table()]), {
      policy: (() => {
        const p = getVenuePolicy();
        p.services.lunch!.start = { hour: 0, minute: 30 };
        p.services.lunch!.end = { hour: 2, minute: 30 };
        return p;
      })(),
      referenceDate: '2026-03-28',
    })!;

    // The 01:00-02:00 hour does not exist on the spring-forward night.
    expect(dstDay.serviceMinutes).toBe(60);
    expect(dstDay.tables[0]!.rotations).toBe(1);
    expect(normalDay.serviceMinutes).toBe(120);
    expect(normalDay.tables[0]!.rotations).toBe(2);
  });

  it('@contract returns null for a service the policy does not define', () => {
    const base = getVenuePolicy();
    const dinnerOnly: VenuePolicy = {
      ...base,
      services: { dinner: base.services.dinner },
    };

    expect(calculateCapacityForTables('lunch', asTables([table()]), { policy: dinnerOnly })).toBeNull();
  });

  it('@contract falls back to today for an invalid reference date instead of throwing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    try {
      const summary = calculateCapacityForTables('lunch', asTables([table()]), {
        referenceDate: 'not-a-date',
      })!;
      expect(summary.serviceMinutes).toBe(180);
      expect(summary.tables[0]!.rotations).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('calculateRestaurantCapacityByService (repository seam)', () => {
  type QueryCall = { method: string; args: unknown[] };

  function createClient(result: { data?: unknown; error?: unknown }) {
    const calls: QueryCall[] = [];
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq']) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => ({ data: null, error: null, ...result }))
        .then(onFulfilled, onRejected);
    const from = vi.fn(() => builder);
    return { client: { from } as never, from, calls };
  }

  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract @security fetches inventory scoped to the restaurant and summarises every configured service', async () => {
    const { client, from, calls } = createClient({
      data: [table({ id: 't1', capacity: 2 })],
    });

    const summaries = await calculateRestaurantCapacityByService({
      restaurantId: 'rest-1',
      client: client as never,
    });

    expect(from).toHaveBeenCalledWith('table_inventory');
    expect(calls).toContainEqual({
      method: 'select',
      args: ['id, table_number, capacity, min_party_size, max_party_size, status'],
    });
    expect(calls).toContainEqual({ method: 'eq', args: ['restaurant_id', 'rest-1'] });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();

    expect(summaries.map((s) => s.service)).toEqual(['lunch', 'dinner']);
    expect(summaries[0]!.totalRotations).toBe(3); // lunch 180/60
    expect(summaries[1]!.totalRotations).toBe(6); // dinner 360/60
  });

  it('@contract limits the summaries to the requested services', async () => {
    const { client } = createClient({ data: [table()] });

    const summaries = await calculateRestaurantCapacityByService({
      restaurantId: 'rest-1',
      services: ['dinner'],
      client: client as never,
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.service).toBe('dinner');
  });

  it('@contract propagates inventory query errors', async () => {
    const failure = { message: 'permission denied', code: '42501' };
    const { client } = createClient({ data: null, error: failure });

    await expect(
      calculateRestaurantCapacityByService({ restaurantId: 'rest-1', client: client as never }),
    ).rejects.toEqual(failure);
  });

  it('@contract uses the service-role client when none is injected', async () => {
    const { client } = createClient({ data: [] });
    getServiceSupabaseClientMock.mockReturnValue(client);

    const summaries = await calculateRestaurantCapacityByService({ restaurantId: 'rest-1' });

    expect(getServiceSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(2);
    expect(summaries.every((s) => s.tables.length === 0)).toBe(true);
  });
});
