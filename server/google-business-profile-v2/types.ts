/**
 * Phase 1 of the GBP Dual-Sync V2 architecture.
 *
 * Strict typed contracts for the new versioned engine. Mirrors the
 * `gbp_sync_v2_*` Supabase tables added in
 * `supabase/migrations/20260428232200_add_gbp_sync_v2.sql`.
 *
 * Legacy types in `server/google-business-profile/workflow.ts` are NOT
 * re-exported here to keep the V2 surface independently versionable. Cross-
 * imports happen only through narrow read-only adapters in Phase 2.
 */

export const GBP_SYNC_V2_PROVIDER = 'google_business_profile' as const;

/**
 * Section keys participating in V2 diff/decision/publish flows. This list
 * matches the legacy section taxonomy so downstream Nabatable writers can be
 * reused, but the V2 engine treats it as the authoritative set.
 */
export const SYNC_V2_SECTION_KEYS = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
] as const;

export type SyncV2SectionKey = (typeof SYNC_V2_SECTION_KEYS)[number];

/**
 * Direction intent declared at preflight time and frozen into the publish
 * job. Two pipelines exist:
 *  - `import_to_nabatable`: apply approved Google winners to Nabatable core
 *  - `export_to_google`: push approved Nabatable winners as Google patches
 */
export type SyncV2DirectionIntent = 'import_to_nabatable' | 'export_to_google';

/**
 * Field-level decision actions. `ignore` is always legal for any diff item.
 * `import_from_google` is gated by `canImport`; `export_to_google` by
 * `canExport`.
 */
export type SyncV2DecisionAction = 'import_from_google' | 'export_to_google' | 'ignore';

/**
 * Google update masks recognised by the V2 export pipeline. A superset of
 * the legacy mask vocabulary; new masks added here must also be honoured by
 * `publish/writers-google.ts`.
 */
export type SyncV2GoogleUpdateMask =
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

export type SyncV2DraftStatus =
  | 'open'
  | 'preflight_locked'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'
  | 'archived';

export type SyncV2PublishJobStatus =
  | 'preflight_locked'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export type SyncV2PublishLeg = 'nabatable_apply' | 'google_patch' | 'rollback';

export type SyncV2PublishResult = 'pending' | 'success' | 'failed' | 'partial' | 'skipped';

export type SyncV2ErrorClassification =
  | 'retryable'
  | 'permission'
  | 'validation'
  | 'unsupported_field'
  | 'quota'
  | 'contract_lock_mismatch'
  | 'stale_snapshot';

// ---------------------------------------------------------------------------
// Snapshot + diff
// ---------------------------------------------------------------------------

/**
 * Canonical snapshot for one side of the diff. `value` is the section payload
 * after normalization. `hash` is the deterministic SHA-256-of-canonical-JSON
 * over `value` and is stable across reads.
 */
export interface SyncV2SectionSnapshotV<TValue = unknown> {
  readonly sectionKey: SyncV2SectionKey;
  readonly value: TValue;
  readonly hash: string;
}

/**
 * A whole-side snapshot rolled up across all sections. The roll-up `hash` is
 * the SHA-256 over the ordered, canonicalised section snapshots.
 */
export interface SyncV2Snapshot {
  readonly sections: ReadonlyArray<SyncV2SectionSnapshotV>;
  readonly hash: string;
  readonly fetchedAt: string; // ISO-8601 UTC
}

/**
 * Capability flags for one diff item. Decided by the section adapter, not by
 * the UI. Adapters MUST default to `false` for any direction the underlying
 * provider cannot honour.
 */
export interface SyncV2DiffCapabilities {
  readonly canImport: boolean;
  readonly canExport: boolean;
  readonly canIgnore: boolean; // always true today; reserved for future policies
  readonly googleUpdateMask?: SyncV2GoogleUpdateMask;
  readonly blockedReasons?: ReadonlyArray<string>;
}

/**
 * One diff item in the canonical V2 contract. Both sides are recorded with
 * their hashes so stale detection at publish time is decision-local, not
 * snapshot-global.
 */
export interface SyncV2DiffItem<TNabatable = unknown, TGoogle = unknown> {
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
  readonly normalizedNabatableValue: TNabatable;
  readonly normalizedGoogleValue: TGoogle;
  readonly nabatableValueHash: string;
  readonly googleValueHash: string;
  readonly capabilities: SyncV2DiffCapabilities;
  /** Stable ordering hint within a section. */
  readonly sortOrder: number;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export interface SyncV2Decision {
  readonly id: string;
  readonly draftId: string;
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
  readonly action: SyncV2DecisionAction;
  readonly nabatableValueHash: string;
  readonly googleValueHash: string;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string;
}

/**
 * Input shape for upserting decisions. The hashes MUST be the ones taken from
 * the diff item the operator was looking at. The store rejects mismatches as
 * stale.
 */
export interface SyncV2DecisionInput {
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
  readonly action: SyncV2DecisionAction;
  readonly nabatableValueHash: string;
  readonly googleValueHash: string;
}

// ---------------------------------------------------------------------------
// Workflow + Draft
// ---------------------------------------------------------------------------

export interface SyncV2Workflow {
  readonly id: string;
  readonly restaurantId: string;
  readonly provider: typeof GBP_SYNC_V2_PROVIDER;
  readonly activeDraftId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SyncV2Draft {
  readonly id: string;
  readonly workflowId: string;
  readonly restaurantId: string;
  readonly status: SyncV2DraftStatus;
  readonly nabatableSnapshot: SyncV2Snapshot;
  readonly googleSnapshot: SyncV2Snapshot;
  readonly diffItems: ReadonlyArray<SyncV2DiffItem>;
  readonly fetchedAt: string;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export interface SyncV2PreflightNotice {
  readonly code: string;
  readonly message: string;
  readonly sectionKey?: SyncV2SectionKey;
  readonly fieldKey?: string;
  readonly googleUpdateMask?: SyncV2GoogleUpdateMask;
}

export interface SyncV2PreflightResult {
  readonly directionIntent: SyncV2DirectionIntent;
  readonly publishablePlanItems: ReadonlyArray<{
    readonly sectionKey: SyncV2SectionKey;
    readonly fieldKey: string;
    readonly action: SyncV2DecisionAction;
  }>;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly warnings: ReadonlyArray<SyncV2PreflightNotice>;
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  readonly frozenDecisionsHash: string;
  readonly frozenNabatableSnapshotHash: string;
  readonly frozenGoogleSnapshotHash: string;
}

export interface SyncV2FrozenDecision {
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
  readonly action: SyncV2DecisionAction;
  readonly nabatableValueHash: string;
  readonly googleValueHash: string;
}

// ---------------------------------------------------------------------------
// Publish job + events
// ---------------------------------------------------------------------------

export interface SyncV2PublishJob {
  readonly id: string;
  readonly workflowId: string;
  readonly draftId: string;
  readonly restaurantId: string;
  readonly directionIntent: SyncV2DirectionIntent;
  readonly publishPlanId: string;
  readonly idempotencyKey: string;
  readonly frozenDecisions: ReadonlyArray<SyncV2FrozenDecision>;
  readonly frozenDecisionsHash: string;
  readonly frozenNabatableSnapshotHash: string;
  readonly frozenGoogleSnapshotHash: string;
  readonly preflightResult: SyncV2PreflightResult | null;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly status: SyncV2PublishJobStatus;
  readonly errorClassification: SyncV2ErrorClassification | null;
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  readonly nabatableEventId: string | null;
  readonly googleEventId: string | null;
  readonly rollbackEventId: string | null;
  readonly preflightedAt: string;
  readonly publishedAt: string | null;
  readonly failedAt: string | null;
  readonly retriedAt: string | null;
  readonly createdByUserId: string | null;
  readonly publishedByUserId: string | null;
  readonly retriedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SyncV2PublishEvent {
  readonly id: string;
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly direction: SyncV2DirectionIntent;
  readonly leg: SyncV2PublishLeg;
  readonly result: SyncV2PublishResult;
  readonly affectedSectionKeys: ReadonlyArray<SyncV2SectionKey>;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly oldValues: Record<string, unknown>;
  readonly newValues: Record<string, unknown>;
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  readonly actorUserId: string | null;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isSyncV2SectionKey(value: unknown): value is SyncV2SectionKey {
  return typeof value === 'string' && (SYNC_V2_SECTION_KEYS as readonly string[]).includes(value);
}

export function isSyncV2DecisionAction(value: unknown): value is SyncV2DecisionAction {
  return value === 'import_from_google' || value === 'export_to_google' || value === 'ignore';
}

export function isSyncV2DirectionIntent(value: unknown): value is SyncV2DirectionIntent {
  return value === 'import_to_nabatable' || value === 'export_to_google';
}
