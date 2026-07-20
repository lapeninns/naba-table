import { env } from '@/lib/env';

export type AdjacencyMode = 'connected' | 'pairwise' | 'neighbors';

const AUTO_ASSIGN_RETRY_DELAYS_MS = [5_000, 15_000, 45_000] as const;

export function isSelectorScoringEnabled(): boolean {
  return true;
}

export function isSelectorLookaheadEnabled(): boolean {
  return true;
}

export function getSelectorLookaheadWindowMinutes(): number {
  return 120;
}

export function getSelectorLookaheadPenaltyWeight(): number {
  return 500;
}

export function getSelectorLookaheadBlockThreshold(): number {
  return 0;
}

export function isCombinationPlannerEnabled(): boolean {
  return true;
}

export function isOpsMetricsEnabled(): boolean {
  return true;
}

export function isHoldsEnabled(): boolean {
  return true;
}

export function isPlannerTimePruningEnabled(): boolean {
  return true;
}

export function isAllocatorV2ForceLegacy(): boolean {
  return false;
}

export function isAllocatorV2Enabled(): boolean {
  return true;
}

export function isAllocatorV2ShadowMode(): boolean {
  return false;
}

export function isAllocatorAdjacencyRequired(override?: boolean | null): boolean {
  // Adjacency-required is configurable per request via the override.
  // Default (when no override is supplied) preserves the historical invariant of `true`.
  if (typeof override === 'boolean') {
    return override;
  }
  return true;
}

export function isAllocatorServiceFailHard(): boolean {
  return false;
}

export type CapacityServiceFallbackMode = 'off' | 'bounded';

export type CapacityServiceFallbackConfig = {
  mode: CapacityServiceFallbackMode;
  maxExtensionMinutes: number;
};

const SERVICE_FALLBACK_DEFAULT_EXTENSION_MINUTES = 60;
const SERVICE_FALLBACK_MAX_EXTENSION_MINUTES = 180;

/**
 * Runtime setting for the ServiceNotFoundError fallback in
 * `computeBookingWindowWithFallback`.
 *
 * - `CAPACITY_SERVICE_FALLBACK=off` disables the fallback entirely: bookings
 *   outside every policy service window fail with a controlled
 *   OUTSIDE_SERVICE_HOURS response instead of being force-fitted.
 * - `CAPACITY_SERVICE_FALLBACK=bounded` (default) allows the fallback only
 *   when the booking explicitly names a configured service (serviceHint or
 *   bookingOption) AND starts within `maxExtensionMinutes` of that service's
 *   configured window. The previous behavior of silently guessing the first
 *   service in `serviceOrder` and expanding it without bounds is removed.
 * - `CAPACITY_SERVICE_FALLBACK_MAX_EXTENSION_MINUTES` (0–180, default 60)
 *   bounds how far outside the service window a fallback may reach.
 */
export function getCapacityServiceFallbackConfig(): CapacityServiceFallbackConfig {
  const rawMode = (process.env.CAPACITY_SERVICE_FALLBACK ?? 'bounded').trim().toLowerCase();
  const mode: CapacityServiceFallbackMode = rawMode === 'off' ? 'off' : 'bounded';

  const rawExtension = Number.parseInt(
    process.env.CAPACITY_SERVICE_FALLBACK_MAX_EXTENSION_MINUTES ?? '',
    10,
  );
  const maxExtensionMinutes = Number.isInteger(rawExtension)
    ? Math.min(Math.max(rawExtension, 0), SERVICE_FALLBACK_MAX_EXTENSION_MINUTES)
    : SERVICE_FALLBACK_DEFAULT_EXTENSION_MINUTES;

  return { mode, maxExtensionMinutes };
}

export function getAllocatorKMax(): number {
  return 5;
}

export function getAllocatorAdjacencyMinPartySize(): number | null {
  return null;
}

export function getAllocatorAdjacencyMode(): AdjacencyMode {
  return 'connected';
}

export function getManualAssignmentMaxSlack(): number | null {
  return null;
}

export function isManualAssignmentSnapshotValidationEnabled(): boolean {
  return true;
}

export function getSelectorPlannerLimits(): {
  maxPlansPerSlack?: number;
  maxCombinationEvaluations?: number;
  enumerationTimeoutMs?: number;
} {
  return {
    maxCombinationEvaluations: 1_000,
  };
}

export function isHoldStrictConflictsEnabled(): boolean {
  return true;
}

export function isAdjacencyQueryUndirected(): boolean {
  return true;
}

export function getContextQueryPaddingMinutes(): number {
  return 60;
}

export function getHoldMinTtlSeconds(): number {
  return 180;
}

export function isEmailQueueEnabled(): boolean {
  return env.node.env !== 'test';
}

export function isPolicyRequoteEnabled(): boolean {
  return true;
}

export function isAutoAssignOnBookingEnabled(): boolean {
  return true;
}

export function getInlineAutoAssignTimeoutMs(): number {
  return 12_000;
}

export function getAutoAssignMaxRetries(): number {
  return 3;
}

export function getAutoAssignRetryDelaysMs(): number[] {
  return [...AUTO_ASSIGN_RETRY_DELAYS_MS];
}

export function getAutoAssignStartCutoffMinutes(): number {
  return 10;
}

export function isGuestLookupPolicyEnabled(): boolean {
  return false;
}

export function isBookingPastTimeBlockingEnabled(): boolean {
  return true;
}

export function getBookingPastTimeGraceMinutes(): number {
  return 5;
}

export function getPendingSelfServeGraceMinutes(): number {
  return 10;
}

export function isUnifiedBookingValidationEnabled(): boolean {
  return true;
}

export function isDbStrictConstraintMappingEnabled(): boolean {
  return false;
}

export function isPlannerCacheEnabled(): boolean {
  return false;
}

export function getPlannerCacheTtlMs(): number {
  return 60_000;
}

export function shouldEmitCapacityPlannerStats(): boolean {
  return false;
}

export function isManualSessionPollingEnabled(): boolean {
  return true;
}
