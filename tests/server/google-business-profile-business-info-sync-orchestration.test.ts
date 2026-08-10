import { describe, expect, it, vi } from 'vitest';

import { syncGoogleBusinessProfileCanonicalBusinessInfo } from '@/server/google-business-profile/businessInfoSyncOrchestration';

function externalProfile() {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    restaurant_id: '00000000-0000-4000-8000-000000000001',
    provider: 'google_business_profile',
    external_account_id: 'account-123',
    external_profile_id: 'profile-123',
    external_location_id: '456',
    connection_generation: 3,
    consent_epoch: 5,
  } as Parameters<typeof syncGoogleBusinessProfileCanonicalBusinessInfo>[0]['externalProfile'];
}

describe('google business profile business info sync persistence', () => {
  it('persists the exact location response without local fetch-status metadata', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'snapshot-1' }, error: null }));

    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: '00000000-0000-4000-8000-000000000001',
      externalProfile: externalProfile(),
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        serviceItems: [],
        __nabatableOptionalFetchStatus: { serviceItems: 'fetched' },
      },
      attributes: null,
      client: { rpc } as never,
      syncedAt: '2026-04-18T12:00:00.000Z',
      syncAttributes: false,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('persist_gbp_external_profile_snapshot_v1', {
      p_restaurant_id: '00000000-0000-4000-8000-000000000001',
      p_external_profile_row_id: '00000000-0000-4000-8000-000000000002',
      p_external_account_id: 'account-123',
      p_external_profile_id: 'profile-123',
      p_external_location_id: '456',
      p_connection_generation: 3,
      p_consent_epoch: 5,
      p_snapshot_id: expect.any(String),
      p_snapshot_type: 'location',
      p_payload: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        serviceItems: [],
      },
      p_source_revision: 'locations/456',
      p_observed_at: '2026-04-18T12:00:00.000Z',
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('replace_gbp_canonical_business_info');
  });

  it('persists attributes as a separate exact raw observation', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'snapshot-1' }, error: null }));
    const attributes = {
      name: 'locations/456/attributes',
      attributes: [{ attributeId: 'has_delivery', values: [true] }],
    };

    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: '00000000-0000-4000-8000-000000000001',
      externalProfile: externalProfile(),
      location: { name: 'locations/456', title: 'Old Crown Girton' },
      attributes,
      client: { rpc } as never,
      syncedAt: '2026-04-18T12:00:00.000Z',
      syncAttributes: true,
    });

    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'persist_gbp_external_profile_snapshot_v1',
      expect.objectContaining({
        p_snapshot_type: 'attributes',
        p_payload: attributes,
        p_observed_at: '2026-04-18T12:00:00.000Z',
      }),
    );
  });

  it('fails closed before persistence when the current binding is incomplete', async () => {
    const rpc = vi.fn();

    await expect(
      syncGoogleBusinessProfileCanonicalBusinessInfo({
        restaurantId: '00000000-0000-4000-8000-000000000001',
        externalProfile: { ...externalProfile(), external_location_id: null },
        location: { name: 'locations/456' },
        attributes: null,
        client: { rpc } as never,
        syncedAt: '2026-04-18T12:00:00.000Z',
        syncAttributes: false,
      }),
    ).rejects.toMatchObject({ code: 'GBP_CONTENT_FENCE_REQUIRED' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
