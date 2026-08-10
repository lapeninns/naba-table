/**
 * Durable job queue helpers for unified dual-sync.
 *
 * This module owns the queue row lifecycle only. Workers can build on it
 * to execute refresh, publish, auto-export, mirror-refresh, and
 * core-write recompute jobs without inventing per-route retry semantics.
 */

import { z } from 'zod';

import { getDualSyncDbClient, type DualSyncJobRow } from '../db';
import { hashCanonicalJson } from '../hashing';
import {
  databaseGoogleWriteQueueEnvelopeSchema,
  googleWriteQueueEnvelopeSchema,
} from '../publish/exact-consent';
import { safePersistenceErrorCode } from '../publish/persistence-metadata';

import type { DualSyncJob, DualSyncJobKind, DualSyncJobStatus } from '../types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const nullableId = z.string().min(1).nullable().optional();
const publishDecisionSchema = z
  .object({
    fieldKey: z.string().min(1),
    sectionKey: z.string().min(1),
    action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
    pinnedCoreHash: z.string().nullable(),
    pinnedGbpHash: z.string().nullable(),
  })
  .strict();
const publishPayloadSchema = z
  .object({
    decisions: z.array(publishDecisionSchema).optional(),
    actorUserId: nullableId,
    clientRequestId: nullableId,
    publishBatchId: nullableId,
    pinnedCoreSnapshotHash: nullableId,
    pinnedGbpSnapshotHash: nullableId,
  })
  .strict();
const refreshPayloadSchema = z
  .object({
    actorUserId: nullableId,
    skipPull: z.boolean().optional(),
    eventId: z.string().min(1).optional(),
    sourceReceiptSubscription: z.string().min(1).optional(),
    sourceReceiptMessageId: z.string().min(1).optional(),
  })
  .strict();
const autoExportPayloadSchema = z
  .object({ actorUserId: nullableId, maxCandidates: z.number().int().positive().optional() })
  .strict();

function parseJobPayload(jobKind: DualSyncJobKind, value: unknown): Json {
  const payload = value ?? {};
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if ('confirmation_version' in payload) {
      return databaseGoogleWriteQueueEnvelopeSchema.parse(payload) as Json;
    }
    if ('confirmationVersion' in payload) {
      return googleWriteQueueEnvelopeSchema.parse(payload) as Json;
    }
  }
  switch (jobKind) {
    case 'publish_batch':
      return publishPayloadSchema.parse(payload) as Json;
    case 'auto_export':
      return autoExportPayloadSchema.parse(payload) as Json;
    case 'google_refresh_manual':
    case 'google_refresh_scheduled':
    case 'core_write_recompute':
    case 'mirror_refresh_after_publish':
      return refreshPayloadSchema.parse(payload) as Json;
  }
}

function rowToJob(row: DualSyncJobRow): DualSyncJob {
  const safeErrorCode = safePersistenceErrorCode(row.last_error_code);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    jobKind: row.job_kind,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    priority: row.priority,
    externalProfileId: row.external_profile_id,
    externalAccountId: row.external_account_id,
    externalLocationId: row.external_location_id,
    connectionGeneration: row.connection_generation,
    consentEpoch: row.consent_epoch,
    payload: parseJobPayload(row.job_kind, row.payload ?? {}),
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    availableAt: row.available_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    lastErrorCode: safeErrorCode,
    lastErrorMessage: null,
    deadLetterReason: row.dead_letter_reason === null ? null : safeErrorCode,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueDualSyncJobInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly jobKind: DualSyncJobKind;
  readonly idempotencyKey?: string | null;
  readonly payload?: unknown;
  readonly priority?: number;
  readonly maxAttempts?: number;
  readonly availableAt?: string;
}

export async function enqueueDualSyncJob(input: EnqueueDualSyncJobInput): Promise<DualSyncJob> {
  const dual = getDualSyncDbClient(input.client);
  const payload = parseJobPayload(input.jobKind, input.payload);
  const exactGoogleWrite =
    input.payload !== null &&
    typeof input.payload === 'object' &&
    !Array.isArray(input.payload) &&
    ('confirmationVersion' in input.payload || 'confirmation_version' in input.payload);
  const insert = {
    restaurant_id: input.restaurantId,
    job_kind: input.jobKind,
    status: 'queued' satisfies DualSyncJobStatus,
    idempotency_key: input.idempotencyKey ?? null,
    payload,
    priority: input.priority ?? 100,
    max_attempts:
      input.jobKind === 'publish_batch' || exactGoogleWrite ? 1 : (input.maxAttempts ?? 3),
    available_at: input.availableAt ?? new Date().toISOString(),
  };

  const query = input.idempotencyKey
    ? dual.from('dual_sync_jobs').upsert(insert as never, {
        onConflict: 'restaurant_id,provider,job_kind,idempotency_key',
        ignoreDuplicates: true,
      })
    : dual.from('dual_sync_jobs').insert(insert as never);
  const { data, error } = await query.select('*').maybeSingle<DualSyncJobRow>();
  if (error) {
    throw error;
  }
  if (data) {
    return rowToJob(data);
  }
  if (input.idempotencyKey) {
    const { data: existing, error: existingError } = await dual
      .from('dual_sync_jobs')
      .select('*')
      .eq('restaurant_id', input.restaurantId)
      .eq('provider', 'google_business_profile')
      .eq('job_kind', input.jobKind)
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle<DualSyncJobRow>();
    if (existingError) {
      throw existingError;
    }
    if (existing) {
      if (hashCanonicalJson(existing.payload ?? {}) !== hashCanonicalJson(payload)) {
        throw new Error('Dual-sync idempotency key was already used with a different payload.');
      }
      return rowToJob(existing);
    }
  }
  throw new Error('dual_sync_jobs enqueue returned no row');
}

export interface ClaimNextDualSyncJobInput {
  readonly client: DbClient;
  readonly workerId: string;
  readonly now?: string;
  readonly staleRunningAfterMs?: number;
}

const DEFAULT_RUNNING_STALE_AFTER_MS = 15 * 60 * 1000;

export async function claimNextDualSyncJob({
  client,
  workerId,
  now = new Date().toISOString(),
  staleRunningAfterMs = DEFAULT_RUNNING_STALE_AFTER_MS,
}: ClaimNextDualSyncJobInput): Promise<DualSyncJob | null> {
  const dual = getDualSyncDbClient(client);
  const staleBefore = new Date(new Date(now).getTime() - staleRunningAfterMs).toISOString();
  const { error: staleError } = await dual
    .from('dual_sync_jobs')
    .update({
      status: 'retrying' satisfies DualSyncJobStatus,
      available_at: now,
      locked_at: null,
      locked_by: null,
      last_error_code: 'DUAL_SYNC_JOB_STALE_CLAIM',
      last_error_message: null,
    } as never)
    .eq('status', 'running')
    .is('write_bundle_id', null)
    .lte('locked_at', staleBefore);
  if (staleError) {
    throw staleError;
  }

  const { data: candidates, error: readError } = await dual
    .from('dual_sync_jobs')
    .select('*')
    .in('status', ['queued', 'retrying'])
    .lte('available_at', now)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);
  if (readError) {
    throw readError;
  }
  const candidate = candidates?.[0] as DualSyncJobRow | undefined;
  if (!candidate) return null;

  const { data, error } = await dual
    .from('dual_sync_jobs')
    .update({
      status: 'running' satisfies DualSyncJobStatus,
      attempt_count: candidate.attempt_count + 1,
      locked_at: now,
      locked_by: workerId,
      started_at: candidate.started_at ?? now,
      last_error_code: null,
      last_error_message: null,
    } as never)
    .eq('id', candidate.id)
    .in('status', ['queued', 'retrying'])
    .select('*')
    .maybeSingle<DualSyncJobRow>();
  if (error) {
    throw error;
  }
  return data ? rowToJob(data) : null;
}

export interface CompleteDualSyncJobInput {
  readonly client: DbClient;
  readonly jobId: string;
  readonly finishedAt?: string;
}

export async function completeDualSyncJob({
  client,
  jobId,
  finishedAt = new Date().toISOString(),
}: CompleteDualSyncJobInput): Promise<DualSyncJob> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_jobs')
    .update({
      status: 'succeeded' satisfies DualSyncJobStatus,
      locked_at: null,
      locked_by: null,
      finished_at: finishedAt,
    } as never)
    .eq('id', jobId)
    .select('*')
    .single<DualSyncJobRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_jobs complete failed for ${jobId}`);
  }
  return rowToJob(data);
}

export interface FailDualSyncJobInput {
  readonly client: DbClient;
  readonly jobId: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly retryAfterMs?: number;
  readonly now?: string;
}

export async function failDualSyncJob(input: FailDualSyncJobInput): Promise<DualSyncJob> {
  const dual = getDualSyncDbClient(input.client);
  const now = input.now ?? new Date().toISOString();
  const exhausted = input.attemptCount >= input.maxAttempts;
  const retryAt = new Date(new Date(now).getTime() + (input.retryAfterMs ?? 60_000)).toISOString();
  const safeErrorCode = safePersistenceErrorCode(input.errorCode) ?? 'DUAL_SYNC_JOB_FAILED';
  const { data, error } = await dual
    .from('dual_sync_jobs')
    .update({
      status: (exhausted ? 'dead_letter' : 'retrying') satisfies DualSyncJobStatus,
      available_at: exhausted ? now : retryAt,
      locked_at: null,
      locked_by: null,
      last_error_code: safeErrorCode,
      last_error_message: null,
      dead_letter_reason: exhausted ? safeErrorCode : null,
      finished_at: exhausted ? now : null,
    } as never)
    .eq('id', input.jobId)
    .select('*')
    .single<DualSyncJobRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_jobs fail failed for ${input.jobId}`);
  }
  return rowToJob(data);
}

export interface ListRecentDualSyncJobsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly limit?: number;
  readonly statuses?: ReadonlyArray<DualSyncJobStatus>;
}

export async function listRecentDualSyncJobs(
  input: ListRecentDualSyncJobsInput,
): Promise<ReadonlyArray<DualSyncJob>> {
  const dual = getDualSyncDbClient(input.client);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  let query = dual
    .from('dual_sync_jobs')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (input.statuses && input.statuses.length > 0) {
    query = query.in('status', input.statuses);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToJob);
}

export interface RetryDualSyncJobInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly jobId: string;
  readonly availableAt?: string;
  /**
   * Defaults to true because retrying a dead-letter job should grant a
   * fresh attempt budget after an operator has reviewed the failure.
   */
  readonly resetAttempts?: boolean;
}

export async function retryDualSyncJob(input: RetryDualSyncJobInput): Promise<DualSyncJob | null> {
  const dual = getDualSyncDbClient(input.client);
  const patch: Partial<DualSyncJobRow> = {
    status: 'queued',
    available_at: input.availableAt ?? new Date().toISOString(),
    locked_at: null,
    locked_by: null,
    last_error_code: null,
    last_error_message: null,
    dead_letter_reason: null,
    finished_at: null,
  };
  if (input.resetAttempts ?? true) {
    patch.attempt_count = 0;
    patch.started_at = null;
  }

  const { data, error } = await dual
    .from('dual_sync_jobs')
    .update(patch as never)
    .eq('id', input.jobId)
    .eq('restaurant_id', input.restaurantId)
    .in('status', ['failed', 'dead_letter', 'cancelled'])
    .is('write_bundle_id', null)
    .select('*')
    .maybeSingle<DualSyncJobRow>();
  if (error) {
    throw error;
  }
  return data ? rowToJob(data) : null;
}
