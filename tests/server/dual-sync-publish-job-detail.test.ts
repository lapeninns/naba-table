import { describe, expect, it, vi } from 'vitest';

import { getPublishJobDetailForRestaurant } from '@/server/dual-sync/publish/operations';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function makeChain(rows: unknown[]): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    select: fluent,
    eq: fluent,
    in: fluent,
    order: fluent,
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null })),
  });
  return chain as MockChain;
}

function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    restaurant_id: 'rest-1',
    publish_job_id: 'job-1',
    publish_batch_id: null,
    operation_group_id: null,
    section_key: 'profile',
    field_key: 'profile.name',
    direction: 'export_to_google',
    status: 'succeeded',
    attempt_count: 1,
    before_core_hash: null,
    before_gbp_hash: null,
    after_core_hash: 'h-1',
    after_gbp_hash: 'h-1',
    google_update_mask: null,
    error_code: null,
    error_message: null,
    external_response: null,
    started_at: '2026-04-29T00:00:00.000Z',
    finished_at: '2026-04-29T00:00:01.500Z',
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:01.500Z',
    ...over,
  };
}

function makeBatchRow(over: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    client_request_id: 'request-1',
    actor_user_id: 'user-1',
    status: 'succeeded',
    decision_hash: 'decision-hash',
    pinned_core_snapshot_hash: 'core-pin',
    pinned_gbp_snapshot_hash: 'gbp-pin',
    core_snapshot_hash: 'core-current',
    gbp_snapshot_hash: 'gbp-current',
    field_policy_version_id: 'policy-version-1',
    field_policy_hash: 'policy-hash-1',
    accepted_count: 2,
    rejected_count: 0,
    ignored_count: 0,
    plan_summary: { groups: 1 },
    error_code: null,
    error_message: null,
    started_at: '2026-04-29T00:00:00.000Z',
    finished_at: '2026-04-29T00:00:01.500Z',
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:01.500Z',
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
    status: 'succeeded',
    risk_level: 'medium',
    requires_preflight: true,
    requires_manual_confirmation: false,
    destructive_write_possible: false,
    google_update_masks: ['profile'],
    decision_count: 2,
    preflight_status: 'passed',
    preflight_result: { providerValidateOnly: 'supported' },
    request_summary: null,
    response_summary: null,
    error_code: null,
    error_message: null,
    started_at: '2026-04-29T00:00:00.000Z',
    finished_at: '2026-04-29T00:00:01.500Z',
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:01.500Z',
    ...over,
  };
}

function clientByTable(chains: Record<string, MockChain>) {
  return {
    from: vi.fn((table: string) => {
      const chain = chains[table];
      if (!chain) throw new Error(`Unexpected table ${table}`);
      return chain;
    }),
  } as unknown as SupabaseClient<Database>;
}

describe('getPublishJobDetailForRestaurant', () => {
  it('returns null when no operations exist for the job', async () => {
    const chain = makeChain([]);
    const client = clientByTable({ dual_sync_publish_operations: chain });
    const out = await getPublishJobDetailForRestaurant({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'job-missing',
    });
    expect(out).toBeNull();
  });

  it('returns null when any operation belongs to a different restaurant (defence in depth)', async () => {
    const chain = makeChain([
      makeRow({ id: 'op-1', restaurant_id: 'rest-1' }),
      makeRow({ id: 'op-2', restaurant_id: 'rest-other' }),
    ]);
    const client = clientByTable({ dual_sync_publish_operations: chain });
    const out = await getPublishJobDetailForRestaurant({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'job-1',
    });
    expect(out).toBeNull();
  });

  it('returns rollup + operations for a valid restaurant-scoped job', async () => {
    const operationsChain = makeChain([
      makeRow({
        id: 'op-1',
        status: 'succeeded',
        publish_batch_id: 'batch-1',
        operation_group_id: 'group-1',
      }),
      makeRow({
        id: 'op-2',
        status: 'failed',
        error_code: 'PORT_FAILURE',
        section_key: 'operatingHours',
        field_key: 'operatingHours.MONDAY',
        publish_batch_id: 'batch-1',
        operation_group_id: 'group-1',
      }),
    ]);
    const batchChain = makeChain([makeBatchRow()]);
    const groupChain = makeChain([makeGroupRow()]);
    const client = clientByTable({
      dual_sync_publish_operations: operationsChain,
      dual_sync_publish_batches: batchChain,
      dual_sync_publish_operation_groups: groupChain,
    });
    const out = await getPublishJobDetailForRestaurant({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'job-1',
    });
    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_operations');
    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_batches');
    expect(client.from).toHaveBeenCalledWith('dual_sync_publish_operation_groups');
    expect(operationsChain.eq).toHaveBeenCalledWith('publish_job_id', 'job-1');
    expect(batchChain.in).toHaveBeenCalledWith('id', ['batch-1']);
    expect(groupChain.in).toHaveBeenCalledWith('publish_batch_id', ['batch-1']);
    expect(out).not.toBeNull();
    expect(out?.batch?.id).toBe('batch-1');
    expect(out?.operationGroups).toHaveLength(1);
    expect(out?.operationGroups[0]?.writeGroup).toBe('location.profile');
    expect(out?.operations).toHaveLength(2);
    expect(out?.rollup.totalOperations).toBe(2);
    expect(out?.rollup.succeededCount).toBe(1);
    expect(out?.rollup.failedCount).toBe(1);
    expect(out?.rollup.errorCodes).toEqual(['PORT_FAILURE']);
    expect(out?.rollup.publishJobId).toBe('job-1');
    expect(out?.rollup.sections).toEqual(expect.arrayContaining(['profile', 'operatingHours']));
  });
});
