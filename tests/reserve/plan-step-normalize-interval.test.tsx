import { describe, expect, it } from 'vitest';

import { normalizeTimeToInterval } from '@reserve/features/reservations/wizard/hooks/usePlanStepForm';

describe('normalizeTimeToInterval', () => {
  it('snaps to the NEAREST interval boundary (rounds, not floors)', () => {
    // 19:08 = 1148 minutes; with a 15-minute interval the nearest boundary is 19:15.
    // The pre-fix Math.floor behaviour produced 19:00 (triage-096).
    expect(normalizeTimeToInterval('19:08', 15, null)).toBe('19:15');
  });

  it('rounds down when the value is below the interval midpoint', () => {
    // 19:07 = 1147 minutes; nearest boundary is 19:00.
    expect(normalizeTimeToInterval('19:07', 15, null)).toBe('19:00');
  });

  it('leaves values already on a boundary unchanged', () => {
    expect(normalizeTimeToInterval('19:15', 15, null)).toBe('19:15');
  });

  it('never rounds past the latest selectable slot', () => {
    // 19:08 would round up to 19:15, but the last selectable minute is 19:10 (1150);
    // the snap must step back to the previous boundary (19:00) rather than overshoot.
    expect(normalizeTimeToInterval('19:08', 15, 1150)).toBe('19:00');
  });

  it('clamps values beyond the latest selectable slot before snapping', () => {
    // 23:50 (1430) is clamped to the latest selectable minute (1155 = 19:15) and
    // then snaps to that boundary.
    expect(normalizeTimeToInterval('23:50', 15, 1155)).toBe('19:15');
  });

  it('returns empty input unchanged', () => {
    expect(normalizeTimeToInterval('', 15, null)).toBe('');
  });

  it('returns the original value when there is no usable interval', () => {
    expect(normalizeTimeToInterval('19:08', null, null)).toBe('19:08');
    expect(normalizeTimeToInterval('19:08', 0, null)).toBe('19:08');
  });

  it('returns malformed input unchanged', () => {
    expect(normalizeTimeToInterval('not-a-time', 15, null)).toBe('not-a-time');
  });
});
