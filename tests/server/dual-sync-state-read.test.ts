import { describe, expect, it, vi } from 'vitest';

import { listFieldStates } from '@/server/dual-sync/state/read';

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
    id: 'state-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    section_key: 'profile',
    field_key: 'profile.name',
    state: 'in_sync',
    core_value_hash: 'hash-1',
    gbp_value_hash: 'hash-1',
    last_in_sync_hash: 'hash-1',
    last_core_change_at: null,
    last_gbp_change_at: null,
    last_in_sync_at: '2026-04-29T00:00:00.000Z',
    last_snapshot_run_id: null,
    metadata: {},
    created_at: '2026-04-29T00:00:00.000Z',
    updated_at: '2026-04-29T00:00:00.000Z',
    ...over,
  };
}

describe('listFieldStates', () => {
  it('accepts core_only rows produced by dual-sync recomputation', async () => {
    const chain = makeChain([
      makeRow({
        section_key: 'core_only',
        field_key: 'core.bookingPolicy',
        state: 'unsupported',
      }),
    ]);
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;

    const out = await listFieldStates({ client, restaurantId: 'rest-1' });

    expect(out).toHaveLength(1);
    expect(out[0]?.sectionKey).toBe('core_only');
    expect(out[0]?.fieldKey).toBe('core.bookingPolicy');
    expect(out[0]?.state).toBe('unsupported');
  });

  it('accepts FoodMenus rows produced by menu sync recomputation', async () => {
    const chain = makeChain([
      makeRow({
        section_key: 'foodMenus',
        field_key: 'foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer',
        state: 'drifted',
      }),
    ]);
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;

    const out = await listFieldStates({ client, restaurantId: 'rest-1' });

    expect(out).toHaveLength(1);
    expect(out[0]?.sectionKey).toBe('foodMenus');
    expect(out[0]?.fieldKey).toBe(
      'foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer',
    );
    expect(out[0]?.state).toBe('drifted');
  });

  it('still rejects unknown section keys', async () => {
    const chain = makeChain([makeRow({ section_key: 'totally-bogus' })]);
    const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;

    await expect(listFieldStates({ client, restaurantId: 'rest-1' })).rejects.toThrow(
      /unexpected section_key/,
    );
  });
});
