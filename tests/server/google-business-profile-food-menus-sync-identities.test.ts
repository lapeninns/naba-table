import { beforeEach, describe, expect, it, vi } from 'vitest';

const readLatestFoodMenusSnapshotMock = vi.hoisted(() => vi.fn());
const listProjectedFoodMenusIdentitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  readLatestFoodMenusSnapshot: readLatestFoodMenusSnapshotMock,
  listProjectedFoodMenusIdentities: listProjectedFoodMenusIdentitiesMock,
}));

import { resolvePreviousFoodMenusIdentities } from '@/server/google-business-profile/food-menus-sync-identities';

import type { GoogleFoodMenusProjectedIdentity } from '@/server/google-business-profile/food-menus';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

const identity: GoogleFoodMenusProjectedIdentity = {
  stableKey: 'foodMenu.item.starters/default.paneer',
  localItemId: 'item-1',
  externalItemId: 'paneer',
  itemName: 'Paneer',
  sectionKey: 'starters/default',
  sectionLabel: 'Starters',
  googlePath: 'menus[0].sections[0].items[0]',
  googleOptionPaths: [],
};

describe('FoodMenus sync previous identity resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses explicit previous identities without storage reads', async () => {
    await expect(
      resolvePreviousFoodMenusIdentities({
        client,
        restaurantId: 'rest-1',
        projectionSnapshotId: 'projection-1',
        previousIdentities: [identity],
      }),
    ).resolves.toEqual({
      projectionSnapshotId: 'projection-1',
      identities: [identity],
    });
    expect(readLatestFoodMenusSnapshotMock).not.toHaveBeenCalled();
    expect(listProjectedFoodMenusIdentitiesMock).not.toHaveBeenCalled();
  });

  it('loads the latest projection snapshot when no snapshot id is supplied', async () => {
    readLatestFoodMenusSnapshotMock.mockResolvedValueOnce({ id: 'latest-projection' });
    listProjectedFoodMenusIdentitiesMock.mockResolvedValueOnce([
      {
        localItemId: 'item-1',
        externalItemId: 'paneer',
        stableKey: 'foodMenu.item.starters/default.paneer',
        itemName: 'Paneer',
        sectionKey: 'starters/default',
        sectionLabel: 'Starters',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: [],
      },
      {
        localItemId: null,
        externalItemId: 'missing',
        stableKey: 'foodMenu.item.starters/default.missing',
        itemName: 'Missing',
        sectionKey: 'starters/default',
        sectionLabel: 'Starters',
        googlePath: 'menus[0].sections[0].items[1]',
        googleOptionPaths: [],
      },
    ]);

    await expect(
      resolvePreviousFoodMenusIdentities({
        client,
        restaurantId: 'rest-1',
      }),
    ).resolves.toEqual({
      projectionSnapshotId: 'latest-projection',
      identities: [identity],
    });
    expect(readLatestFoodMenusSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      snapshotKind: 'nabatable_projection',
    });
    expect(listProjectedFoodMenusIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      snapshotId: 'latest-projection',
    });
  });

  it('returns an empty identity set when no projection snapshot exists', async () => {
    readLatestFoodMenusSnapshotMock.mockResolvedValueOnce(null);

    await expect(
      resolvePreviousFoodMenusIdentities({
        client,
        restaurantId: 'rest-1',
      }),
    ).resolves.toEqual({
      projectionSnapshotId: null,
      identities: [],
    });
    expect(listProjectedFoodMenusIdentitiesMock).not.toHaveBeenCalled();
  });
});
