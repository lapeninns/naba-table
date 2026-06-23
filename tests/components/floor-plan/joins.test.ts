import { describe, expect, it } from 'vitest';

import {
  computeJoinBoxes,
  computeJoinGroups,
  computeJoinLinks,
} from '@/components/features/floor-plan/domain/joins';
import type {
  FloorPlanTable,
  NormalizedPosition,
} from '@/components/features/floor-plan/domain/types';
import type { OpsBookingStatus, TableTimelineBookingRef, TableTimelineSegment } from '@/types/ops';

const BASE = Date.parse('2026-06-21T18:00:00.000Z');
const mins = (n: number) => n * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function bookingSeg(bookingId: string, tableIds: string[]): TableTimelineSegment {
  const ref: TableTimelineBookingRef = {
    id: bookingId,
    customerName: 'Lindqvist',
    partySize: 6,
    status: 'checked_in',
    startAt: iso(BASE),
    endAt: iso(BASE + mins(120)),
    tableIds,
  };
  return {
    start: iso(BASE - mins(60)),
    end: iso(BASE + mins(180)),
    state: 'reserved',
    serviceKey: 'dinner',
    booking: ref,
    hold: null,
  };
}

function makeTable(id: string, segment: TableTimelineSegment | null): FloorPlanTable {
  return {
    id,
    restaurantId: 'r1',
    tableNumber: id,
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'fixed',
    zoneId: 'z1',
    zoneName: 'Main Dining',
    zoneActive: true,
    active: true,
    status: 'available' as FloorPlanTable['status'],
    position: null,
    notes: null,
    segments: segment ? [segment] : [],
  };
}

describe('computeJoinGroups', () => {
  it('groups tables that share a multi-table booking', () => {
    const tables = [
      makeTable('B2', bookingSeg('book-1', ['B2', 'M5'])),
      makeTable('M5', bookingSeg('book-1', ['B2', 'M5'])),
      makeTable('M1', null),
    ];
    const groups = computeJoinGroups(tables, BASE + mins(30));
    expect(groups).toHaveLength(1);
    expect(groups[0].bookingId).toBe('book-1');
    expect(groups[0].tableIds.sort()).toEqual(['B2', 'M5']);
    expect(groups[0].capacity).toBe(8);
  });

  it('does not group a single-table booking', () => {
    const tables = [makeTable('M1', bookingSeg('book-2', ['M1']))];
    expect(computeJoinGroups(tables, BASE + mins(30))).toHaveLength(0);
  });

  it('does not group tables whose shared booking is completed (resolves to free)', () => {
    // A finished multi-table party still carries a stale booking ref on its 'reserved'
    // segment, but resolves to 'free' — it must not paint a "Joined" overlay.
    const done = (ids: string[]): TableTimelineSegment => {
      const s = bookingSeg('book-done', ids);
      return {
        ...s,
        booking: {
          ...(s.booking as TableTimelineBookingRef),
          status: 'completed' as OpsBookingStatus,
        },
      };
    };
    const tables = [makeTable('B2', done(['B2', 'M5'])), makeTable('M5', done(['B2', 'M5']))];
    expect(computeJoinGroups(tables, BASE + mins(30))).toHaveLength(0);
  });
});

describe('computeJoinLinks / computeJoinBoxes', () => {
  const positions = new Map<string, NormalizedPosition>([
    ['B2', { xPercent: 10, yPercent: 10, rotation: 0 }],
    ['M5', { xPercent: 30, yPercent: 30, rotation: 0 }],
    ['M3', { xPercent: 50, yPercent: 10, rotation: 0 }],
  ]);

  it('creates one link per adjacent pair in a group', () => {
    const links = computeJoinLinks(
      [{ bookingId: 'b', tableIds: ['B2', 'M5', 'M3'], capacity: 12 }],
      positions,
    );
    expect(links).toHaveLength(2);
  });

  it('creates a padded bracket box spanning the group', () => {
    const boxes = computeJoinBoxes(
      [{ bookingId: 'b', tableIds: ['B2', 'M5'], capacity: 8 }],
      positions,
      3,
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0].left).toBe(7); // min x (10) − pad (3)
    expect(boxes[0].width).toBe(26); // (30 + 3) − (10 − 3)
  });
});
