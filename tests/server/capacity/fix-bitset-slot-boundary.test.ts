import { describe, expect, it } from 'vitest';

import {
  createAvailabilityBitset,
  isWindowFree,
  markWindow,
} from '@/server/capacity/planner/bitset';

const SLOT_MS = 5 * 60 * 1000;

/**
 * Regression for #3: markWindow/isWindowFree used floor(start)/ceil(end) with a
 * `slot < endSlot` loop. When a positive-duration window was collapsed by upstream
 * millisecond suppression onto a single 5-minute boundary (floor(start) ===
 * ceil(end)), it marked ZERO slots — the table looked free and a second booking
 * at the same instant could be double-booked.
 */
describe('#3 bitset slot-boundary handling', () => {
  it('occupies a slot for a window collapsed onto a single boundary (fail closed)', () => {
    const t = SLOT_MS * 100; // exactly on a 5-minute boundary
    const bitset = createAvailabilityBitset();

    markWindow(bitset, t, t);

    expect(bitset.occupied.has(100)).toBe(true);
    expect(isWindowFree(bitset, t, t)).toBe(false);
  });

  it('marks at least one slot for a sub-slot positive-duration window', () => {
    const start = SLOT_MS * 100;
    const end = start + 1000; // +1s, same slot
    const bitset = createAvailabilityBitset();

    markWindow(bitset, start, end);

    expect(bitset.occupied.size).toBeGreaterThanOrEqual(1);
    expect(isWindowFree(bitset, start, end)).toBe(false);
  });

  it('does NOT collide for genuinely adjacent, non-overlapping windows', () => {
    const a = { start: SLOT_MS * 10, end: SLOT_MS * 11 };
    const b = { start: SLOT_MS * 11, end: SLOT_MS * 12 };
    const bitset = createAvailabilityBitset([a]);

    expect(isWindowFree(bitset, b.start, b.end)).toBe(true);
  });

  it('marks exactly the spanned slots for a normal multi-slot window', () => {
    const bitset = createAvailabilityBitset();

    markWindow(bitset, 0, SLOT_MS * 3);

    expect(bitset.occupied).toEqual(new Set([0, 1, 2]));
  });

  it('detects overlap between two windows sharing a slot', () => {
    const bitset = createAvailabilityBitset([{ start: SLOT_MS * 5, end: SLOT_MS * 8 }]);

    expect(isWindowFree(bitset, SLOT_MS * 7, SLOT_MS * 9)).toBe(false);
    expect(isWindowFree(bitset, SLOT_MS * 8, SLOT_MS * 9)).toBe(true);
  });
});
