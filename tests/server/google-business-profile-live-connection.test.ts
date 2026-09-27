import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const mocks = vi.hoisted(() => ({ find: vi.fn(), linked: vi.fn(), readiness: vi.fn() }));
vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  findExternalProfile: mocks.find,
}));
vi.mock('@/server/google-business-profile/serviceLinkedLocationRuntime', () => ({
  getLinkedExternalProfileWithLocation: mocks.linked,
}));
vi.mock('@/server/dual-sync/retention/supabase-port', () => ({
  loadContentRetentionReadiness: mocks.readiness,
}));
import {
  readGoogleBusinessProfileLiveConnection,
  readGoogleBusinessProfileRetentionStatus,
} from '@/server/google-business-profile/serviceLiveConnection';

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
const now = new Date('2026-09-27T12:00:00.000Z');

describe('live GBP connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockResolvedValue(profile);
    mocks.readiness.mockResolvedValue({ ready: false });
    mocks.linked.mockResolvedValue({
      externalProfile: profile,
      accessToken: 'secret',
      locationResourceName: 'locations/location',
      location: {
        name: 'locations/location',
        title: 'Live restaurant',
        storefrontAddress: {
          addressLines: ['1 Test Street'],
          locality: 'London',
          postalCode: 'N1 1AA',
          regionCode: 'GB',
        },
        phoneNumbers: { primaryPhone: '+441111111111' },
        websiteUri: 'https://example.test',
        metadata: { secret: 'not returned' },
      },
    });
  });
  it('returns only live fields and verification time despite blocked saved retention, without content writes', async () => {
    const from = vi.spyOn(client, 'from');
    const rpc = vi.spyOn(client, 'rpc');
    const result = await readGoogleBusinessProfileLiveConnection('restaurant', client, () => now);
    expect(result).toEqual({
      status: 'verified',
      verifiedAt: now.toISOString(),
      location: {
        title: 'Live restaurant',
        address: '1 Test Street, London, N1 1AA, GB',
        phone: '+441111111111',
        website: 'https://example.test',
      },
      retention: { status: 'blocked', reason: 'retention_not_ready' },
    });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.linked).toHaveBeenCalledWith('restaurant', client, profile);
    expect(mocks.find).toHaveBeenCalledTimes(2);
  });
  it.each([
    'connection_generation',
    'consent_epoch',
    'external_account_id',
    'external_profile_id',
    'external_location_id',
    'external_resource_name',
    'connection_status',
    'write_state',
    'restaurant_id',
    'id',
  ])('discards live content when %s changes during fetch', async (field) => {
    mocks.find
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ ...profile, [field]: 'changed' });
    await expect(
      readGoogleBusinessProfileLiveConnection('restaurant', client),
    ).rejects.toMatchObject({ code: 'GBP_LIVE_CONNECTION_CHANGED' });
  });
  it('rejects malformed provider fields instead of claiming verification', async () => {
    mocks.linked.mockResolvedValue({
      locationResourceName: 'locations/location',
      location: { name: 'locations/location', title: { unsafe: true } },
    });
    await expect(readGoogleBusinessProfileLiveConnection('restaurant', client)).rejects.toThrow();
  });
  it('rejects a provider response for a different listing', async () => {
    mocks.linked.mockResolvedValue({
      locationResourceName: 'locations/location',
      location: { name: 'locations/other' },
    });
    await expect(
      readGoogleBusinessProfileLiveConnection('restaurant', client),
    ).rejects.toMatchObject({ code: 'GBP_LIVE_CONNECTION_CHANGED' });
  });
  it('returns null for details that Google does not supply', async () => {
    mocks.linked.mockResolvedValue({
      locationResourceName: 'locations/location',
      location: { name: 'locations/location' },
    });
    const result = await readGoogleBusinessProfileLiveConnection('restaurant', client, () => now);
    expect(result.location).toEqual({ title: null, address: null, phone: null, website: null });
  });
  it('does not create a missing connection or fetch Google', async () => {
    mocks.find.mockResolvedValue(null);
    await expect(
      readGoogleBusinessProfileLiveConnection('restaurant', client),
    ).rejects.toMatchObject({ code: 'GBP_LOCATION_NOT_LINKED' });
    expect(mocks.linked).not.toHaveBeenCalled();
  });
  it('propagates access failure without returning prior content', async () => {
    mocks.linked.mockRejectedValue(new Error('provider denied'));
    await expect(readGoogleBusinessProfileLiveConnection('restaurant', client)).rejects.toThrow(
      'provider denied',
    );
  });
  it('fails closed when readiness is unavailable', async () => {
    mocks.readiness.mockRejectedValue(new Error('database detail'));
    await expect(readGoogleBusinessProfileRetentionStatus(client, now)).resolves.toEqual({
      status: 'blocked',
      reason: 'readiness_unavailable',
    });
  });
  it('reports ready without granting publishing rights', async () => {
    mocks.readiness.mockResolvedValue({ ready: true });
    await expect(readGoogleBusinessProfileRetentionStatus(client, now)).resolves.toEqual({
      status: 'ready',
      reason: null,
    });
  });
});
