/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Writer ports for the V2 publish orchestrator. The orchestrator is fully
 * testable without Supabase and without Google credentials: a test harness
 * implements these ports with stubs.
 *
 * Production wiring lives in `wiring.ts` and composes the legacy core
 * writers and Google patch writers.
 */

import type {
  SyncV2DirectionIntent,
  SyncV2GoogleUpdateMask,
  SyncV2PreflightNotice,
  SyncV2PublishJob,
  SyncV2SectionKey,
} from '../types';

export interface NabatableApplyInput {
  readonly publishJob: SyncV2PublishJob;
  readonly actorUserId: string | null;
}

export interface NabatableApplyOutput {
  readonly affectedSectionKeys: ReadonlyArray<SyncV2SectionKey>;
  readonly oldValues: Record<string, unknown>;
  readonly newValues: Record<string, unknown>;
}

export interface GooglePatchInput {
  readonly publishJob: SyncV2PublishJob;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly actorUserId: string | null;
}

export interface GooglePatchOutput {
  readonly affectedSectionKeys: ReadonlyArray<SyncV2SectionKey>;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly oldValues: Record<string, unknown>;
  readonly newValues: Record<string, unknown>;
}

export type WriterFailure = {
  readonly errors: ReadonlyArray<SyncV2PreflightNotice>;
  readonly classification:
    | 'retryable'
    | 'permission'
    | 'validation'
    | 'unsupported_field'
    | 'quota';
};

/**
 * One writer port per direction. The orchestrator picks the right port from
 * `directionIntent`. Each port returns a typed success or a typed failure.
 */
export interface PublishWriters {
  readonly applyToNabatable: (
    input: NabatableApplyInput,
  ) => Promise<{ ok: true; output: NabatableApplyOutput } | { ok: false; failure: WriterFailure }>;
  readonly patchGoogle: (
    input: GooglePatchInput,
  ) => Promise<{ ok: true; output: GooglePatchOutput } | { ok: false; failure: WriterFailure }>;
}

export interface PublishContractCheck {
  /**
   * Re-evaluate the contract lock for `publishJob`. Returns `null` if the
   * lock is still valid, or an array of errors if hashes drifted.
   */
  readonly verifyContractLock: (
    publishJob: SyncV2PublishJob,
  ) => Promise<ReadonlyArray<SyncV2PreflightNotice>>;
}

export interface OrchestratorPorts extends PublishWriters, PublishContractCheck {
  readonly directionIntentSupported: (intent: SyncV2DirectionIntent) => boolean;
}
