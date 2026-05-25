import { describe, expect, it, vi } from 'vitest';

import { listRecentOperationsForRestaurant } from '@/server/dual-sync/publish/operations-rows';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly select: ReturnType<typeof vi.fn>;
  readonly eq: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly gte: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => unknown;
}

function makeChain(rows: unknown[]): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    select: fluent,
    eq: fluent,
    in: fluent,
    gte: fluent,
    order: fluent,
    limit: fluent,
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

describe('listRecentOperationsForRestaurant', () => {
  it('returns a normalised list ordered newest-first with the default 50-row cap', async () => {
    const chain = makeChain([makeRow(), makeRow({ id: 'op-2' })]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;

    const out = await listRecentOperationsForRestaurant({
      client,
      restaurantId: 'rest-1',
    });

    expect(fromMock).toHaveBeenCalledWith('dual_sync_publish_operations');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(out).toHaveLength(2);
    expect(out[0]?.fieldKey).toBe('profile.name');
    expect(out[0]?.direction).toBe('export_to_google');
  });

  it('clamps an oversized limit to 200', async () => {
    const chain = makeChain([]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    await listRecentOperationsForRestaurant({
      client,
      restaurantId: 'rest-1',
      limit: 9999,
    });
    expect(chain.limit).toHaveBeenCalledWith(200);
  });

  it('forwards a since filter as a gte clause', async () => {
    const chain = makeChain([]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    await listRecentOperationsForRestaurant({
      client,
      restaurantId: 'rest-1',
      since: '2026-04-29T00:00:00.000Z',
    });
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-04-29T00:00:00.000Z');
  });

  it('forwards a status filter as an in clause', async () => {
    const chain = makeChain([]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    await listRecentOperationsForRestaurant({
      client,
      restaurantId: 'rest-1',
      statuses: ['succeeded', 'failed'],
    });
    expect(chain.in).toHaveBeenCalledWith('status', ['succeeded', 'failed']);
  });

  it('forwards a direction filter as an eq clause', async () => {
    const chain = makeChain([]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    await listRecentOperationsForRestaurant({
      client,
      restaurantId: 'rest-1',
      direction: 'import_from_google',
    });
    expect(chain.eq).toHaveBeenCalledWith('direction', 'import_from_google');
  });

  it('rejects unknown section_key in returned rows', async () => {
    const chain = makeChain([makeRow({ section_key: 'totally-bogus' })]);
    const fromMock = vi.fn(() => chain);
    const client = { from: fromMock } as unknown as SupabaseClient<Database>;
    await expect(
      listRecentOperationsForRestaurant({ client, restaurantId: 'rest-1' }),
    ).rejects.toThrow(/unexpected section_key/);
  });
});
