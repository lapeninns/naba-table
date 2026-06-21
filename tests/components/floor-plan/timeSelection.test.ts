import { describe, expect, it } from 'vitest';

import { segmentAt, toMs } from '@/components/features/floor-plan/domain/timeSelection';
import type { TableTimelineSegment } from '@/types/ops';

const BASE = Date.parse('2026-06-21T18:00:00.000Z');
const mins = (n: number) => n * 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function seg(startMin: number, endMin: number): TableTimelineSegment {
  return {
    start: iso(BASE + mins(startMin)),
    end: iso(BASE + mins(endMin)),
    state: 'available',
    serviceKey: 'dinner',
    booking: null,
    hold: null,
  };
}

describe('toMs', () => {
  it('parses ISO to epoch ms', () => {
    expect(toMs(iso(BASE))).toBe(BASE);
  });
  it('returns null for missing or invalid input', () => {
    expect(toMs(null)).toBeNull();
    expect(toMs(undefined)).toBeNull();
    expect(toMs('not-a-date')).toBeNull();
  });
});

describe('segmentAt', () => {
  const segments = [seg(0, 60), seg(60, 120), seg(120, 180)];

  it('picks the segment covering T', () => {
    expect(segmentAt(segments, BASE + mins(90))).toBe(segments[1]);
  });

  it('is start-inclusive and end-exclusive at boundaries', () => {
    // Exactly at 60 belongs to the second segment, not the first.
    expect(segmentAt(segments, BASE + mins(60))).toBe(segments[1]);
    // Exactly at the very start belongs to the first.
    expect(segmentAt(segments, BASE)).toBe(segments[0]);
  });

  it('returns null when no segment covers T', () => {
    expect(segmentAt(segments, BASE - mins(1))).toBeNull();
    expect(segmentAt(segments, BASE + mins(180))).toBeNull();
  });

  it('returns null for an empty segment list', () => {
    expect(segmentAt([], BASE)).toBeNull();
  });
});
