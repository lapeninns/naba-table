import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  createAvailabilityBitset,
  isWindowFree,
  markWindow,
} from '@/server/capacity/planner/bitset';

const SLOT_MINUTES = 5;
const SLOT_DURATION_MS = SLOT_MINUTES * 60 * 1000;

// A timestamp sitting exactly on a 5-minute slot boundary.
function slotBoundary(slot: number): number {
  return slot * SLOT_DURATION_MS;
}

describe('bitset slot-boundary conflict marking', () => {
  it('marks at least one slot for a sub-slot positive-duration window and reads it busy', () => {
    // Window fully contained inside a single 5-minute slot (60s of duration).
    const start = slotBoundary(1_000) + 30_000;
    const end = slotBoundary(1_000) + 90_000;

    const bitset = createAvailabilityBitset();
    markWindow(bitset, start, end);

    // Regression: the marking loop must not be a no-op for a positive window.
    expect(bitset.occupied.size).toBeGreaterThanOrEqual(1);
    // The very same window must read as busy (no double-booking at the boundary).
    expect(isWindowFree(bitset, start, end)).toBe(false);
  });

  it('marks at least one slot for a boundary-aligned positive-duration window and reads it busy', () => {
    // Window starts exactly on a slot boundary, with sub-slot duration.
    const start = slotBoundary(2_000);
    const end = slotBoundary(2_000) + 1; // +1ms

    const bitset = createAvailabilityBitset();
    markWindow(bitset, start, end);

    expect(bitset.occupied.size).toBeGreaterThanOrEqual(1);
    expect(isWindowFree(bitset, start, end)).toBe(false);
  });

  it('reads a busy slot via fractional-millisecond timestamps (millisecond-suppression vector)', () => {
    // Luxon preserves fractional milliseconds in toMillis(); ensure a fractional
    // positive-duration window still marks a slot and reads busy through the
    // ISO/DateTime code path that production uses.
    const baseMs = slotBoundary(3_000);
    const start = DateTime.fromMillis(baseMs).plus({ milliseconds: 0.4 });
    const end = DateTime.fromMillis(baseMs).plus({ milliseconds: 0.8 });

    const bitset = createAvailabilityBitset();
    markWindow(bitset, start, end);

    expect(bitset.occupied.size).toBeGreaterThanOrEqual(1);
    expect(isWindowFree(bitset, start, end)).toBe(false);
  });

  it('does not let a window ending on a boundary block a window starting on that boundary', () => {
    // A: ends exactly on the boundary of slot 5001 -> occupies slots strictly before it.
    const aStart = slotBoundary(5_000) + 60_000;
    const aEnd = slotBoundary(5_001);
    // B: starts exactly on that same boundary -> occupies the next slot onward.
    const bStart = slotBoundary(5_001);
    const bEnd = slotBoundary(5_001) + 60_000;

    const bitset = createAvailabilityBitset();
    markWindow(bitset, aStart, aEnd);

    // The two windows are truly non-overlapping (A ends where B begins), so B
    // must still read as free even though A is marked. The boundary guard must
    // not over-widen A into B's slot.
    expect(isWindowFree(bitset, bStart, bEnd)).toBe(true);

    // Sanity: A itself reads busy.
    expect(isWindowFree(bitset, aStart, aEnd)).toBe(false);
  });

  it('keeps a zero-duration window marking nothing (preserves existing behavior)', () => {
    const point = slotBoundary(7_000);

    const bitset = createAvailabilityBitset();
    markWindow(bitset, point, point);

    expect(bitset.occupied.size).toBe(0);
    // An empty (zero-duration) probe reads free.
    expect(isWindowFree(bitset, point, point)).toBe(true);
  });

  it('marks a multi-slot window across slots and detects an overlapping query', () => {
    // 12-minute window spanning ~3 slots starting mid-slot.
    const start = slotBoundary(9_000) + 60_000;
    const end = slotBoundary(9_000) + 60_000 + 12 * 60 * 1000;

    const bitset = createAvailabilityBitset();
    markWindow(bitset, start, end);

    expect(bitset.occupied.size).toBeGreaterThanOrEqual(3);

    // A query that overlaps even partially must read busy.
    const overlapStart = slotBoundary(9_002);
    const overlapEnd = slotBoundary(9_002) + 60_000;
    expect(isWindowFree(bitset, overlapStart, overlapEnd)).toBe(false);
  });
});
