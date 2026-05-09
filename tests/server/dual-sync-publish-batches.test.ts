import { describe, expect, it, vi } from 'vitest';

import {
  createOperationGroupsForPlan,
  createPublishBatch,
  findPublishBatchByClientRequest,
  updateOperationGroupStatus,
  updatePublishBatchStatus,
} from '@/server/dual-sync/publish/operations';

import type { DualSyncPublishGroup } from '@/server/dual-sync/publish/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    insert: fluent,
    update: fluent,
    select: fluent,
    eq: fluent,
    single: vi.fn(async () => ({ data: result, error: null })),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result, error: null })),
  });
  return chain as MockChain;
}

function makeBatchRow(over: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    client_request_id: 'request-1',
    actor_user_id: 'user-1',
    status: 'pending',
    decision_hash: 'decision-hash',
    pinned_core_snapshot_hash: 'core-pin',
    pinned_gbp_snapshot_hash: 'gbp-pin',
    core_snapshot_hash: 'core-current',
    gbp_snapshot_hash: 'gbp-current',
    accepted_count: 2,
    rejected_count: 1,
    ignored_count: 0,
    plan_summary: { groups: 1 },
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-05-09T00:00:00.000Z',
    updated_at: '2026-05-09T00:00:00.000Z',
    ...over,
  };
}

function makeGroupRow(over: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    restaurant_id: 'rest-1',
    publish_batch_id: 'batch-1',
    group_key: 'export_to_google:profile:location.profile',
    section_key: 'profile',
    direction: 'export_to_google',
    write_group: 'location.profile',
    status: 'pending',
    risk_level: 'critical',
    requires_preflight: true,
    requires_manual_confirmation: true,
    destructive_write_possible: true,
    google_update_masks: ['profile'],
    decision_count: 2,
    preflight_status: null,
    preflight_result: null,
    request_summary: null,
    response_summary: null,
    error_code: null,
    error_message: null,
    started_at: null,
    finished_at: null,
    created_at: '2026-05-09T00:00:00.000Z',
    updated_at: '2026-05-09T00:00:00.000Z',
    ...over,
  };
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

describe('dual-sync publish batch helpers', () => {
  it('creates a durable publish batch with idempotency metadata', async () => {
    const chain = makeChain(makeBatchRow());
    const client = clientFor(chain);

    const batch = await createPublishBatch({
      client,
      restaurantId: 'rest-1',
      clientRequestId: 'request-1',
      actorUserId: 'user-1',
      decisionHash: 'decision-hash',
      pinnedCoreSnapshotHash: 'core-pin',
      pinnedGbpSnapshotHash: 'gbp-pin',
      coreSnapshotHash: 'core-current',
      gbpSnapshotHash: 'gbp-current',
      acceptedCount: 2,
      rejectedCount: 1,
      ignoredCount: 0,
      planSummary: { groups: 1 },
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_batches');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        client_request_id: 'request-1',
        decision_hash: 'decision-hash',
        accepted_count: 2,
        rejected_count: 1,
      }),
    );
    expect(batch.id).toBe('batch-1');
    expect(batch.decisionHash).toBe('decision-hash');
  });

  it('finds an existing batch by client request id', async () => {
    const chain = makeChain(makeBatchRow());
    const client = clientFor(chain);

    const batch = await findPublishBatchByClientRequest({
      client,
      restaurantId: 'rest-1',
      clientRequestId: 'request-1',
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_batches');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.eq).toHaveBeenCalledWith('client_request_id', 'request-1');
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(batch?.id).toBe('batch-1');
  });

  it('creates operation groups from a publish plan', async () => {
    const chain = makeChain([makeGroupRow()]);
    const client = clientFor(chain);
    const groups: DualSyncPublishGroup[] = [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: true,
        googleUpdateMasks: ['profile'],
      },
    ];

    const out = await createOperationGroupsForPlan({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      groups,
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_operation_groups');
    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        publish_batch_id: 'batch-1',
        group_key: 'export_to_google:profile:location.profile',
        write_group: 'location.profile',
        requires_preflight: true,
      }),
    ]);
    expect(out[0]?.groupKey).toBe('export_to_google:profile:location.profile');
  });

  it('updates batch and group status rows', async () => {
    const batchChain = makeChain(makeBatchRow({ status: 'running' }));
    const batchClient = clientFor(batchChain);
    await updatePublishBatchStatus({
      client: batchClient,
      publishBatchId: 'batch-1',
      status: 'running',
      startedAt: '2026-05-09T00:01:00.000Z',
    });
    expect(batchChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        started_at: '2026-05-09T00:01:00.000Z',
      }),
    );

    const groupChain = makeChain(makeGroupRow({ status: 'failed' }));
    const groupClient = clientFor(groupChain);
    await updateOperationGroupStatus({
      client: groupClient,
      operationGroupId: 'group-1',
      status: 'failed',
      errorCode: 'PORT_FAILURE',
      errorMessage: 'Google rejected the payload',
    });
    expect(groupChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_code: 'PORT_FAILURE',
        error_message: 'Google rejected the payload',
      }),
    );
  });
});
