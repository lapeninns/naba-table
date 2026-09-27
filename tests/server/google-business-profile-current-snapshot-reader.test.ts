import { describe, expect, it, vi } from 'vitest';

import { readGoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/businessInfoReadPersistence';
import { readGoogleSnapshot } from '@/server/dual-sync/snapshots/google';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/server/dual-sync/snapshots/food-menus', () => ({
  readStoredGoogleFoodMenusSection: vi.fn().mockResolvedValue({ items: [] }),
}));

const observedAt = '2026-09-27T16:30:00Z';
const profile = {
  id: 'profile-1',
  restaurant_id: 'restaurant-1',
  provider: 'google_business_profile',
  external_account_id: 'account-1',
  external_profile_id: 'location-1',
  external_location_id: 'location-1',
  connection_generation: 3,
  consent_epoch: 8,
};
function snapshot(payload: Json, fetched_at = observedAt, snapshot_type = 'location') {
  return {
    id: 'snapshot-1',
    external_profile_id: profile.id,
    restaurant_id: 'restaurant-1',
    payload,
    fetched_at,
    snapshot_type,
    payload_hash: 'hash',
  };
}
function clientFor(snapshots: ReturnType<typeof snapshot>[], connected = true) {
  const rpc = vi.fn().mockResolvedValue({ data: snapshots, error: null });
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      maybeSingle: async () => ({ data: connected ? profile : null, error: null }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    if (
      table.startsWith('restaurant_') &&
      ![
        'restaurant_external_profiles',
        'restaurant_operating_hours',
        'restaurant_service_periods',
      ].includes(table)
    )
      throw new Error(`Retired provider mirror queried: ${table}`);
    return query;
  });
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, rpc, from };
}
const location = {
  name: 'locations/location-1',
  title: 'Test Crown',
  phoneNumbers: { primaryPhone: '01223 000000' },
  storefrontAddress: { addressLines: ['1 Test Road'], locality: 'Cambridge', regionCode: 'GB' },
  regularHours: {
    periods: [
      { openDay: 'MONDAY', closeDay: 'MONDAY', openTime: { hours: 12 }, closeTime: { hours: 22 } },
    ],
  },
};

describe('current GBP snapshot reader', () => {
  it('projects current fenced provider responses without querying retired mirror tables', async () => {
    const { client, rpc } = clientFor([
      snapshot({
        serviceItems: [{ freeFormServiceItem: { label: { displayName: 'Sunday lunch' } } }],
      }),
      snapshot(location),
      snapshot({ ...location, title: 'Old name' }, '2026-09-26T16:30:00Z'),
    ]);
    const info = await readGoogleBusinessProfileBusinessInfo('restaurant-1', client);
    expect(info.details?.businessName).toBe('Test Crown');
    expect(info.phoneNumbers[0]?.phoneNumber).toBe('01223 000000');
    expect(info.addresses[0]?.locality).toBe('Cambridge');
    expect(
      info.coreNormalization.operatingHours.weekly.find((day) => day.dayOfWeek === 1),
    ).toMatchObject({ opensAt: '12:00', closesAt: '22:00', isClosed: false });
    expect(info.serviceItems).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith(
      'get_current_gbp_external_profile_snapshots_v1',
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_connection_generation: 3,
        p_consent_epoch: 8,
        p_external_profile_row_id: 'profile-1',
      }),
    );
  });

  it('returns no provider details when the retention RPC has no current snapshot', async () => {
    const { client } = clientFor([]);
    expect(
      (await readGoogleBusinessProfileBusinessInfo('restaurant-1', client)).details,
    ).toBeNull();
  });

  it('refuses a comparison when current content is missing instead of offering closed hours', async () => {
    const { client } = clientFor([]);
    await expect(
      readGoogleSnapshot({ restaurantId: 'restaurant-1', client }),
    ).rejects.toMatchObject({ code: 'GBP_SNAPSHOT_UNAVAILABLE' });
  });

  it('compares the observed name and hours and reads native Google boolean and enum attributes', async () => {
    const { client } = clientFor([
      snapshot(location),
      snapshot(
        {
          name: 'locations/location-1/attributes',
          attributes: [
            { name: 'attributes/has_wifi', valueType: 'BOOL', values: [true] },
            { name: 'attributes/dress_code', valueType: 'ENUM', values: ['CASUAL'] },
          ],
        },
        observedAt,
        'attributes',
      ),
    ]);
    const result = await readGoogleSnapshot({ restaurantId: 'restaurant-1', client });
    expect(result.profile.name).toBe('Test Crown');
    expect(result.operatingHours.weekly.find((day) => day.dayOfWeek === 1)).toMatchObject({
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
    });
    expect(result.businessContext.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attributeKey: 'has_wifi', boolValue: true }),
        expect.objectContaining({ attributeKey: 'dress_code', enumValues: ['CASUAL'] }),
      ]),
    );
  });

  it('does not reuse older service items after a new refresh omits them', async () => {
    const { client } = clientFor([
      snapshot(location),
      snapshot(
        {
          ...location,
          serviceItems: [{ freeFormServiceItem: { label: { displayName: 'Old service' } } }],
        },
        '2026-09-26T16:30:00Z',
      ),
    ]);
    expect(
      (await readGoogleBusinessProfileBusinessInfo('restaurant-1', client)).serviceItems,
    ).toEqual([]);
  });

  it('does not manufacture closed weekdays when Google has no weekly hours', async () => {
    const { regularHours: _hours, ...withoutHours } = location;
    const { client } = clientFor([snapshot(withoutHours)]);
    expect(
      (await readGoogleSnapshot({ restaurantId: 'restaurant-1', client })).operatingHours.weekly,
    ).toEqual([]);
  });

  it('propagates snapshot RPC errors and rejects incomplete latest batches', async () => {
    const { client, rpc } = clientFor([]);
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(
      readGoogleBusinessProfileBusinessInfo('restaurant-1', client),
    ).rejects.toMatchObject({ code: '42501' });
    const incomplete = clientFor([
      snapshot({ serviceItems: [] }),
      snapshot(location, '2026-09-26T16:30:00Z'),
    ]);
    await expect(
      readGoogleBusinessProfileBusinessInfo('restaurant-1', incomplete.client),
    ).rejects.toMatchObject({ code: 'GBP_SNAPSHOT_INVALID' });
  });

  it('supports onboarding without a linked profile or snapshot RPC', async () => {
    const { client, rpc } = clientFor([], false);
    expect(
      (await readGoogleBusinessProfileBusinessInfo('restaurant-1', client)).details,
    ).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed nested provider fields and mismatched location identity', async () => {
    for (const payload of [
      { ...location, regularHours: { periods: 'invalid' } },
      { ...location, name: 'locations/another-tenant' },
    ]) {
      const { client } = clientFor([snapshot(payload)]);
      await expect(
        readGoogleBusinessProfileBusinessInfo('restaurant-1', client),
      ).rejects.toMatchObject({ code: 'GBP_SNAPSHOT_INVALID' });
    }
  });
});
