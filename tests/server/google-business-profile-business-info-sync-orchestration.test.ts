import { describe, expect, it, vi } from 'vitest';

import { syncGoogleBusinessProfileCanonicalBusinessInfo } from '@/server/google-business-profile/businessInfoSyncOrchestration';

describe('google business profile business info sync orchestration', () => {
  it('preserves existing service items when the optional segment was unavailable', async () => {
    const rpc = vi.fn(async () => ({ error: null }));

    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: '00000000-0000-4000-8000-000000000001',
      externalProfile: {
        id: '00000000-0000-4000-8000-000000000002',
      } as Parameters<typeof syncGoogleBusinessProfileCanonicalBusinessInfo>[0]['externalProfile'],
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        __nabatableOptionalFetchStatus: {
          serviceItems: 'unavailable',
        },
      },
      attributes: null,
      client: { rpc } as Parameters<
        typeof syncGoogleBusinessProfileCanonicalBusinessInfo
      >[0]['client'],
      syncedAt: '2026-04-18T12:00:00.000Z',
      syncAttributes: false,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [, args] = rpc.mock.calls[0] ?? [];
    expect(args.p_service_items).toBeNull();
    expect(args.p_field_sync_entity_tables).not.toContain('restaurant_service_items');
    expect(JSON.stringify(args.p_profile_change_log_rows)).not.toContain(
      'restaurant_service_items',
    );
  });

  it('replaces service items when Google explicitly returns an empty fetched segment', async () => {
    const rpc = vi.fn(async () => ({ error: null }));

    await syncGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: '00000000-0000-4000-8000-000000000001',
      externalProfile: {
        id: '00000000-0000-4000-8000-000000000002',
      } as Parameters<typeof syncGoogleBusinessProfileCanonicalBusinessInfo>[0]['externalProfile'],
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        serviceItems: [],
        __nabatableOptionalFetchStatus: {
          serviceItems: 'fetched',
        },
      },
      attributes: null,
      client: { rpc } as Parameters<
        typeof syncGoogleBusinessProfileCanonicalBusinessInfo
      >[0]['client'],
      syncedAt: '2026-04-18T12:00:00.000Z',
      syncAttributes: false,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [, args] = rpc.mock.calls[0] ?? [];
    expect(args.p_service_items).toEqual([]);
    expect(args.p_field_sync_entity_tables).toContain('restaurant_service_items');
  });
});
