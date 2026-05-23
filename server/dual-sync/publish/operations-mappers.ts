import {
  type DualSyncPublishBatchRow,
  type DualSyncPublishOperationGroupRow,
  type DualSyncPublishOperationRow,
} from '../db';
import {
  type DualSyncGoogleUpdateMask,
  type DualSyncPublishBatch,
  type DualSyncPublishOperation,
  type DualSyncPublishOperationGroup,
  isDualSyncSectionKey,
} from '../types';

export function rowToBatch(row: DualSyncPublishBatchRow): DualSyncPublishBatch {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    clientRequestId: row.client_request_id,
    actorUserId: row.actor_user_id,
    status: row.status,
    decisionHash: row.decision_hash,
    pinnedCoreSnapshotHash: row.pinned_core_snapshot_hash,
    pinnedGbpSnapshotHash: row.pinned_gbp_snapshot_hash,
    coreSnapshotHash: row.core_snapshot_hash,
    gbpSnapshotHash: row.gbp_snapshot_hash,
    fieldPolicyVersionId: row.field_policy_version_id,
    fieldPolicyHash: row.field_policy_hash,
    acceptedCount: row.accepted_count,
    rejectedCount: row.rejected_count,
    ignoredCount: row.ignored_count,
    planSummary: row.plan_summary ?? {},
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToOperationGroup(
  row: DualSyncPublishOperationGroupRow,
): DualSyncPublishOperationGroup {
  if (!isDualSyncSectionKey(row.section_key)) {
    throw new Error(
      `dual_sync_publish_operation_groups: unexpected section_key ${row.section_key}`,
    );
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    publishBatchId: row.publish_batch_id,
    groupKey: row.group_key,
    sectionKey: row.section_key,
    direction: row.direction,
    writeGroup: row.write_group,
    status: row.status,
    riskLevel: row.risk_level,
    requiresPreflight: row.requires_preflight,
    requiresManualConfirmation: row.requires_manual_confirmation,
    destructiveWritePossible: row.destructive_write_possible,
    googleUpdateMasks: row.google_update_masks as DualSyncGoogleUpdateMask[],
    decisionCount: row.decision_count,
    preflightStatus: row.preflight_status,
    preflightResult: row.preflight_result ?? null,
    requestSummary: row.request_summary ?? null,
    responseSummary: row.response_summary ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToOperation(row: DualSyncPublishOperationRow): DualSyncPublishOperation {
  if (!isDualSyncSectionKey(row.section_key)) {
    throw new Error(`dual_sync_publish_operations: unexpected section_key ${row.section_key}`);
  }
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    publishJobId: row.publish_job_id,
    publishBatchId: row.publish_batch_id ?? null,
    operationGroupId: row.operation_group_id ?? null,
    sectionKey: row.section_key,
    fieldKey: row.field_key,
    direction: row.direction,
    status: row.status,
    attemptCount: row.attempt_count,
    beforeCoreHash: row.before_core_hash,
    beforeGbpHash: row.before_gbp_hash,
    afterCoreHash: row.after_core_hash,
    afterGbpHash: row.after_gbp_hash,
    googleUpdateMask: (row.google_update_mask as DualSyncGoogleUpdateMask | null) ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    externalResponse: row.external_response ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
