import { DateTime } from "luxon";

export type IntervalPoint = DateTime | string | number;
export type IntervalLike = {
  start: IntervalPoint;
  end: IntervalPoint;
};

function intervalPointToMillis(point: IntervalPoint): number | null {
  // Robust normalization to epoch ms with DST-gap coercion when necessary.
  if (DateTime.isDateTime(point)) {
    if (point.isValid) {
      const v = point.toMillis();
      return Number.isFinite(v) ? v : null;
    }
    // Handle non-existent local times (e.g., DST spring-forward): advance minute-by-minute
    const zoneName = point.zoneName ?? "UTC";
    const base = {
      year: point.year,
      month: point.month,
      day: point.day,
      hour: point.hour,
      minute: point.minute,
      second: point.second,
      millisecond: point.millisecond,
    } as const;

    for (let delta = 0; delta <= 120; delta += 1) {
      const t = DateTime.fromObject({ ...base, minute: base.minute + delta }, { zone: zoneName });
      if (t.isValid) {
        const v = t.toMillis();
        return Number.isFinite(v) ? v : null;
      }
    }
    return null;
  }

  if (typeof point === "number") {
    return Number.isFinite(point) ? point : null;
  }

  if (typeof point === "string") {
    const parsed = DateTime.fromISO(point, { setZone: true });
    if (parsed.isValid) {
      const v = parsed.toMillis();
      return Number.isFinite(v) ? v : null;
    }
    const m = point.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      const [, Y, M, D, H, Min, S] = m;
      const base = {
        year: Number(Y),
        month: Number(M),
        day: Number(D),
        hour: Number(H),
        minute: Number(Min),
        second: S ? Number(S) : 0,
      } as const;
      const zone = parsed.zoneName ?? "UTC";
      for (let delta = 0; delta <= 120; delta += 1) {
        const t = DateTime.fromObject({ ...base, minute: base.minute + delta }, { zone });
        if (t.isValid) {
          const v = t.toMillis();
          return Number.isFinite(v) ? v : null;
        }
      }
    }
    return null;
  }

  return null;
}

function normalizeInterval(interval: IntervalLike): { start: number; end: number } | null {
  const start = intervalPointToMillis(interval.start);
  const end = intervalPointToMillis(interval.end);
  if (start === null || end === null) {
    return null;
  }
  if (!(start < end)) {
    return null;
  }
  return { start, end };
}

/**
 * Returns whether the half-open interval `[a.start, a.end)` intersects with `[b.start, b.end)`.
 *
 * Accepts ISO strings, Luxon {@link DateTime} instances, or epoch millisecond numbers.
 * Values are normalized to UTC and invalid intervals are treated as non-overlapping.
 */
// eslint-disable-next-line no-restricted-syntax -- Canonical windowsOverlap implementation; re-exported via tables.ts
export function windowsOverlap(a: IntervalLike, b: IntervalLike): boolean {
  const first = normalizeInterval(a);
  const second = normalizeInterval(b);
  if (!first || !second) {
    return false;
  }
  // Standard half-open intersection
  if (first.start < second.end && second.start < first.end) {
    return true;
  }
  return false;
}
