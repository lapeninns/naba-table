import { getDualSyncDbClient, type DualSyncPublishOperationGroupRow } from '../db';
import {
  type DualSyncPublishOperationGroup,
  type DualSyncPublishOperationGroupStatus,
} from '../types';
import { sanitizeGoogleAuditPayload } from './google-audit';
import { rowToOperationGroup } from './operations-mappers';

import type { DualSyncPublishGroup } from './types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface CreateOperationGroupsForPlanInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchId: string;
  readonly groups: ReadonlyArray<DualSyncPublishGroup>;
}

export async function createOperationGroupsForPlan(
  input: CreateOperationGroupsForPlanInput,
): Promise<ReadonlyArray<DualSyncPublishOperationGroup>> {
  if (input.groups.length === 0) return [];
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .insert(
      input.groups.map((group) => ({
        restaurant_id: input.restaurantId,
        publish_batch_id: input.publishBatchId,
        group_key: group.groupId,
        section_key: group.sectionKey,
        direction: group.direction,
        write_group: group.writeGroup,
        status: 'pending' satisfies DualSyncPublishOperationGroupStatus,
        risk_level: group.riskLevel,
        requires_preflight: group.requiresPreflight,
        requires_manual_confirmation: group.requiresManualConfirmation,
        destructive_write_possible: group.destructiveWritePossible,
        google_update_masks: [...group.googleUpdateMasks],
        decision_count: group.fields.length,
      })) as never,
    )
    .select('*');
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperationGroup);
}

export interface UpdateOperationGroupStatusInput {
  readonly client: DbClient;
  readonly operationGroupId: string;
  readonly status: DualSyncPublishOperationGroupStatus;
  readonly preflightStatus?: string | null;
  readonly preflightResult?: unknown;
  readonly requestSummary?: unknown;
  readonly responseSummary?: unknown;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export async function updateOperationGroupStatus(
  input: UpdateOperationGroupStatusInput,
): Promise<DualSyncPublishOperationGroup> {
  const dual = getDualSyncDbClient(input.client);
  const patch: Partial<DualSyncPublishOperationGroupRow> = {
    status: input.status,
  };
  if (input.preflightStatus !== undefined) patch.preflight_status = input.preflightStatus;
  if (input.preflightResult !== undefined)
    patch.preflight_result = sanitizeGoogleAuditPayload(input.preflightResult) as Json;
  if (input.requestSummary !== undefined)
    patch.request_summary = sanitizeGoogleAuditPayload(input.requestSummary) as Json;
  if (input.responseSummary !== undefined)
    patch.response_summary = sanitizeGoogleAuditPayload(input.responseSummary) as Json;
  if (input.errorCode !== undefined) patch.error_code = input.errorCode;
  if (input.errorMessage !== undefined) patch.error_message = input.errorMessage;
  if (input.startedAt !== undefined) patch.started_at = input.startedAt;
  if (input.finishedAt !== undefined) patch.finished_at = input.finishedAt;

  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .update(patch as never)
    .eq('id', input.operationGroupId)
    .select('*')
    .single<DualSyncPublishOperationGroupRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(
      `dual_sync_publish_operation_groups update failed for ${input.operationGroupId}`,
    );
  }
  return rowToOperationGroup(data);
}

export interface ListOperationGroupsByBatchIdsInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchIds: ReadonlyArray<string>;
}

export async function listOperationGroupsByBatchIds(
  input: ListOperationGroupsByBatchIdsInput,
): Promise<ReadonlyArray<DualSyncPublishOperationGroup>> {
  const ids = Array.from(new Set(input.publishBatchIds.filter((id) => id.length > 0)));
  if (ids.length === 0) return [];
  const dual = getDualSyncDbClient(input.client);
  const { data, error } = await dual
    .from('dual_sync_publish_operation_groups')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .in('publish_batch_id', ids)
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToOperationGroup);
}
