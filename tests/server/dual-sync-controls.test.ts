import { describe, expect, it, vi } from 'vitest';

import {
  assertDualSyncRestaurantNotPaused,
  getDualSyncRestaurantControl,
  setDualSyncRestaurantPaused,
} from '@/server/dual-sync/controls';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeSelectClient(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  const client = {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient<Database>;
  return { client, query };
}

function makeUpsertClient(result: { data: unknown; error: unknown }) {
  const query = {
    upsert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => result),
  };
  const client = {
    from: vi.fn(() => query),
  } as unknown as SupabaseClient<Database>;
  return { client, query };
}

describe('dual-sync restaurant controls', () => {
  it('returns an unpaused default when no control row exists', async () => {
    const { client, query } = makeSelectClient({ data: null, error: null });

    const control = await getDualSyncRestaurantControl({ client, restaurantId: 'rest-1' });

    expect(control).toMatchObject({
      restaurantId: 'rest-1',
      provider: 'google_business_profile',
      syncPaused: false,
      pauseReason: null,
    });
    expect(query.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
    expect(query.eq).toHaveBeenCalledWith('provider', 'google_business_profile');
  });

  it('upserts paused control state with actor and reason', async () => {
    const row = {
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      sync_paused: true,
      pause_reason: 'Maintenance window.',
      paused_by_user_id: 'user-1',
      paused_at: '2026-05-09T10:00:00.000Z',
      resumed_at: null,
      created_at: '2026-05-09T10:00:00.000Z',
      updated_at: '2026-05-09T10:00:00.000Z',
    };
    const { client, query } = makeUpsertClient({ data: row, error: null });

    const control = await setDualSyncRestaurantPaused({
      client,
      restaurantId: 'rest-1',
      paused: true,
      reason: ' Maintenance window. ',
      actorUserId: 'user-1',
    });

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant_id: 'rest-1',
        provider: 'google_business_profile',
        sync_paused: true,
        pause_reason: 'Maintenance window.',
        paused_by_user_id: 'user-1',
        resumed_at: null,
      }),
      { onConflict: 'restaurant_id,provider' },
    );
    expect(control).toMatchObject({
      restaurantId: 'rest-1',
      syncPaused: true,
      pauseReason: 'Maintenance window.',
      pausedByUserId: 'user-1',
    });
  });

  it('throws a stable paused error when asserting an inactive restaurant', async () => {
    const row = {
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      sync_paused: true,
      pause_reason: 'Maintenance window.',
      paused_by_user_id: 'user-1',
      paused_at: '2026-05-09T10:00:00.000Z',
      resumed_at: null,
      created_at: '2026-05-09T10:00:00.000Z',
      updated_at: '2026-05-09T10:00:00.000Z',
    };
    const { client } = makeSelectClient({ data: row, error: null });

    await expect(
      assertDualSyncRestaurantNotPaused({ client, restaurantId: 'rest-1' }),
    ).rejects.toMatchObject({
      code: 'DUAL_SYNC_RESTAURANT_PAUSED',
      message: 'Maintenance window.',
    });
  });
});
