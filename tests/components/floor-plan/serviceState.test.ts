import { describe, expect, it } from 'vitest';

import {
  deriveServiceState,
  resolveTableState,
} from '@/components/features/floor-plan/domain/serviceState';
import type { FloorPlanTable } from '@/components/features/floor-plan/domain/types';
import type {
  OpsBookingStatus,
  TableTimelineBookingRef,
  TableTimelineSegment,
  TableTimelineSegmentState,
} from '@/types/ops';

const BASE = Date.parse('2026-06-21T18:00:00.000Z');
const mins = (n: number) => n * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

// Booking: starts 19:00 (BASE+60), ends 20:30 (BASE+150) → 90-min block.
function booking(
  status: OpsBookingStatus,
  overrides: Partial<TableTimelineBookingRef> = {},
): TableTimelineBookingRef {
  return {
    id: 'b1',
    customerName: 'Ortiz',
    partySize: 2,
    status,
    startAt: iso(BASE + mins(60)),
    endAt: iso(BASE + mins(150)),
    ...overrides,
  };
}

function seg(
  state: TableTimelineSegmentState,
  ref: TableTimelineBookingRef | null = null,
): TableTimelineSegment {
  return {
    start: iso(BASE - mins(120)),
    end: iso(BASE + mins(300)),
    state,
    serviceKey: 'dinner',
    booking: ref,
    hold: null,
  };
}

function makeTable(overrides: Partial<FloorPlanTable> = {}): FloorPlanTable {
  return {
    id: 't1',
    restaurantId: 'r1',
    tableNumber: '1',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Main Dining',
    zoneActive: true,
    active: true,
    status: 'available' as FloorPlanTable['status'],
    position: null,
    notes: null,
    segments: [],
    ...overrides,
  };
}

describe('deriveServiceState — one case per state', () => {
  it('free when there is no covering segment', () => {
    expect(deriveServiceState({ segment: null, tMs: BASE })).toBe('free');
  });

  it('free for an available segment', () => {
    expect(deriveServiceState({ segment: seg('available'), tMs: BASE })).toBe('free');
  });

  it('free for an out_of_service segment (rendered disabled separately)', () => {
    expect(deriveServiceState({ segment: seg('out_of_service'), tMs: BASE })).toBe('free');
  });

  it('held for a hold segment with no booking', () => {
    expect(deriveServiceState({ segment: seg('hold'), tMs: BASE })).toBe('held');
  });

  it('confirmed for a reserved segment, booked ahead, before start', () => {
    const s = seg('reserved', booking('confirmed'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(30) })).toBe('confirmed');
  });

  it('confirmed for pending / pending_allocation too', () => {
    expect(
      deriveServiceState({ segment: seg('reserved', booking('pending')), tMs: BASE + mins(30) }),
    ).toBe('confirmed');
    expect(
      deriveServiceState({
        segment: seg('reserved', booking('pending_allocation')),
        tMs: BASE + mins(30),
      }),
    ).toBe('confirmed');
  });

  it('confirmed for a reserved segment that lacks a booking ref', () => {
    expect(deriveServiceState({ segment: seg('reserved', null), tMs: BASE })).toBe('confirmed');
  });

  it('seated for a checked-in booking mid-service', () => {
    const s = seg('reserved', booking('checked_in'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(90) })).toBe('seated');
  });

  it('walkin for a checked-in walk-in mid-service (isWalkIn flag)', () => {
    const s = seg('reserved', booking('checked_in'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(90), isWalkIn: true })).toBe('walkin');
  });

  it('finishing within the threshold window before end', () => {
    const s = seg('reserved', booking('checked_in'));
    // end = BASE+150, threshold 15 → window starts BASE+135
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(140) })).toBe('finishing');
  });

  it('overdue for a checked-in booking past its end', () => {
    const s = seg('reserved', booking('checked_in'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(151) })).toBe('overdue');
  });

  it('overdue for a confirmed booking that never checked in (no-show risk)', () => {
    const s = seg('reserved', booking('confirmed'));
    // start = BASE+60, grace 20 → overdue after BASE+80
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(81) })).toBe('overdue');
  });
});

describe('deriveServiceState — boundaries', () => {
  it('flips seated → finishing exactly at end − threshold', () => {
    const s = seg('reserved', booking('checked_in'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(134) })).toBe('seated');
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(135) })).toBe('finishing');
  });

  it('stays confirmed up to start + grace, then overdue', () => {
    const s = seg('reserved', booking('confirmed'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(80) })).toBe('confirmed');
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(81) })).toBe('overdue');
  });

  it('respects custom thresholds', () => {
    const s = seg('reserved', booking('checked_in'));
    expect(
      deriveServiceState({ segment: s, tMs: BASE + mins(120), finishingThresholdMin: 45 }),
    ).toBe('finishing');
  });
});

describe('resolveTableState — integration', () => {
  it('selects the segment covering T and resolves seated', () => {
    const table = makeTable({
      segments: [
        { ...seg('available'), start: iso(BASE), end: iso(BASE + mins(60)) },
        {
          ...seg('reserved', booking('checked_in')),
          start: iso(BASE + mins(60)),
          end: iso(BASE + mins(150)),
        },
      ],
    });
    const resolved = resolveTableState(table, BASE + mins(90));
    expect(resolved.state).toBe('seated');
    expect(resolved.booking?.id).toBe('b1');
    expect(resolved.outOfService).toBe(false);
  });

  it('resolves a checked-in walk-in as walkin from bookingType', () => {
    const table = makeTable({
      segments: [
        {
          ...seg('reserved', booking('checked_in', { bookingType: 'Walk-in Guest' })),
          start: iso(BASE),
          end: iso(BASE + mins(120)),
        },
      ],
    });
    expect(resolveTableState(table, BASE + mins(30)).state).toBe('walkin');
  });

  it('marks an inactive table out of service', () => {
    const table = makeTable({ active: false, segments: [seg('available')] });
    const resolved = resolveTableState(table, BASE);
    expect(resolved.outOfService).toBe(true);
  });

  it('marks an inactive zone out of service', () => {
    const table = makeTable({ zoneActive: false, segments: [seg('available')] });
    expect(resolveTableState(table, BASE).outOfService).toBe(true);
  });
});

describe('deriveServiceState — dining-window thresholds (buffer-aware)', () => {
  it('measures the overdue grace from the dining start, not the buffered block start', () => {
    // Real pre-buffer: block starts 15 min before the customer's reservation.
    const s = seg(
      'reserved',
      booking('confirmed', {
        startAt: iso(BASE + mins(45)),
        diningStartAt: iso(BASE + mins(60)),
      }),
    );
    // T = dining start + 15 (= block start + 30). Block-relative would already be overdue
    // (>20 past block start); dining-relative is still within the 20-min grace → confirmed.
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(75) })).toBe('confirmed');
    // 21 min past the dining start → overdue.
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(81) })).toBe('overdue');
  });

  it('measures finishing/overdue from the dining end, not the buffered block end', () => {
    // Real post-buffer: block ends 15 min after the dining window.
    const s = seg(
      'reserved',
      booking('checked_in', {
        endAt: iso(BASE + mins(165)),
        diningEndAt: iso(BASE + mins(150)),
      }),
    );
    // 1 min past the dining end. Block-relative (end 165) would still read seated.
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(151) })).toBe('overdue');
  });

  it('falls back to the block window when dining boundaries are absent', () => {
    // No diningStartAt → uses startAt (BASE+60); grace 20 → overdue after BASE+80.
    const s = seg('reserved', booking('confirmed'));
    expect(deriveServiceState({ segment: s, tMs: BASE + mins(81) })).toBe('overdue');
  });
});
