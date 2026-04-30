/**
 * Phase 3 of the unified dual-sync engine.
 *
 * Publish orchestrator types. The orchestrator consumes a frozen
 * decision set produced by the diff/preview UI, runs one operation per
 * field through provider-specific ports, persists per-field operation
 * rows for audit + retry, then recomputes the field-state machine.
 */

import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type {
  DualSyncDecisionAction,
  DualSyncGoogleUpdateMask,
  DualSyncPublishOperation,
  DualSyncPublishOperationStatus,
  DualSyncSectionKey,
} from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One entry in the operator's frozen decision set. Pinning the snapshot
 * hashes the decision was based on lets the orchestrator reject stale
 * submissions if Google or Core moved between preview and publish.
 */
export interface DualSyncPublishDecision {
  readonly fieldKey: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly action: DualSyncDecisionAction;

  /** Snapshot hashes pinned at the time the operator viewed the diff. */
  readonly pinnedCoreHash: string | null;
  readonly pinnedGbpHash: string | null;
}

export interface DualSyncRunPublishInput {
  readonly restaurantId: string;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly actorUserId: string | null;
  /** Hash of the canonical Core snapshot the operator viewed. */
  readonly pinnedCoreSnapshotHash?: string | null;
  /** Hash of the canonical Google snapshot the operator viewed. */
  readonly pinnedGbpSnapshotHash?: string | null;
}

export type DualSyncOperationFailureCode =
  | 'CORE_DRIFT'
  | 'GBP_DRIFT'
  | 'PORT_FAILURE'
  | 'INVALID_DECISION'
  | 'UNSUPPORTED_FIELD'
  | 'UNKNOWN';

export interface DualSyncOperationFailure {
  readonly code: DualSyncOperationFailureCode;
  readonly message: string;
  readonly retryable: boolean;
}

export interface DualSyncPublishJobSummary {
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly totalDecisions: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
  readonly failures: ReadonlyArray<{
    readonly fieldKey: string;
    readonly failure: DualSyncOperationFailure;
  }>;
}

export interface DualSyncOperationContext {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly decision: DualSyncPublishDecision;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly actorUserId: string | null;
}

export interface DualSyncOperationResult {
  readonly status: DualSyncPublishOperationStatus;
  readonly googleUpdateMask?: DualSyncGoogleUpdateMask | null;
  readonly externalResponse?: unknown;
  readonly afterCoreHash?: string | null;
  readonly afterGbpHash?: string | null;
  readonly failure?: DualSyncOperationFailure;
}

/**
 * Context handed to a section-level batch export port. The orchestrator
 * groups consecutive `export_to_google` decisions that share a
 * `sectionKey` and offers them to the batch port before falling back to
 * per-field dispatch.
 */
export interface DualSyncBatchExportContext {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly publishJobId: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly decisions: ReadonlyArray<DualSyncPublishDecision>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly actorUserId: string | null;
}

/**
 * Outcome of a section-level batch export.
 *
 * - `supported: false` means the port did not run; the orchestrator
 *   falls back to per-field dispatch for the group.
 * - `supported: true` means the port did run and returns one
 *   `DualSyncOperationResult` per fieldKey in the input batch.
 */
export type DualSyncBatchExportResult =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly perField: Readonly<Record<string, DualSyncOperationResult>>;
    };
