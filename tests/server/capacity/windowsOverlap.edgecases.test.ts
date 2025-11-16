import { DateTime } from 'luxon';

import { windowsOverlap } from '@/server/capacity/time-windows';

describe('windowsOverlap edge cases', () => {
  it('treats touching windows as non-overlapping ([start, end) semantics)', () => {
    const aStart = DateTime.fromISO('2025-03-10T10:00:00Z');
    const aEnd = DateTime.fromISO('2025-03-10T11:00:00Z');
    const bStart = aEnd; // touches at end == start
    const bEnd = DateTime.fromISO('2025-03-10T12:00:00Z');

    expect(windowsOverlap({ start: aStart, end: aEnd }, { start: bStart, end: bEnd })).toBe(false);
    expect(windowsOverlap({ start: bStart, end: bEnd }, { start: aStart, end: aEnd })).toBe(false);
  });

  it('handles DST spring forward correctly in UTC normalization', () => {
    // Simulate a locale where DST starts at 2025-03-30T01:00:00Z (+1h)
    const startLocal = DateTime.fromISO('2025-03-30T00:30:00', { zone: 'Europe/London' });
    const endLocal = DateTime.fromISO('2025-03-30T02:30:00', { zone: 'Europe/London' });
    const a = { start: startLocal, end: endLocal };

    const bStart = DateTime.fromISO('2025-03-30T01:30:00', { zone: 'Europe/London' });
    const bEnd = DateTime.fromISO('2025-03-30T03:00:00', { zone: 'Europe/London' });
    const b = { start: bStart, end: bEnd };

    // Both intervals normalize to UTC; our normalization coerces invalid local times forward.
    // Depending on zone semantics, the first valid minute after 01:30 may be 02:00 (overlap) or 02:30 (touching).
    // Current implementation treats 01:30 → 02:30 in Europe/London, so these become touching at 02:30.
    expect(windowsOverlap(a, b)).toBe(false);
  });

  it('handles DST fall back correctly with half-open intervals', () => {
    // Europe/London DST ends around 2025-10-26 02:00 local (clocks go back)
    const aStart = DateTime.fromISO('2025-10-26T00:30:00', { zone: 'Europe/London' });
    const aEnd = DateTime.fromISO('2025-10-26T02:30:00', { zone: 'Europe/London' });
    const bStart = DateTime.fromISO('2025-10-26T02:30:00', { zone: 'Europe/London' });
    const bEnd = DateTime.fromISO('2025-10-26T03:00:00', { zone: 'Europe/London' });

    // Touching at boundary must not overlap (half-open [start,end))
    expect(windowsOverlap({ start: aStart, end: aEnd }, { start: bStart, end: bEnd })).toBe(false);
  });
});
