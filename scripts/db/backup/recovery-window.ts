import { computeContentTtlDays } from '../../../server/dual-sync/retention/policy';

/**
 * Effective recovery window.
 *
 * The GBP retention policy (server/dual-sync/retention/policy.ts) derives the live
 * content TTL from `backupWindowDays`: any copy of provider content — live rows,
 * native physical backups, independent logical backups, storage object copies — must
 * be gone within the 30-day recovery envelope. The effective recovery window is
 * therefore the LONGEST time any copy can exist, rounded UP conservatively, and it is
 * the value that must be fed into `computeContentTtlDays` (read-only reference; this
 * module never changes content-expiry enforcement).
 */

export type EffectiveRecoveryWindowInput = {
  readonly nativeRetentionDays: number;
  readonly independentRetentionDays: number;
  readonly intervalHours: number;
  readonly overhangDays: number;
};

export class RecoveryWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryWindowError';
  }
}

function assertNonNegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RecoveryWindowError(`${field} must be a non-negative finite number.`);
  }
}

/**
 * Longest-lived copy wins. A backup taken just before a retention boundary can live
 * for the full retention period plus up to one interval before the next sweep, plus
 * the configured overhang. Fractions always round up.
 */
export function computeEffectiveRecoveryWindowDays(input: EffectiveRecoveryWindowInput): number {
  assertNonNegativeFinite(input.nativeRetentionDays, 'nativeRetentionDays');
  assertNonNegativeFinite(input.independentRetentionDays, 'independentRetentionDays');
  assertNonNegativeFinite(input.intervalHours, 'intervalHours');
  assertNonNegativeFinite(input.overhangDays, 'overhangDays');
  if (input.nativeRetentionDays === 0 && input.independentRetentionDays === 0) {
    throw new RecoveryWindowError('At least one retention period must be positive.');
  }
  const intervalDays = input.intervalHours / 24;
  const independentWindow = input.independentRetentionDays + intervalDays;
  const longest = Math.max(input.nativeRetentionDays, independentWindow);
  const window = Math.ceil(longest + input.overhangDays);
  return Math.max(1, window);
}

/**
 * Implied live content TTL under the GBP retention policy for a given effective
 * window. Read-only bridge to the existing enforcement code; throws its
 * RetentionPolicyError when the window leaves no practical TTL.
 */
export function impliedContentTtlDays(effectiveRecoveryWindowDays: number): number {
  return computeContentTtlDays(effectiveRecoveryWindowDays);
}
