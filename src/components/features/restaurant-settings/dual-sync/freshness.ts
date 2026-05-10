/**
 * Phase 3o of the unified dual-sync engine.
 *
 * Pure helpers for formatting "freshness" / "staleness" of dual-sync
 * timestamps. Used by the shell header chip and the per-field row.
 *
 * The thresholds intentionally bias toward operator visibility:
 *  - "fresh"   : 0 minutes .. 60 minutes
 *  - "recent"  : 60 minutes .. 24 hours
 *  - "stale"   : 24 hours+
 *  - "never"   : timestamp is null/absent
 *
 * The labels are short ("3m", "2h", "5d") so they fit inside chips.
 */

export type DualSyncFreshnessTone = 'fresh' | 'recent' | 'stale' | 'never';

export interface DualSyncFreshness {
  readonly tone: DualSyncFreshnessTone;
  /** Short label like "12m" or "2h". `"—"` when never. */
  readonly label: string;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const FRESH_LIMIT = HOUR;
const RECENT_LIMIT = DAY;

export function freshnessAge(
  timestamp: string | null | undefined,
  now: Date = new Date(),
): DualSyncFreshness {
  if (!timestamp) {
    return { tone: 'never', label: '—' };
  }
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) {
    return { tone: 'never', label: '—' };
  }
  const ageMs = Math.max(0, now.getTime() - ts);
  return {
    tone: classifyAge(ageMs),
    label: formatAge(ageMs),
  };
}

export function classifyAge(ageMs: number): DualSyncFreshnessTone {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'never';
  if (ageMs < FRESH_LIMIT) return 'fresh';
  if (ageMs < RECENT_LIMIT) return 'recent';
  return 'stale';
}

export function formatAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return '—';
  if (ageMs < MINUTE) {
    const s = Math.max(1, Math.floor(ageMs / SECOND));
    return `${s}s`;
  }
  if (ageMs < HOUR) {
    const m = Math.max(1, Math.floor(ageMs / MINUTE));
    return `${m}m`;
  }
  if (ageMs < DAY) {
    const h = Math.max(1, Math.floor(ageMs / HOUR));
    return `${h}h`;
  }
  const d = Math.max(1, Math.floor(ageMs / DAY));
  return `${d}d`;
}
