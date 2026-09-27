import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/supabase';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  ensure: vi.fn(),
  access: vi.fn(),
  provider: vi.fn(),
  accessFailure: vi.fn(),
  readiness: vi.fn(),
}));
vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  findExternalProfile: mocks.find,
  ensureExternalProfile: mocks.ensure,
}));
vi.mock('@/server/google-business-profile/serviceAccessRuntime', () => ({
  getUsableGoogleBusinessProfileAccessToken: mocks.access,
  persistGoogleProviderAccessFailure: mocks.accessFailure,
}));
vi.mock('@/server/google-business-profile/client', () => ({
  getGoogleBusinessProfileLocationProfile: mocks.provider,
}));
vi.mock('@/server/dual-sync/retention/supabase-port', () => ({
  loadContentRetentionReadiness: mocks.readiness,
}));
import { readGoogleBusinessProfileLiveConnection } from '@/server/google-business-profile/serviceLiveConnection';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

const profile = {
  id: 'profile',
  restaurant_id: 'restaurant',
  external_account_id: 'account',
  external_profile_id: 'google-profile',
  external_location_id: 'location',
  external_resource_name: 'locations/location',
  connection_generation: 2,
  consent_epoch: 3,
  connection_status: 'sync_error',
  write_state: 'disabled',
};
const client = createClient<Database>('https://example.supabase.co', 'test-key');

describe('live GBP service through the real linked-location helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockResolvedValue(profile);
    mocks.access.mockResolvedValue({ accessToken: 'test-token' });
    mocks.provider.mockResolvedValue({ name: 'locations/location', title: 'Live title' });
    mocks.readiness.mockResolvedValue({ ready: false });
  });
  it('reads the required existing profile and provider without creating rows or writing content', async () => {
    const from = vi.spyOn(client, 'from');
    const rpc = vi.spyOn(client, 'rpc');
    const result = await readGoogleBusinessProfileLiveConnection('restaurant', client);
    expect(result.location.title).toBe('Live title');
    expect(mocks.access).toHaveBeenCalledWith(profile, client);
    expect(mocks.provider).toHaveBeenCalledWith('test-token', 'locations/location');
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.accessFailure).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves the existing fenced provider-access-failure handler on denial', async () => {
    const denied = new GoogleBusinessProfileError('Access lost', {
      kind: 'access_lost',
      upstreamStatus: 403,
    });
    mocks.provider.mockRejectedValueOnce(denied);
    await expect(readGoogleBusinessProfileLiveConnection('restaurant', client)).rejects.toBe(
      denied,
    );
    expect(mocks.accessFailure).toHaveBeenCalledWith(denied, profile, client);
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it('discards a deleted connection after the provider responds without recreating it', async () => {
    mocks.find.mockResolvedValueOnce(profile).mockResolvedValueOnce(null);
    await expect(
      readGoogleBusinessProfileLiveConnection('restaurant', client),
    ).rejects.toMatchObject({ code: 'GBP_LIVE_CONNECTION_CHANGED' });
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
});
