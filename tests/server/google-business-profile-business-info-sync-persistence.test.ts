import { describe, expect, it } from 'vitest';

import { buildProfileChangeLogRows } from '@/server/google-business-profile/businessInfoSyncPersistence';

import type { CanonicalSyncRows } from '@/server/google-business-profile/businessInfoCanonicalRows';

function buildRows(overrides: Partial<CanonicalSyncRows> = {}): CanonicalSyncRows {
  return {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    ...overrides,
  };
}

describe('google business profile business info sync persistence', () => {
  it('does not build content-bearing provider change-log rows', () => {
    const rows = buildRows({
      details: {
        restaurant_id: 'rest-1',
        business_name: 'Old Crown',
      } as never,
      addresses: [
        {
          restaurant_id: 'rest-1',
          formatted_address: '1 High Street',
        } as never,
      ],
      attributes: [
        {
          restaurant_id: 'rest-1',
          attribute_key: 'serves_beer',
        } as never,
      ],
      serviceItems: [
        {
          restaurant_id: 'rest-1',
          item_key: 'private_dining',
        } as never,
      ],
    });

    expect(
      buildProfileChangeLogRows({
        restaurantId: 'rest-1',
        externalProfileId: 'profile-1',
        syncedAt: '2026-05-22T07:51:00.000Z',
        rows,
        syncAttributes: true,
        syncServiceItems: false,
      }).map((row) => ({
        entity_table: row.entity_table,
        metadata: row.metadata,
        external_profile_id: row.external_profile_id,
      })),
    ).toEqual([]);
  });
});
