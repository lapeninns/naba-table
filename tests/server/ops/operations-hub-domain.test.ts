import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getTableAvailabilityTimelineMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/ops/table-timeline', () => ({
  getTableAvailabilityTimeline: getTableAvailabilityTimelineMock,
}));

import { buildOperationsHub, mapTimelineStateToHub } from '@/server/ops/operations-hub';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
// London runs on BST (UTC+1) in July: 18:30Z == 19:30 local.
const NOW = '2026-07-11T18:30:00Z';
const CLIENT = { tag: 'tenant-client' } as never;

type Segment = {
  start: string;
  end: string;
  state: 'available' | 'reserved' | 'hold' | 'out_of_service';
  serviceKey: string;
  booking?: Record<string, unknown> | null;
  hold?: Record<string, unknown> | null;
};

function seg(overrides: Partial<Segment> = {}): Segment {
  return {
    start: '2026-07-11T18:00:00Z',
    end: '2026-07-11T20:00:00Z',
    state: 'reserved',
    serviceKey: 'dinner',
    booking: bookingRef(),
    ...overrides,
  };
}

function bookingRef(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    customerName: 'Ada Lovelace',
    partySize: 2,
    status: 'confirmed',
    startAt: '2026-07-11T18:00:00Z',
    endAt: '2026-07-11T20:00:00Z',
    ...overrides,
  };
}

function tableRow(overrides: Record<string, unknown> = {}, segments: Segment[] = []) {
  return {
    table: {
      id: 't1',
      tableNumber: '12',
      capacity: 4,
      zoneId: 'z1',
      zoneName: 'Main',
      status: 'available',
      active: true,
      ...(overrides as object),
    },
    stats: { occupancyMinutes: 0, totalMinutes: 360, occupancyPercentage: 0, nextStateAt: null },
    segments,
  };
}

function makeTimeline(overrides: Record<string, unknown> = {}) {
  return {
    date: '2026-07-11',
    timezone: 'Europe/London',
    window: { start: '2026-07-11T16:00:00Z', end: '2026-07-11T22:00:00Z', isClosed: false },
    slots: [],
    services: [],
    summary: {
      totalTables: 1,
      totalCapacity: 10,
      availableTables: 1,
      zones: [],
      serviceCapacities: [],
    },
    tables: [] as unknown[],
    ...overrides,
  };
}

async function build(params: Record<string, unknown> = {}) {
  return buildOperationsHub({
    restaurantId: RESTAURANT_ID,
    client: CLIENT,
    ...params,
  } as never);
}

describe('buildOperationsHub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    getTableAvailabilityTimelineMock.mockResolvedValue(makeTimeline());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract @security forwards the tenant, date, zone and service filters to the timeline query', async () => {
    await build({ date: '2026-07-11', zoneId: 'z1', service: 'lunch' });

    expect(getTableAvailabilityTimelineMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      date: '2026-07-11',
      zoneId: 'z1',
      service: 'lunch',
      client: CLIENT,
    });

    await build();
    expect(getTableAvailabilityTimelineMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ restaurantId: RESTAURANT_ID, service: 'all', client: CLIENT }),
    );
  });

  it('@contract maps tables and formats the service window in the venue timezone', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        tables: [
          tableRow(),
          tableRow({ id: 't2', tableNumber: '3', capacity: 6, zoneId: null, zoneName: null }),
        ],
      }),
    );

    const hub = await build();

    expect(hub.date).toBe('2026-07-11');
    expect(hub.timezone).toBe('Europe/London');
    expect(hub.window).toEqual({ start: '17:00', end: '23:00' }); // 16:00Z/22:00Z in BST
    expect(hub.tables).toEqual([
      { id: 't1', name: 'T12', capacity: 4, zone: 'Main', zoneId: 'z1' },
      { id: 't2', name: 'T3', capacity: 6, zone: null, zoneId: null },
    ]);
  });

  it('@contract falls back to the default window and UTC when timeline metadata is unusable', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        timezone: '',
        window: { start: 'garbage', end: '', isClosed: false },
      }),
    );

    const hub = await build();

    expect(hub.timezone).toBe('UTC');
    expect(hub.window).toEqual({ start: '17:00', end: '23:00' });
  });

  it('@contract excludes available segments and builds sanitized reservation ids with guest fallbacks', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        tables: [
          tableRow({}, [
            seg({ state: 'available', booking: null }),
            seg({ booking: bookingRef({ id: 'book/1 weird', customerName: 'Ada Lovelace' }) }),
            seg({
              state: 'hold',
              start: '2026-07-11T19:00:00Z',
              end: '2026-07-11T19:15:00Z',
              booking: null,
              hold: { id: 'h-9', bookingId: null, startAt: '', endAt: '' },
            }),
            seg({ start: 'garbage', end: 'garbage', booking: bookingRef({ id: 'b-bad' }) }),
          ]),
        ],
      }),
    );

    const hub = await build();

    expect(hub.reservations).toHaveLength(3); // available dropped
    expect(hub.reservations[0]).toEqual({
      id: 't1:2026-07-11T18:00:00Z:2026-07-11T20:00:00Z:reserved:book_1_weird:none',
      tableId: 't1',
      name: 'Ada Lovelace',
      guests: 2,
      start: '19:00',
      end: '21:00',
      status: 'seated',
      bookingId: 'book/1 weird', // raw id preserved on the payload
    });
    expect(hub.reservations[1]).toEqual({
      id: 't1:2026-07-11T19:00:00Z:2026-07-11T19:15:00Z:hold:none:h-9',
      tableId: 't1',
      name: 'Guest',
      guests: 0,
      start: '20:00',
      end: '20:15',
      status: 'arriving',
      bookingId: null,
    });
    // Unparsable timestamps degrade to 00:00 rather than throwing.
    expect(hub.reservations[2]).toMatchObject({ start: '00:00', end: '00:00' });
  });

  it('@contract maps booking and segment states to hub statuses relative to now', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        tables: [
          tableRow({}, [
            seg({ booking: bookingRef({ id: 'seated', status: 'checked_in' }) }),
            seg({ booking: bookingRef({ id: 'finishing', status: 'completed' }) }),
            seg({
              start: '2026-07-11T10:00:00Z',
              end: '2026-07-11T11:00:00Z',
              booking: bookingRef({ id: 'overdue', status: 'confirmed' }),
            }),
            seg({
              start: '2026-07-11T18:35:00Z',
              end: '2026-07-11T20:35:00Z',
              booking: bookingRef({ id: 'imminent', status: 'confirmed' }),
            }),
            seg({
              start: '2026-07-11T18:00:00Z',
              end: '2026-07-11T20:00:00Z',
              booking: bookingRef({ id: 'inside-window', status: 'pending' }),
            }),
            seg({
              start: '2026-07-11T21:00:00Z',
              end: '2026-07-11T22:00:00Z',
              booking: bookingRef({ id: 'later', status: 'pending_allocation' }),
            }),
            seg({ state: 'out_of_service', booking: null }),
            seg({
              state: 'hold',
              start: '2026-07-11T13:00:00Z',
              end: '2026-07-11T13:15:00Z',
              booking: null,
              hold: { id: 'h-old' },
            }),
            seg({
              state: 'hold',
              start: '2026-07-11T21:00:00Z',
              end: '2026-07-11T21:15:00Z',
              booking: null,
              hold: { id: 'h-new' },
            }),
          ]),
        ],
      }),
    );

    const hub = await build();
    const statusOf = (bookingId: string) =>
      hub.reservations.find((r) => r.bookingId === bookingId)?.status;

    expect(statusOf('seated')).toBe('seated'); // checked_in
    expect(statusOf('finishing')).toBe('finishing'); // completed
    expect(statusOf('overdue')).toBe('overdue'); // confirmed, ended before now
    expect(statusOf('imminent')).toBe('arriving'); // now within the 10-minute pre-window
    expect(statusOf('inside-window')).toBe('seated'); // pending, now inside the slot
    expect(statusOf('later')).toBe('arriving'); // far future fallback

    const holds = hub.reservations.filter((r) => r.id.includes(':hold:'));
    expect(holds.map((r) => r.status)).toEqual(['overdue', 'arriving']); // expired vs live hold
    const oos = hub.reservations.find((r) => r.id.includes(':out_of_service:'));
    expect(oos?.status).toBe('finishing');
  });

  it('@contract cancelled bookings on the timeline still surface as arriving (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/ops/operations-hub.ts:98-123 has no branch for terminal
    // booking statuses; the fallthrough maps cancelled/no_show segments to
    // 'arriving', telling the floor a cancelled party is on its way. Correct
    // behavior would drop the segment (or surface a distinct terminal status).
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        tables: [
          tableRow({}, [
            seg({ booking: bookingRef({ id: 'ghost', status: 'cancelled' }) }),
            seg({
              start: '2026-07-11T20:30:00Z',
              end: '2026-07-11T21:30:00Z',
              booking: bookingRef({ id: 'phantom', status: 'no_show' }),
            }),
          ]),
        ],
      }),
    );

    const hub = await build();

    expect(hub.reservations.map((r) => r.status)).toEqual(['arriving', 'arriving']);
  });

  it('@contract computes occupancy, bookings count, alerts, turn rate and an ordered feed', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        summary: {
          totalTables: 1,
          totalCapacity: 10,
          availableTables: 0,
          zones: [],
          serviceCapacities: [],
        },
        tables: [
          tableRow({}, [
            seg({ booking: bookingRef({ id: 'b-seated', partySize: 2 }) }), // 120 min, seated
            seg({
              start: '2026-07-11T12:00:00Z',
              end: '2026-07-11T14:00:00Z',
              booking: bookingRef({ id: 'b-done', status: 'completed', partySize: 4 }),
            }), // 120 min, finishing
            seg({
              start: '2026-07-11T16:00:00Z',
              end: '2026-07-11T17:00:00Z',
              booking: bookingRef({ id: 'b-late', partySize: 3 }),
            }), // 60 min, overdue
            seg({
              state: 'hold',
              start: '2026-07-11T19:00:00Z',
              end: '2026-07-11T19:15:00Z',
              booking: null,
              hold: { id: 'h-1' },
            }), // guests 0, arriving
          ]),
        ],
      }),
    );

    const hub = await build();

    expect(hub.kpis).toEqual({
      occupancyPercentage: 90, // (2+4+3+0) / 10
      turnRateMinutes: 100, // mean of 120, 120, 60 (reserved segments only)
      bookingsCount: 3, // reserved segments with a booking id
      alertsCount: 1, // one overdue reservation
    });

    expect(hub.feed).toHaveLength(3);
    expect(hub.feed[0]).toEqual({
      id: expect.stringMatching(/^feed:overdue:/),
      time: '19:30:00', // frozen now in venue local time
      title: 'Overdue',
      detail: 't1 · 3 guests · 18:00',
      priority: 'high',
    });
    expect(hub.feed[1]).toEqual({
      id: expect.stringMatching(/^feed:arriving:/),
      time: '19:30:00',
      title: 'Arriving',
      detail: 't1 · Guest · 20:00',
      priority: 'attention',
    });
    expect(hub.feed[2]).toEqual({
      id: 'feed:sync',
      time: '19:30:00',
      title: 'Live sync',
      detail: 'Timeline updated',
      priority: 'log',
    });
  });

  it('@contract a booking spanning multiple tables inflates the bookings count per segment (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/ops/operations-hub.ts:136-141 counts reserved SEGMENTS
    // with a booking id and :133 sums party size per segment, so one merged booking
    // across two tables counts as two bookings and double-counts its guests in
    // occupancy. Correct behavior would dedupe on booking id.
    const shared = bookingRef({ id: 'b-shared', partySize: 4 });
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        tables: [
          tableRow({}, [seg({ booking: shared })]),
          tableRow({ id: 't2', tableNumber: '2' }, [seg({ booking: shared })]),
        ],
      }),
    );

    const hub = await build();

    expect(hub.kpis.bookingsCount).toBe(2); // one real booking
    expect(hub.kpis.occupancyPercentage).toBe(80); // 4+4 of 10
  });

  it('@contract occupancy clamps at 100, zero capacity reports idle, and missing summary falls back to table capacities', async () => {
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        summary: { totalTables: 1, totalCapacity: 4, availableTables: 0, zones: [], serviceCapacities: [] },
        tables: [tableRow({}, [seg({ booking: bookingRef({ partySize: 12 }) })])],
      }),
    );
    expect((await build()).kpis.occupancyPercentage).toBe(100);

    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({ summary: null, tables: [] }),
    );
    const idle = await build();
    expect(idle.kpis).toEqual({
      occupancyPercentage: 0,
      turnRateMinutes: null,
      bookingsCount: 0,
      alertsCount: 0,
    });
    expect(idle.reservations).toEqual([]);
    expect(idle.tables).toEqual([]);
    expect(idle.feed).toEqual([
      expect.objectContaining({ id: 'feed:sync', priority: 'log' }),
    ]);

    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({
        summary: null,
        tables: [
          tableRow({}, [seg({ booking: bookingRef({ partySize: 2 }) })]),
          tableRow({ id: 't2', tableNumber: '2', capacity: 6 }, []),
        ],
      }),
    );
    // Without a summary the denominator is the summed table capacities (4 + 6).
    expect((await build()).kpis.occupancyPercentage).toBe(20);
  });

  it('@contract the feed caps at 20 items, dropping the live-sync heartbeat under alert floods (KNOWN-ISSUE)', async () => {
    // KNOWN-ISSUE: server/ops/operations-hub.ts:201-209 pushes the 'feed:sync'
    // heartbeat AFTER the alert items and then slices to 20, so any flood of 20+
    // alerts silently drops the heartbeat (and further alerts). Correct behavior
    // would reserve a slot for the heartbeat or cap alerts before appending it.
    const segments = Array.from({ length: 25 }, (_, i) =>
      seg({
        start: '2026-07-11T21:00:00Z',
        end: `2026-07-11T22:${String(10 + i).padStart(2, '0')}:00Z`,
        booking: bookingRef({ id: `b-${i}`, partySize: 2 }),
      }),
    );
    getTableAvailabilityTimelineMock.mockResolvedValue(
      makeTimeline({ tables: [tableRow({}, segments)] }),
    );

    const hub = await build();

    expect(hub.feed).toHaveLength(20);
    expect(hub.feed.every((item) => item.id.startsWith('feed:arriving:'))).toBe(true);
    expect(hub.feed.some((item) => item.id === 'feed:sync')).toBe(false);
  });
});

describe('mapTimelineStateToHub', () => {
  it('@contract maps raw timeline states onto hub statuses', () => {
    expect(mapTimelineStateToHub('hold')).toBe('arriving');
    expect(mapTimelineStateToHub('reserved')).toBe('seated');
    expect(mapTimelineStateToHub('out_of_service')).toBe('finishing');
    expect(mapTimelineStateToHub('available')).toBe('arriving');
  });
});
