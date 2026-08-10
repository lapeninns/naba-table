import { claimNextDualSyncJob, completeDualSyncJob, failDualSyncJob } from './jobs';
import { DUAL_SYNC_RESTAURANT_PAUSED_CODE } from '../controls';
import {
  executeScheduledGoogleUpdateRefresh,
  type ScheduledGoogleUpdateRefreshExecutor,
} from '../freshness/refresh-google-updates';
import {
  EXACT_CONSENT_VERSION,
  executeDatabaseQueuedExactConsent,
  parseDatabaseGoogleWriteQueueEnvelope,
  parseGoogleWriteQueueEnvelope,
  type DatabaseGoogleWriteQueueEnvelope,
  type GoogleWriteQueueEnvelope,
} from '../publish/exact-consent';
import { createDurableDualSyncGoogleEditThrottle } from '../publish/google-safety';
import { runPublish, type RunPublishOptions } from '../publish/orchestrator';
import { defaultDualSyncPorts } from '../publish/ports';
import { refreshFromGoogle, type RefreshFromGoogleInput } from '../refresh';
import { runAutoExportForRestaurant } from '../scheduling/auto-export';

import type { DualSyncPublishDecision } from '../publish/types';
import type { DualSyncJob, DualSyncJobKind, DualSyncSnapshotRunKind } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type JsonObject = Record<string, unknown>;

export interface DualSyncQueueWorkerOptions {
  readonly publishOptions?: RunPublishOptions;
  readonly refreshOptions?: Pick<RefreshFromGoogleInput, 'lockManager' | 'lockTtlMs'>;
  readonly retryAfterMs?: (input: {
    readonly job: DualSyncJob;
    readonly errorCode: string;
    readonly errorMessage: string;
  }) => number;
  readonly executeGoogleWriteEnvelope?: (
    envelope: GoogleWriteQueueEnvelope | DatabaseGoogleWriteQueueEnvelope,
  ) => Promise<void>;
  readonly executeScheduledGoogleUpdateRefresh?: ScheduledGoogleUpdateRefreshExecutor;
}

export interface ProcessNextDualSyncJobInput {
  readonly client: DbClient;
  readonly workerId: string;
  readonly now?: string;
  readonly options?: DualSyncQueueWorkerOptions;
}

export type ProcessNextDualSyncJobResult =
  | { readonly status: 'idle'; readonly job: null }
  | { readonly status: 'succeeded'; readonly job: DualSyncJob }
  | { readonly status: 'retrying' | 'dead_letter'; readonly job: DualSyncJob };

function payloadObject(job: DualSyncJob): JsonObject {
  if (job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)) {
    return job.payload as JsonObject;
  }
  return {};
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isPinnedHash(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isPublishDecision(value: unknown): value is DualSyncPublishDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.fieldKey === 'string' &&
    typeof row.sectionKey === 'string' &&
    (row.action === 'import_from_google' ||
      row.action === 'export_to_google' ||
      row.action === 'ignore') &&
    Object.prototype.hasOwnProperty.call(row, 'pinnedCoreHash') &&
    Object.prototype.hasOwnProperty.call(row, 'pinnedGbpHash') &&
    isPinnedHash(row.pinnedCoreHash) &&
    isPinnedHash(row.pinnedGbpHash)
  );
}

function publishDecisions(payload: JsonObject): DualSyncPublishDecision[] {
  const decisions = payload.decisions;
  if (!Array.isArray(decisions) || decisions.length === 0 || !decisions.every(isPublishDecision)) {
    throw new Error('publish_batch job payload must include at least one valid decision.');
  }
  return decisions.map((decision) => ({
    fieldKey: decision.fieldKey,
    sectionKey: decision.sectionKey,
    action: decision.action,
    pinnedCoreHash: decision.pinnedCoreHash,
    pinnedGbpHash: decision.pinnedGbpHash,
  }));
}

function refreshKindForJob(jobKind: DualSyncJobKind): DualSyncSnapshotRunKind {
  switch (jobKind) {
    case 'google_refresh_scheduled':
      return 'scheduled';
    case 'core_write_recompute':
      return 'core_write';
    case 'mirror_refresh_after_publish':
      return 'preflight';
    default:
      return 'manual';
  }
}

function isPubSubCorrelatedRefresh(payload: JsonObject): boolean {
  const fields = [
    payload.eventId,
    payload.sourceReceiptSubscription,
    payload.sourceReceiptMessageId,
  ];
  if (fields.every((value) => value === undefined)) return false;
  if (
    typeof payload.eventId === 'string' &&
    payload.eventId.length > 0 &&
    typeof payload.sourceReceiptSubscription === 'string' &&
    payload.sourceReceiptSubscription.length > 0 &&
    typeof payload.sourceReceiptMessageId === 'string' &&
    payload.sourceReceiptMessageId.length > 0
  ) {
    return true;
  }
  throw Object.assign(new Error('Invalid Google update refresh receipt correlation.'), {
    code: 'GBP_REFRESH_RECEIPT_INVALID',
  });
}

function assertScheduledRefreshFence(job: DualSyncJob): void {
  if (
    !job.externalProfileId ||
    !job.externalAccountId ||
    !job.externalLocationId ||
    !job.connectionGeneration ||
    !job.consentEpoch
  ) {
    throw new Error('Scheduled Google update refresh job is missing its immutable fence.');
  }
}

async function executeDualSyncJob(
  client: DbClient,
  job: DualSyncJob,
  options: DualSyncQueueWorkerOptions = {},
  observedAt = new Date().toISOString(),
): Promise<void> {
  const payload = payloadObject(job);
  switch (job.jobKind) {
    case 'publish_batch':
      if (
        payload.confirmationVersion === EXACT_CONSENT_VERSION ||
        payload.confirmation_version === EXACT_CONSENT_VERSION
      ) {
        const envelope =
          payload.confirmation_version === EXACT_CONSENT_VERSION
            ? parseDatabaseGoogleWriteQueueEnvelope(job.payload)
            : parseGoogleWriteQueueEnvelope(job.payload);
        if (options.executeGoogleWriteEnvelope) {
          await options.executeGoogleWriteEnvelope(envelope);
          return;
        }
        if ('confirmation_version' in envelope) {
          await executeDatabaseQueuedExactConsent({ client, envelope });
          return;
        }
        throw new Error('Legacy exact Google write envelope is not executable.');
      }
      await runPublish(
        client,
        {
          restaurantId: job.restaurantId,
          decisions: publishDecisions(payload),
          actorUserId: optionalString(payload.actorUserId),
          clientRequestId: optionalString(payload.clientRequestId) ?? job.idempotencyKey,
          publishBatchId: optionalString(payload.publishBatchId),
          pinnedCoreSnapshotHash: optionalString(payload.pinnedCoreSnapshotHash),
          pinnedGbpSnapshotHash: optionalString(payload.pinnedGbpSnapshotHash),
        },
        {
          ports: defaultDualSyncPorts(),
          googleEditThrottle: createDurableDualSyncGoogleEditThrottle(client),
          refreshGoogleBeforePublish: true,
          ...options.publishOptions,
        },
      );
      return;
    case 'auto_export':
      await runAutoExportForRestaurant({
        client,
        restaurantId: job.restaurantId,
        maxCandidates: optionalNumber(payload.maxCandidates),
        actorUserId: optionalString(payload.actorUserId),
        publishOptions: options.publishOptions,
      });
      return;
    case 'google_refresh_scheduled': {
      assertScheduledRefreshFence(job);
      const executor =
        options.executeScheduledGoogleUpdateRefresh ?? executeScheduledGoogleUpdateRefresh;
      await executor({ client, jobId: job.id, restaurantId: job.restaurantId, observedAt });
      return;
    }
    case 'google_refresh_manual':
      if (isPubSubCorrelatedRefresh(payload)) {
        assertScheduledRefreshFence(job);
        const executor =
          options.executeScheduledGoogleUpdateRefresh ?? executeScheduledGoogleUpdateRefresh;
        await executor({ client, jobId: job.id, restaurantId: job.restaurantId, observedAt });
        return;
      }
      await refreshFromGoogle({
        client,
        restaurantId: job.restaurantId,
        runKind: 'manual',
        skipPull: optionalBoolean(payload.skipPull) ?? false,
        ...options.refreshOptions,
      });
      return;
    case 'core_write_recompute':
    case 'mirror_refresh_after_publish':
      await refreshFromGoogle({
        client,
        restaurantId: job.restaurantId,
        runKind: refreshKindForJob(job.jobKind),
        skipPull: optionalBoolean(payload.skipPull) ?? job.jobKind === 'core_write_recompute',
        ...options.refreshOptions,
      });
      return;
    default: {
      const exhaustive: never = job.jobKind;
      throw new Error(`Unsupported dual-sync job kind: ${exhaustive}`);
    }
  }
}

function errorCodeFor(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { readonly code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) return code;
  }
  if (error instanceof Error && error.name === 'DualSyncRestaurantPausedError') {
    return DUAL_SYNC_RESTAURANT_PAUSED_CODE;
  }
  return 'DUAL_SYNC_JOB_FAILED';
}

export async function processNextDualSyncJob({
  client,
  workerId,
  now,
  options,
}: ProcessNextDualSyncJobInput): Promise<ProcessNextDualSyncJobResult> {
  const claimed = await claimNextDualSyncJob({ client, workerId, now });
  if (!claimed) {
    return { status: 'idle', job: null };
  }

  try {
    await executeDualSyncJob(client, claimed, options, now);
    const completed = await completeDualSyncJob({ client, jobId: claimed.id });
    return { status: 'succeeded', job: completed };
  } catch (error) {
    const errorCode = errorCodeFor(error);
    const errorMessage = errorCode;
    const retryAfterMs =
      options?.retryAfterMs?.({ job: claimed, errorCode, errorMessage }) ?? 60_000;
    const failed = await failDualSyncJob({
      client,
      jobId: claimed.id,
      attemptCount: claimed.attemptCount,
      maxAttempts:
        claimed.jobKind === 'publish_batch' ||
        payloadObject(claimed).confirmationVersion === EXACT_CONSENT_VERSION ||
        payloadObject(claimed).confirmation_version === EXACT_CONSENT_VERSION
          ? 1
          : claimed.maxAttempts,
      errorCode,
      errorMessage,
      retryAfterMs,
    });
    return {
      status: failed.status === 'dead_letter' ? 'dead_letter' : 'retrying',
      job: failed,
    };
  }
}
