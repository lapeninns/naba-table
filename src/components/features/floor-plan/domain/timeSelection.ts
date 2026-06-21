import type { TableTimelineSegment } from '@/types/ops';

/** Parse an ISO timestamp to epoch ms. Returns null on missing/invalid input. */
export function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Pick the segment covering scrub time T (epoch ms). Uses a half-open [start, end)
 * interval so adjacent contiguous segments never double-match at the boundary.
 * Segments arrive contiguous and sorted from the server.
 */
export function segmentAt(
  segments: readonly TableTimelineSegment[],
  tMs: number,
): TableTimelineSegment | null {
  for (const segment of segments) {
    const start = toMs(segment.start);
    const end = toMs(segment.end);
    if (start === null || end === null) continue;
    if (tMs >= start && tMs < end) return segment;
  }
  return null;
}
