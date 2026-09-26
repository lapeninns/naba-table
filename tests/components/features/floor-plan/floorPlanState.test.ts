import { describe, expect, it } from 'vitest';

import { layoutFloorPlan } from '@/components/features/floor-plan/model/floorPlanLayout';
import {
  bestFitForBooking,
  bookingActions,
  bookingsNeedingTable,
  checkTableForBooking,
  computeTableStates,
  defaultService,
  defaultTimeFor,
  isReadOnly,
  serviceCounts,
  serviceWindow,
  tableStateAt,
} from '@/components/features/floor-plan/model/floorPlanState';

import { DATE, NOW, at, booking, ctx, snapshot, table } from './floorPlanFixtures';

function tableById(snap: ReturnType<typeof snapshot>, id: string) {
  const found = snap.tables.find((t) => t.id === id);
  if (!found) throw new Error(`missing table ${id}`);
  return found;
}

describe('tableStateAt', () => {
  it('shows a checked-in booking past its end as over time with the next arrival', () => {
    const snap = snapshot({
      bookings: [
        booking('hughes', 2, '17:45', 90, 'checked_in', ['T1'], { checkedInAtMs: at('17:48') }),
        booking('morgan', 2, '20:00', 90, 'confirmed', ['T1']),
      ],
    });
    const state = tableStateAt(snap, tableById(snap, 'T1'), ctx());
    expect(state).toMatchObject({ kind: 'over', text: 'Over 16m', sub: 'Next 20:00' });
    expect(state.booking?.id).toBe('hughes');
  });

  it('shows seated time for a party within its booking', () => {
    const snap = snapshot({
      bookings: [
        booking('okafor', 8, '19:00', 120, 'checked_in', ['T3', 'T4'], {
          checkedInAtMs: at('19:04'),
        }),
      ],
    });
    const state = tableStateAt(snap, tableById(snap, 'T4'), ctx());
    expect(state).toMatchObject({ kind: 'seated', text: 'Seated 27m', sub: 'Ends 21:00' });
  });

  it('marks a booking that should have arrived as late, and one within 30 minutes as due', () => {
    const snap = snapshot({
      bookings: [
        booking('bennett', 2, '19:15', 90, 'confirmed', ['T1']),
        booking('singh', 2, '19:50', 90, 'confirmed', ['T2']),
      ],
    });
    expect(tableStateAt(snap, tableById(snap, 'T1'), ctx())).toMatchObject({
      kind: 'late',
      short: 'Late 16m',
    });
    expect(tableStateAt(snap, tableById(snap, 'T2'), ctx())).toMatchObject({
      kind: 'due',
      text: 'Due 19:50 · 2',
    });
  });

  it('reports free-until and ignores cancelled and no-show bookings', () => {
    const snap = snapshot({
      bookings: [
        booking('taylor', 2, '19:00', 90, 'no_show', ['T1']),
        booking('wood', 2, '21:00', 90, 'confirmed', ['T1']),
      ],
    });
    expect(tableStateAt(snap, tableById(snap, 'T1'), ctx())).toMatchObject({
      kind: 'free',
      text: 'Free until 21:00',
    });
  });

  it('prioritises pending changes, then out of service, then holds', () => {
    const snap = snapshot({
      holds: [
        {
          id: 'h1',
          tableId: 'T2',
          bookingId: null,
          startMs: NOW - 60_000,
          endMs: NOW + 5 * 60_000,
        },
      ],
    });
    const pending = [
      { bookingId: 'x', kind: 'assign' as const, tableIds: ['T1'], previousTableIds: [] },
    ];
    const states = computeTableStates(snap, ctx(), pending);
    expect(states.get('T1')?.kind).toBe('saving');
    expect(states.get('T2')).toMatchObject({ kind: 'held', sub: 'Until 19:36' });
    expect(states.get('T8')?.kind).toBe('out_of_service');
  });

  it('shows a just-checked-in party as seated even when the server clock runs ahead', () => {
    const snap = snapshot({
      bookings: [
        booking('bennett', 2, '19:15', 90, 'checked_in', ['T1'], { checkedInAtMs: NOW + 40_000 }),
      ],
    });
    expect(tableStateAt(snap, tableById(snap, 'T1'), ctx())).toMatchObject({
      kind: 'seated',
      text: 'Seated 0m',
    });
  });

  it('frees a table as soon as its booking is completed, even with clock skew', () => {
    const snap = snapshot({
      bookings: [
        booking('hughes', 2, '17:45', 90, 'completed', ['T1'], {
          checkedInAtMs: at('17:48'),
          checkedOutAtMs: NOW + 40_000,
        }),
      ],
    });
    expect(tableStateAt(snap, tableById(snap, 'T1'), ctx()).kind).toBe('free');
    expect(tableStateAt(snap, tableById(snap, 'T1'), ctx({ atMs: at('18:30') })).kind).toBe(
      'seated',
    );
  });

  it('treats earlier times today as read-only history', () => {
    const snap = snapshot({
      bookings: [
        booking('ellis', 2, '17:30', 90, 'completed', ['T2'], {
          checkedInAtMs: at('17:33'),
          checkedOutAtMs: at('18:55'),
        }),
      ],
    });
    const earlier = ctx({ atMs: at('18:15') });
    expect(isReadOnly(snap, earlier)).toBe(true);
    expect(tableStateAt(snap, tableById(snap, 'T2'), earlier)).toMatchObject({
      kind: 'seated',
      text: 'Seated 42m',
    });
    expect(tableStateAt(snap, tableById(snap, 'T2'), ctx()).kind).toBe('free');
  });
});

describe('checkTableForBooking', () => {
  const snap = snapshot({
    bookings: [
      booking('seated', 2, '19:00', 120, 'checked_in', ['T1'], { checkedInAtMs: at('19:02') }),
      booking('barnes', 4, '19:45', 90, 'pending_allocation'),
      booking('ahmed', 7, '20:15', 120, 'pending_allocation'),
      booking('big', 12, '20:15', 120, 'pending_allocation'),
    ],
  });
  const layout = layoutFloorPlan(snap.zones, snap.tables);
  const find = (id: string) => snap.bookings.find((b) => b.id === id)!;

  it('fits a party that the table seats', () => {
    expect(
      checkTableForBooking(snap, tableById(snap, 'T3'), find('barnes'), ctx(), layout),
    ).toMatchObject({
      ok: true,
      tableIds: ['T3'],
      label: 'Fits 4',
    });
  });

  it('explains why a table cannot take a booking', () => {
    const results = ['T1', 'T8', 'T5', 'S1'].map((id) =>
      checkTableForBooking(snap, tableById(snap, id), find('ahmed'), ctx(), layout),
    );
    expect(results.map((r) => (r.ok ? 'ok' : r.reason))).toEqual([
      'T1 is booked 19:02–21:00. Pick another table.',
      'T8 is out of service.',
      'T5 seats 4 and is fixed, so it can’t be joined.',
      'S1 seats 4 and is fixed, so it can’t be joined.',
    ]);
  });

  it('joins free movable tables in the same zone, never across zones', () => {
    const result = checkTableForBooking(snap, tableById(snap, 'T3'), find('ahmed'), ctx(), layout);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.join).toBe(true);
    expect(result.tableIds[0]).toBe('T3');
    expect(result.seats).toBeGreaterThanOrEqual(7);
    expect(result.tableIds.every((id) => tableById(snap, id).zoneId === 'main')).toBe(true);
    expect(result.tableIds).not.toContain('T1');
  });

  it('refuses when the zone cannot seat the party', () => {
    const result = checkTableForBooking(snap, tableById(snap, 'T3'), find('big'), ctx(), layout);
    expect(result).toMatchObject({ ok: false });
  });

  it('respects allocator block windows (buffers), not just the dining time', () => {
    const buffered = snapshot({
      bookings: [
        booking('early', 2, '18:00', 90, 'confirmed', ['T2'], { blockEndMs: at('19:45') }),
        booking('next', 2, '19:40', 90, 'pending_allocation'),
      ],
    });
    const result = checkTableForBooking(
      buffered,
      tableById(buffered, 'T2'),
      buffered.bookings[1]!,
      ctx(),
      layoutFloorPlan(buffered.zones, buffered.tables),
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('only checks the rest of the stay when moving a seated party', () => {
    const moving = snapshot({
      bookings: [
        booking('seated', 2, '18:00', 90, 'checked_in', ['T1'], { checkedInAtMs: at('18:02') }),
        booking('earlier', 2, '17:30', 90, 'completed', ['T2'], {
          checkedInAtMs: at('17:33'),
          checkedOutAtMs: at('18:55'),
        }),
        booking('later', 2, '19:40', 90, 'confirmed', ['T9']),
      ],
      tables: [...snapshot().tables, table('T9', 'main', 2)],
    });
    const layoutFor = layoutFloorPlan(moving.zones, moving.tables);
    const seated = moving.bookings[0]!;
    expect(
      checkTableForBooking(moving, tableById(moving, 'T2'), seated, ctx(), layoutFor),
    ).toMatchObject({ ok: true });
    // A seated party still holds the table at least 15 minutes past now.
    expect(
      checkTableForBooking(moving, tableById(moving, 'T9'), seated, ctx(), layoutFor),
    ).toMatchObject({ ok: false });
  });

  it('picks the tightest fit as best fit', () => {
    const tight = snapshot({ bookings: [booking('pair', 2, '20:00', 90, 'pending_allocation')] });
    const best = bestFitForBooking(
      tight,
      tight.bookings[0]!,
      ctx(),
      layoutFloorPlan(tight.zones, tight.tables),
    );
    expect(best?.tableIds).toEqual(['T1']);
  });
});

describe('service helpers', () => {
  it('lists bookings needing a table within the chosen service, earliest first', () => {
    const snap = snapshot({
      bookings: [
        booking('late', 2, '20:30', 90, 'pending'),
        booking('early', 2, '19:45', 90, 'pending_allocation'),
        booking('lunch', 2, '12:30', 90, 'pending_allocation'),
        booking('cancelled', 2, '19:45', 90, 'cancelled'),
        booking('assigned', 2, '19:45', 90, 'confirmed', ['T2']),
      ],
    });
    expect(bookingsNeedingTable(snap, serviceWindow(snap, 'dinner')).map((b) => b.id)).toEqual([
      'early',
      'late',
    ]);
    expect(bookingsNeedingTable(snap, serviceWindow(snap, 'all'))).toHaveLength(3);
  });

  it('counts covers once per joined booking', () => {
    const snap = snapshot({
      bookings: [
        booking('okafor', 8, '19:00', 120, 'checked_in', ['T3', 'T4'], {
          checkedInAtMs: at('19:04'),
        }),
        booking('clarke', 4, '19:45', 90, 'confirmed', ['T5']),
      ],
    });
    const states = computeTableStates(snap, ctx());
    const counts = serviceCounts(snap, states, serviceWindow(snap, 'dinner'));
    expect(counts).toMatchObject({ seatedCovers: 8, expectedCovers: 12, awaiting: 0 });
  });

  it('gates actions by status and time', () => {
    const snap = snapshot();
    const due = booking('due', 2, '19:15', 90, 'confirmed', ['T1']);
    const seated = booking('seated', 2, '18:00', 90, 'checked_in', ['T2']);
    expect(bookingActions(snap, due, ctx())).toEqual({
      canCheckIn: true,
      canComplete: false,
      canNoShow: true,
      canMove: true,
      canUnassign: true,
    });
    expect(bookingActions(snap, seated, ctx())).toMatchObject({
      canComplete: true,
      canUnassign: false,
    });
    expect(bookingActions(snap, due, ctx({ atMs: at('18:00') }))).toMatchObject({
      canCheckIn: false,
      canMove: false,
    });
    const tomorrow = snapshot({ date: '2026-09-26' });
    expect(bookingActions(tomorrow, due, ctx())).toMatchObject({
      canCheckIn: false,
      canMove: true,
    });
  });

  it('defaults to the service running now and snaps the time to it', () => {
    const snap = snapshot();
    expect(defaultService(snap, ctx())).toBe('dinner');
    expect(defaultService(snap, ctx({ nowMs: at('13:00'), atMs: at('13:00') }))).toBe('lunch');
    expect(defaultTimeFor(snap, 'dinner', { nowMs: NOW, today: DATE })).toBe(NOW);
    expect(defaultTimeFor(snap, 'lunch', { nowMs: NOW, today: DATE })).toBe(at('13:30'));
  });

  it('keeps the tables helper exported for fixtures', () => {
    expect(table('X', 'main', 2).shape).toBe('rect');
  });
});
