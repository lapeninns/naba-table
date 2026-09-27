import { describe, expect, it } from 'vitest';

import { resolveGoogleContentFence } from '@/server/dual-sync/snapshots/runs';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function connectionClient(status: string, restaurantId = 'restaurant-1') {
  const row: Record<string, string | number> = {
    id: 'profile-row-1',
    restaurant_id: restaurantId,
    provider: 'google_business_profile',
    connection_status: status,
    external_account_id: 'account-1',
    external_profile_id: 'profile-1',
    external_location_id: 'location-1',
    connection_generation: 1,
    consent_epoch: 8,
  };
  let matches = true;
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      matches &&= row[column] === value;
      return query;
    },
    in: (column: string, values: readonly unknown[]) => {
      matches &&= values.includes(row[column]);
      return query;
    },
    maybeSingle: async () => ({ data: matches ? row : null, error: null }),
  };
  return { from: () => query } as unknown as SupabaseClient<Database>;
}

describe('GBP refresh connection recovery fence', () => {
  it('allows a live retry after a transient sync error with the same consent fence', async () => {
    await expect(
      resolveGoogleContentFence({
        client: connectionClient('sync_error'),
        restaurantId: 'restaurant-1',
        allowSyncError: true,
      }),
    ).resolves.toMatchObject({
      connectionGeneration: 1,
      consentEpoch: 8,
      locationId: 'location-1',
    });
  });

  it('does not allow a failed connection to be used for cached recomputation', async () => {
    await expect(
      resolveGoogleContentFence({
        client: connectionClient('sync_error'),
        restaurantId: 'restaurant-1',
      }),
    ).rejects.toThrow('connection fence is unavailable');
  });

  it.each(['reauth_required', 'unlinked', 'authorized'])(
    'rejects %s even for live retry',
    async (status) => {
      await expect(
        resolveGoogleContentFence({
          client: connectionClient(status),
          restaurantId: 'restaurant-1',
          allowSyncError: true,
        }),
      ).rejects.toThrow('connection fence is unavailable');
    },
  );

  it('keeps live retries scoped to the restaurant', async () => {
    await expect(
      resolveGoogleContentFence({
        client: connectionClient('sync_error', 'other-restaurant'),
        restaurantId: 'restaurant-1',
        allowSyncError: true,
      }),
    ).rejects.toThrow('connection fence is unavailable');
  });
});
