/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Persistence layer for preflight + publish job rows. The publish job is the
 * frozen contract: every field captured here is re-validated at publish
 * time to enforce the contract lock.
 */


import { getSyncV2DbClient, type SyncV2PublishJobRow } from '../db';
import { isSyncV2DirectionIntent } from '../types';

import type {
  SyncV2DirectionIntent,
  SyncV2FrozenDecision,
  SyncV2GoogleUpdateMask,
  SyncV2PreflightResult,
  SyncV2PublishJob,
  SyncV2PublishJobStatus,
} from '../types';
import type { Json } from '@/types/supabase';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function rowToPublishJob(row: SyncV2PublishJobRow): SyncV2PublishJob {
  if (!isSyncV2DirectionIntent(row.direction_intent)) {
    throw new Error(
      `gbp_sync_v2_publish_jobs row ${row.id} has unknown direction_intent=${row.direction_intent}`,
    );
  }
  const frozenDecisions = Array.isArray(row.frozen_decisions)
    ? (row.frozen_decisions as unknown as ReadonlyArray<SyncV2FrozenDecision>)
    : [];
  const preflightResult =
    row.preflight_result &&
    typeof row.preflight_result === 'object' &&
    !Array.isArray(row.preflight_result)
      ? (row.preflight_result as unknown as SyncV2PreflightResult)
      : null;
  return {
    id: row.id,
    workflowId: row.workflow_id,
    draftId: row.draft_id,
    restaurantId: row.restaurant_id,
    directionIntent: row.direction_intent,
    publishPlanId: row.publish_plan_id,
    idempotencyKey: row.idempotency_key,
    frozenDecisions,
    frozenDecisionsHash: row.frozen_decisions_hash,
    frozenNabatableSnapshotHash: row.frozen_nabatable_snapshot_hash,
    frozenGoogleSnapshotHash: row.frozen_google_snapshot_hash,
    preflightResult,
    googleUpdateMasks: row.google_update_masks as ReadonlyArray<SyncV2GoogleUpdateMask>,
    status: row.status,
    errorClassification: row.error_classification,
    errors: (Array.isArray(row.errors) ? row.errors : []) as unknown as ReadonlyArray<
      SyncV2PublishJob['errors'][number]
    >,
    nabatableEventId: row.nabatable_event_id,
    googleEventId: row.google_event_id,
    rollbackEventId: row.rollback_event_id,
    preflightedAt: row.preflighted_at,
    publishedAt: row.published_at,
    failedAt: row.failed_at,
    retriedAt: row.retried_at,
    createdByUserId: row.created_by_user_id,
    publishedByUserId: row.published_by_user_id,
    retriedByUserId: row.retried_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PersistPreflightInput {
  readonly client: SupabaseClient<Database>;
  readonly workflowId: string;
  readonly draftId: string;
  readonly restaurantId: string;
  readonly directionIntent: SyncV2DirectionIntent;
  readonly idempotencyKey: string;
  readonly preflightResult: SyncV2PreflightResult;
  readonly frozenDecisions: ReadonlyArray<SyncV2FrozenDecision>;
  readonly createdByUserId: string | null;
}

export async function persistPreflight({
  client,
  workflowId,
  draftId,
  restaurantId,
  directionIntent,
  idempotencyKey,
  preflightResult,
  frozenDecisions,
  createdByUserId,
}: PersistPreflightInput): Promise<SyncV2PublishJob> {
  const v2 = getSyncV2DbClient(client);
  const insert: Partial<SyncV2PublishJobRow> = {
    workflow_id: workflowId,
    draft_id: draftId,
    restaurant_id: restaurantId,
    direction_intent: directionIntent,
    idempotency_key: idempotencyKey,
    frozen_decisions: frozenDecisions as unknown as Json,
    frozen_decisions_hash: preflightResult.frozenDecisionsHash,
    frozen_nabatable_snapshot_hash: preflightResult.frozenNabatableSnapshotHash,
    frozen_google_snapshot_hash: preflightResult.frozenGoogleSnapshotHash,
    preflight_result: preflightResult as unknown as Json,
    google_update_masks: [...preflightResult.googleUpdateMasks],
    status: 'preflight_locked',
    created_by_user_id: createdByUserId,
  };
  // upsert on idempotency_key to preserve V2's idempotency contract on
  // re-preflight attempts.
  const { data, error } = await v2
    .from('gbp_sync_v2_publish_jobs')
    .upsert(insert as never, { onConflict: 'idempotency_key' })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`Failed to persist V2 preflight job: ${error?.message ?? 'no row returned'}`);
  }
  return rowToPublishJob(data);
}

export async function getPublishJob({
  client,
  jobId,
}: {
  readonly client: SupabaseClient<Database>;
  readonly jobId: string;
}): Promise<SyncV2PublishJob | null> {
  const v2 = getSyncV2DbClient(client);
  const { data, error } = await v2
    .from('gbp_sync_v2_publish_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read V2 publish job ${jobId}: ${error.message}`);
  }
  return data ? rowToPublishJob(data) : null;
}

export async function setPublishJobStatus({
  client,
  jobId,
  status,
  patch,
}: {
  readonly client: SupabaseClient<Database>;
  readonly jobId: string;
  readonly status: SyncV2PublishJobStatus;
  readonly patch?: Partial<SyncV2PublishJobRow>;
}): Promise<void> {
  const v2 = getSyncV2DbClient(client);
  const { error } = await v2
    .from('gbp_sync_v2_publish_jobs')
    .update({ status, ...(patch ?? {}) } as never)
    .eq('id', jobId);
  if (error) {
    throw new Error(`Failed to update V2 publish job ${jobId} status: ${error.message}`);
  }
}
