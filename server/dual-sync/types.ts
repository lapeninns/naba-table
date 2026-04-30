/**
 * Unified bidirectional GBP <-> Nabatable Core sync domain.
 *
 * Phase 1: types.
 *
 * This module is intentionally independent of `server/google-business-profile-v2/`.
 * It owns its own provider tag, section taxonomy, state machine, and direction
 * vocabulary so the new engine can evolve without coupling to the legacy V2
 * stack during the rollout window.
 */

// ---------------------------------------------------------------------------
// Provider + sections
// ---------------------------------------------------------------------------

export const DUAL_SYNC_PROVIDER = 'google_business_profile' as const;
export type DualSyncProvider = typeof DUAL_SYNC_PROVIDER;

export const DUAL_SYNC_SECTION_KEYS = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
] as const;

export type DualSyncSectionKey = (typeof DUAL_SYNC_SECTION_KEYS)[number];
export type DualSyncFieldStateSectionKey = DualSyncSectionKey | 'core_only';

export function isDualSyncSectionKey(value: unknown): value is DualSyncSectionKey {
  return (
    typeof value === 'string' &&
    (DUAL_SYNC_SECTION_KEYS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Direction + decision vocabulary
// ---------------------------------------------------------------------------

export type DualSyncDirectionIntent = 'import_to_nabatable' | 'export_to_google';
export type DualSyncDecisionAction =
  | 'import_from_google'
  | 'export_to_google'
  | 'ignore';

export function isDualSyncDirectionIntent(value: unknown): value is DualSyncDirectionIntent {
  return value === 'import_to_nabatable' || value === 'export_to_google';
}

export function isDualSyncDecisionAction(value: unknown): value is DualSyncDecisionAction {
  return (
    value === 'import_from_google' ||
    value === 'export_to_google' ||
    value === 'ignore'
  );
}

// ---------------------------------------------------------------------------
// Google update mask vocabulary
// ---------------------------------------------------------------------------

export type DualSyncGoogleUpdateMask =
  | 'title'
  | 'profile'
  | 'phoneNumbers'
  | 'storefrontAddress'
  | 'regularHours'
  | 'specialHours'
  | 'moreHours'
  | 'categories'
  | 'serviceArea'
  | 'attributes'
  | 'serviceItems';

// ---------------------------------------------------------------------------
// Field state machine
// ---------------------------------------------------------------------------

export const DUAL_SYNC_FIELD_STATES = [
  'in_sync',
  'core_dirty',
  'gbp_dirty',
  'drifted',
  'conflict',
  'pending_import',
  'pending_export',
  'import_failed',
  'export_failed',
  'ignored',
  'unsupported',
] as const;

export type DualSyncFieldState = (typeof DUAL_SYNC_FIELD_STATES)[number];

export function isDualSyncFieldState(value: unknown): value is DualSyncFieldState {
  return (
    typeof value === 'string' &&
    (DUAL_SYNC_FIELD_STATES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Snapshot runs
// ---------------------------------------------------------------------------

export type DualSyncSnapshotRunKind =
  | 'manual'
  | 'scheduled'
  | 'core_write'
  | 'location_link'
  | 'preflight';

export type DualSyncSnapshotRunStatus = 'pending' | 'succeeded' | 'failed';

export interface DualSyncSnapshotRun {
  readonly id: string;
  readonly restaurantId: string;
  readonly provider: DualSyncProvider;
  readonly runKind: DualSyncSnapshotRunKind;
  readonly status: DualSyncSnapshotRunStatus;
  readonly snapshotHash: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Outbound candidates
// ---------------------------------------------------------------------------

export type DualSyncOutboundStatus = 'open' | 'resolved' | 'superseded' | 'cancelled';
export type DualSyncOutboundSource = 'core_write' | 'manual' | 'scheduled';

export interface DualSyncOutboundCandidate {
  readonly id: string;
  readonly restaurantId: string;
  readonly provider: DualSyncProvider;
  readonly sectionKey: DualSyncSectionKey;
  readonly fieldKey: string;
  readonly proposedValue: unknown;
  readonly proposedValueHash: string | null;
  readonly baselineGbpHash: string | null;
  readonly status: DualSyncOutboundStatus;
  readonly source: DualSyncOutboundSource;
  readonly createdByUserId: string | null;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Publish operations
// ---------------------------------------------------------------------------

export type DualSyncPublishOperationStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'retrying';

export interface DualSyncPublishOperation {
  readonly id: string;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly fieldKey: string;
  readonly direction: 'import_from_google' | 'export_to_google';
  readonly status: DualSyncPublishOperationStatus;
  readonly attemptCount: number;
  readonly beforeCoreHash: string | null;
  readonly beforeGbpHash: string | null;
  readonly afterCoreHash: string | null;
  readonly afterGbpHash: string | null;
  readonly googleUpdateMask: DualSyncGoogleUpdateMask | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly externalResponse: unknown;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Field state row (canonical)
// ---------------------------------------------------------------------------

export interface DualSyncFieldStateRecord {
  readonly id: string;
  readonly restaurantId: string;
  readonly provider: DualSyncProvider;
  readonly sectionKey: DualSyncFieldStateSectionKey;
  readonly fieldKey: string;
  readonly state: DualSyncFieldState;
  readonly coreValueHash: string | null;
  readonly gbpValueHash: string | null;
  readonly lastInSyncHash: string | null;
  readonly lastCoreChangeAt: string | null;
  readonly lastGbpChangeAt: string | null;
  readonly lastInSyncAt: string | null;
  readonly lastSnapshotRunId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
