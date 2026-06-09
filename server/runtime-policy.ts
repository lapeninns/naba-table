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

export function isOpsRejectionAnalyticsEnabled(): boolean {
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

export function isAllocatorAdjacencyRequired(): boolean {
  return true;
}

export function isAllocatorServiceFailHard(): boolean {
  return false;
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
