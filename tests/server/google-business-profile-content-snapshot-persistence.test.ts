import { describe, expect, it, vi } from 'vitest';

import {
  readCurrentGoogleBusinessProfileRawSnapshots,
  requireGoogleBusinessProfileContentFence,
} from '@/server/google-business-profile/contentSnapshotPersistence';

import type { Database } from '@/types/supabase';

const profile = {
  id: '00000000-0000-4000-8000-000000000002',
  restaurant_id: '00000000-0000-4000-8000-000000000001',
  provider: 'google_business_profile',
  external_account_id: 'account-123',
  external_profile_id: 'profile-123',
  external_location_id: '456',
  connection_generation: 7,
  consent_epoch: 9,
} as Database['public']['Tables']['restaurant_external_profiles']['Row'];

describe('GBP content snapshot persistence', () => {
  it('passes the exact server-derived fence to the current and unexpired read RPC', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const fence = requireGoogleBusinessProfileContentFence(profile.restaurant_id, profile);

    const rows = await readCurrentGoogleBusinessProfileRawSnapshots({
      client: { rpc } as never,
      fence,
      snapshotType: 'location',
      now: '2026-08-09T12:00:00.000Z',
    });

    expect(rows).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('get_current_gbp_external_profile_snapshots_v1', {
      p_restaurant_id: profile.restaurant_id,
      p_external_profile_row_id: profile.id,
      p_external_account_id: 'account-123',
      p_external_profile_id: 'profile-123',
      p_external_location_id: '456',
      p_connection_generation: 7,
      p_consent_epoch: 9,
      p_snapshot_type: 'location',
      p_now: '2026-08-09T12:00:00.000Z',
    });
  });

  it('rejects cross-tenant or incomplete profile bindings before a storage call', () => {
    expect(() => requireGoogleBusinessProfileContentFence('another-restaurant', profile)).toThrow(
      expect.objectContaining({ code: 'GBP_CONTENT_FENCE_REQUIRED' }),
    );
    expect(() =>
      requireGoogleBusinessProfileContentFence(profile.restaurant_id, {
        ...profile,
        external_location_id: null,
      }),
    ).toThrow(expect.objectContaining({ code: 'GBP_CONTENT_FENCE_REQUIRED' }));
  });
});
