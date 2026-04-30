import { describe, expect, it, vi } from 'vitest';

import { getPublishJobDetailForRestaurant } from '@/server/dual-sync/publish/operations';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function makeChain(rows: unknown[]): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    select: fluent,
    eq: fluent,
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

describe('getPublishJobDetailForRestaurant', () => {
  it('returns null when no operations exist for the job', async () => {
    const chain = makeChain([]);
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
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
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
    const out = await getPublishJobDetailForRestaurant({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'job-1',
    });
    expect(out).toBeNull();
  });

  it('returns rollup + operations for a valid restaurant-scoped job', async () => {
    const chain = makeChain([
      makeRow({ id: 'op-1', status: 'succeeded' }),
      makeRow({
        id: 'op-2',
        status: 'failed',
        error_code: 'PORT_FAILURE',
        section_key: 'operatingHours',
        field_key: 'operatingHours.MONDAY',
      }),
    ]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    const out = await getPublishJobDetailForRestaurant({
      client,
      restaurantId: 'rest-1',
      publishJobId: 'job-1',
    });
    expect(fromMock).toHaveBeenCalledWith('dual_sync_publish_operations');
    expect(chain.eq).toHaveBeenCalledWith('publish_job_id', 'job-1');
    expect(out).not.toBeNull();
    expect(out?.operations).toHaveLength(2);
    expect(out?.rollup.totalOperations).toBe(2);
    expect(out?.rollup.succeededCount).toBe(1);
    expect(out?.rollup.failedCount).toBe(1);
    expect(out?.rollup.errorCodes).toEqual(['PORT_FAILURE']);
    expect(out?.rollup.publishJobId).toBe('job-1');
    expect(out?.rollup.sections).toEqual(
      expect.arrayContaining(['profile', 'operatingHours']),
    );
  });
});
