import { describe, expect, it } from 'vitest';

import {
  rowToBatch,
  rowToOperation,
  rowToOperationGroup,
} from '@/server/dual-sync/publish/operations-mappers';

import type {
  DualSyncPublishBatchRow,
  DualSyncPublishOperationGroupRow,
  DualSyncPublishOperationRow,
} from '@/server/dual-sync/db';

function batchRow(overrides: Partial<DualSyncPublishBatchRow> = {}): DualSyncPublishBatchRow {
  return {
    id: 'batch-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    client_request_id: 'client-1',
    actor_user_id: 'user-1',
    status: 'pending',
    decision_hash: 'decision-hash',
    pinned_core_snapshot_hash: 'pinned-core',
    pinned_gbp_snapshot_hash: null,
    core_snapshot_hash: 'core-snapshot',
    gbp_snapshot_hash: 'gbp-snapshot',
    field_policy_version_id: 'policy-version-1',
    field_policy_hash: 'policy-hash',
    accepted_count: 2,
    rejected_count: 1,
    ignored_count: 0,
    plan_summary: { warnings: [] },
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-05-22T08:00:00.000Z',
    updated_at: '2026-05-22T08:00:01.000Z',
    ...overrides,
  };
}

function groupRow(
  overrides: Partial<DualSyncPublishOperationGroupRow> = {},
): DualSyncPublishOperationGroupRow {
  return {
    id: 'group-1',
    restaurant_id: 'rest-1',
    publish_batch_id: 'batch-1',
    group_key: 'export_to_google:profile:location.profile',
    section_key: 'profile',
    direction: 'export_to_google',
    write_group: 'location.profile',
    status: 'pending',
    risk_level: 'medium',
    requires_preflight: true,
    requires_manual_confirmation: false,
    destructive_write_possible: false,
    google_update_masks: ['profile.description'],
    decision_count: 2,
    preflight_status: null,
    preflight_result: null,
    request_summary: null,
    response_summary: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-05-22T08:00:00.000Z',
    updated_at: '2026-05-22T08:00:01.000Z',
    ...overrides,
  };
}

function operationRow(
  overrides: Partial<DualSyncPublishOperationRow> = {},
): DualSyncPublishOperationRow {
  return {
    id: 'op-1',
    restaurant_id: 'rest-1',
    publish_job_id: 'batch-1',
    publish_batch_id: 'batch-1',
    operation_group_id: 'group-1',
    section_key: 'profile',
    field_key: 'profile.businessDescription',
    direction: 'export_to_google',
    status: 'succeeded',
    attempt_count: 1,
    before_core_hash: 'core-before',
    before_gbp_hash: 'gbp-before',
    after_core_hash: 'core-after',
    after_gbp_hash: 'gbp-after',
    google_update_mask: 'profile.description',
    error_code: null,
    error_message: null,
    external_response: { ok: true },
    started_at: '2026-05-22T08:00:00.000Z',
    finished_at: '2026-05-22T08:00:01.000Z',
    created_at: '2026-05-22T08:00:00.000Z',
    updated_at: '2026-05-22T08:00:01.000Z',
    ...overrides,
  };
}

describe('dual-sync publish operation mappers', () => {
  it('maps publish batch rows and defaults missing plan summaries to an empty object', () => {
    expect(rowToBatch(batchRow({ plan_summary: null }))).toEqual({
      id: 'batch-1',
      restaurantId: 'rest-1',
      provider: 'google_business_profile',
      clientRequestId: 'client-1',
      actorUserId: 'user-1',
      status: 'pending',
      decisionHash: 'decision-hash',
      pinnedCoreSnapshotHash: 'pinned-core',
      pinnedGbpSnapshotHash: null,
      coreSnapshotHash: 'core-snapshot',
      gbpSnapshotHash: 'gbp-snapshot',
      fieldPolicyVersionId: 'policy-version-1',
      fieldPolicyHash: 'policy-hash',
      acceptedCount: 2,
      rejectedCount: 1,
      ignoredCount: 0,
      planSummary: {
        sha256: expect.any(String),
        shape: { kind: 'object', fieldCount: 0 },
      },
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-05-22T08:00:00.000Z',
      updatedAt: '2026-05-22T08:00:01.000Z',
    });
  });

  it('preserves an already metadata-only hash without hashing the envelope again', () => {
    const summary = {
      sha256: 'a'.repeat(64),
      shape: { kind: 'object', fieldCount: 2 },
    };

    expect(rowToBatch(batchRow({ plan_summary: summary })).planSummary).toEqual(summary);
  });

  it('maps operation group rows and preserves nullable audit summaries', () => {
    expect(
      rowToOperationGroup(
        groupRow({
          preflight_result: { validateOnly: true },
          request_summary: { fieldKeys: ['profile.businessDescription'] },
          response_summary: { status: 'passed' },
        }),
      ),
    ).toMatchObject({
      id: 'group-1',
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      groupKey: 'export_to_google:profile:location.profile',
      sectionKey: 'profile',
      direction: 'export_to_google',
      writeGroup: 'location.profile',
      googleUpdateMasks: ['profile.description'],
      decisionCount: 2,
      preflightResult: {
        sha256: expect.any(String),
        shape: { kind: 'object', fieldCount: 1 },
      },
      requestSummary: {
        sha256: expect.any(String),
        shape: { kind: 'object', fieldCount: 1 },
      },
      responseSummary: {
        sha256: expect.any(String),
        shape: { kind: 'object', fieldCount: 1 },
      },
    });
  });

  it('maps operation rows and normalizes nullable IDs and external responses', () => {
    expect(
      rowToOperation(
        operationRow({
          publish_batch_id: null,
          operation_group_id: null,
          google_update_mask: null,
          external_response: null,
        }),
      ),
    ).toMatchObject({
      id: 'op-1',
      restaurantId: 'rest-1',
      publishJobId: 'batch-1',
      publishBatchId: null,
      operationGroupId: null,
      sectionKey: 'profile',
      fieldKey: 'profile.businessDescription',
      direction: 'export_to_google',
      status: 'succeeded',
      googleUpdateMask: null,
      externalResponse: null,
    });
  });

  it('rejects unexpected section keys for operation groups and operations', () => {
    expect(() => rowToOperationGroup(groupRow({ section_key: 'not-a-section' }))).toThrow(
      'dual_sync_publish_operation_groups: unexpected section_key not-a-section',
    );
    expect(() => rowToOperation(operationRow({ section_key: 'not-a-section' }))).toThrow(
      'dual_sync_publish_operations: unexpected section_key not-a-section',
    );
  });
});
