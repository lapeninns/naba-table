import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGoogleBusinessProfileFoodMenusContextMock = vi.hoisted(() => vi.fn());
const syncGoogleBusinessProfileBusinessInformationMock = vi.hoisted(() => vi.fn());
const prepareFoodMenusProjectionMock = vi.hoisted(() => vi.fn());
const refreshFoodMenusImportReviewFromGoogleMock = vi.hoisted(() => vi.fn());
const readNabatableSnapshotMock = vi.hoisted(() => vi.fn());
const readGoogleSnapshotMock = vi.hoisted(() => vi.fn());
const openSnapshotRunMock = vi.hoisted(() => vi.fn());
const commitSnapshotRunMock = vi.hoisted(() => vi.fn());
const failSnapshotRunMock = vi.hoisted(() => vi.fn());
const recomputeAllStatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileFoodMenusContext: getGoogleBusinessProfileFoodMenusContextMock,
  syncGoogleBusinessProfileBusinessInformation: syncGoogleBusinessProfileBusinessInformationMock,
}));

vi.mock('@/server/google-business-profile/food-menus-sync', () => ({
  prepareFoodMenusProjection: prepareFoodMenusProjectionMock,
  refreshFoodMenusImportReviewFromGoogle: refreshFoodMenusImportReviewFromGoogleMock,
}));

vi.mock('@/server/dual-sync/snapshots/nabatable', () => ({
  readNabatableSnapshot: readNabatableSnapshotMock,
}));

vi.mock('@/server/dual-sync/snapshots/google', () => ({
  readGoogleSnapshot: readGoogleSnapshotMock,
}));

vi.mock('@/server/dual-sync/snapshots/runs', () => ({
  commitSnapshotRun: commitSnapshotRunMock,
  failSnapshotRun: failSnapshotRunMock,
  openSnapshotRun: openSnapshotRunMock,
}));

vi.mock('@/server/dual-sync/state/recompute', () => ({
  recomputeAllStates: recomputeAllStatesMock,
}));

import { refreshFromGoogle } from '@/server/dual-sync/refresh/service';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: null,
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    foodMenus: { items: [] },
    ...overrides,
  };
}

beforeEach(() => {
  getGoogleBusinessProfileFoodMenusContextMock.mockReset();
  syncGoogleBusinessProfileBusinessInformationMock.mockReset();
  prepareFoodMenusProjectionMock.mockReset();
  refreshFoodMenusImportReviewFromGoogleMock.mockReset();
  readNabatableSnapshotMock.mockReset();
  readGoogleSnapshotMock.mockReset();
  openSnapshotRunMock.mockReset();
  commitSnapshotRunMock.mockReset();
  failSnapshotRunMock.mockReset();
  recomputeAllStatesMock.mockReset();

  openSnapshotRunMock.mockResolvedValue({
    id: 'run-1',
    restaurantId: RESTAURANT_ID,
    provider: 'google_business_profile',
    runKind: 'manual',
    status: 'pending',
    snapshotHash: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-02T18:00:00.000Z',
    finishedAt: null,
    createdAt: '2026-05-02T18:00:00.000Z',
  });
  commitSnapshotRunMock.mockImplementation(async (input) => ({
    id: input.runId,
    restaurantId: RESTAURANT_ID,
    provider: 'google_business_profile',
    runKind: 'manual',
    status: 'succeeded',
    snapshotHash: input.snapshotHash,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-05-02T18:00:00.000Z',
    finishedAt: '2026-05-02T18:00:01.000Z',
    createdAt: '2026-05-02T18:00:00.000Z',
  }));
  readNabatableSnapshotMock.mockResolvedValue(makeSnapshot());
  readGoogleSnapshotMock.mockResolvedValue(
    makeSnapshot({
      foodMenus: {
        items: [
          {
            stableKey: 'foodMenu.item.starters/default.chilli-paneer',
            itemName: 'Chilli Paneer',
            sectionLabel: 'Starters',
            description: 'Changed on Google',
            basePrice: 9.5,
            currency: 'GBP',
            dietaryTags: ['Vegetarian'],
            allergensContains: ['Milk'],
            googlePath: 'menus[0].sections[0].items[0]',
          },
        ],
      },
    }),
  );
  recomputeAllStatesMock.mockResolvedValue({
    evaluatedFieldKeys: ['foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer'],
    transitions: [],
  });
  getGoogleBusinessProfileFoodMenusContextMock.mockResolvedValue({
    externalProfileId: 'external-1',
    accessToken: 'access-token',
    foodMenusName: 'accounts/123/locations/456/foodMenus',
  });
  prepareFoodMenusProjectionMock.mockResolvedValue({
    snapshot: { id: 'projection-snapshot-1' },
    identities: [],
    localItemCount: 1,
    projectionHash: 'p'.repeat(64),
    projection: { foodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] } },
  });
  refreshFoodMenusImportReviewFromGoogleMock.mockResolvedValue({
    googleFoodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
    googleFoodMenusHash: 'g'.repeat(64),
    importReview: {
      googleSnapshot: { id: 'google-snapshot-1' },
      rows: [{ id: 'review-1' }, { id: 'review-2' }],
    },
  });
});

describe('refreshFromGoogle FoodMenus integration', () => {
  it('populates FoodMenus snapshots before recomputing dual-sync state', async () => {
    const result = await refreshFromGoogle({
      client,
      restaurantId: RESTAURANT_ID,
      runKind: 'scheduled',
    });

    expect(syncGoogleBusinessProfileBusinessInformationMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      client,
      { runKind: 'manual' },
    );
    expect(prepareFoodMenusProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: RESTAURANT_ID,
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        externalProfileId: 'external-1',
        source: 'scheduled',
        persist: true,
      }),
    );
    expect(refreshFoodMenusImportReviewFromGoogleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: RESTAURANT_ID,
        accessToken: 'access-token',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        externalProfileId: 'external-1',
        source: 'scheduled',
        projectionSnapshotId: 'projection-snapshot-1',
        persist: true,
      }),
    );
    expect(commitSnapshotRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        runId: 'run-1',
        canonicalSnapshot: expect.objectContaining({
          foodMenus: expect.objectContaining({
            items: [expect.objectContaining({ itemName: 'Chilli Paneer' })],
          }),
        }),
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(recomputeAllStatesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: RESTAURANT_ID,
        lastSnapshotRunId: 'run-1',
      }),
    );
    expect(result.foodMenusRefresh).toEqual({
      status: 'refreshed',
      projectionSnapshotId: 'projection-snapshot-1',
      googleSnapshotId: 'google-snapshot-1',
      googleFoodMenusHash: 'g'.repeat(64),
      importReviewCount: 2,
    });
  });

  it('does not pull FoodMenus when skipPull is enabled', async () => {
    const result = await refreshFromGoogle({
      client,
      restaurantId: RESTAURANT_ID,
      skipPull: true,
    });

    expect(syncGoogleBusinessProfileBusinessInformationMock).not.toHaveBeenCalled();
    expect(getGoogleBusinessProfileFoodMenusContextMock).not.toHaveBeenCalled();
    expect(prepareFoodMenusProjectionMock).not.toHaveBeenCalled();
    expect(refreshFoodMenusImportReviewFromGoogleMock).not.toHaveBeenCalled();
    expect(result.foodMenusRefresh).toEqual({
      status: 'skipped',
      reason: 'skip_pull',
      message: 'Live Google pull was skipped for this refresh run.',
    });
  });

  it('keeps the base refresh working when FoodMenus storage is not migrated yet', async () => {
    prepareFoodMenusProjectionMock.mockRejectedValueOnce({
      code: 'PGRST205',
      message: "Could not find the table 'restaurant_gbp_food_menu_snapshots'",
    });

    const result = await refreshFromGoogle({
      client,
      restaurantId: RESTAURANT_ID,
    });

    expect(refreshFoodMenusImportReviewFromGoogleMock).not.toHaveBeenCalled();
    expect(recomputeAllStatesMock).toHaveBeenCalled();
    expect(result.foodMenusRefresh).toEqual({
      status: 'skipped',
      reason: 'storage_unavailable',
      message: "Could not find the table 'restaurant_gbp_food_menu_snapshots'",
    });
  });

  it('skips FoodMenus refresh when Google says the location is not eligible', async () => {
    getGoogleBusinessProfileFoodMenusContextMock.mockRejectedValueOnce({
      code: 'GBP_FOOD_MENUS_NOT_ELIGIBLE',
      message: 'The linked Google Business Profile location is not eligible for FoodMenus.',
    });

    const result = await refreshFromGoogle({
      client,
      restaurantId: RESTAURANT_ID,
    });

    expect(prepareFoodMenusProjectionMock).not.toHaveBeenCalled();
    expect(refreshFoodMenusImportReviewFromGoogleMock).not.toHaveBeenCalled();
    expect(recomputeAllStatesMock).toHaveBeenCalled();
    expect(result.foodMenusRefresh).toEqual({
      status: 'skipped',
      reason: 'not_eligible',
      message: 'The linked Google Business Profile location is not eligible for FoodMenus.',
    });
  });

  it('fails the snapshot run for unexpected FoodMenus pull errors', async () => {
    refreshFoodMenusImportReviewFromGoogleMock.mockRejectedValueOnce(
      Object.assign(new Error('Google FoodMenus failed'), { name: 'GBP_UPSTREAM_ERROR' }),
    );

    await expect(
      refreshFromGoogle({
        client,
        restaurantId: RESTAURANT_ID,
      }),
    ).rejects.toThrow('Google FoodMenus failed');

    expect(failSnapshotRunMock).toHaveBeenCalledWith({
      client,
      runId: 'run-1',
      errorCode: 'GBP_UPSTREAM_ERROR',
      errorMessage: 'Google FoodMenus failed',
    });
  });

  it('fails the snapshot run for FoodMenus storage errors after migration exists', async () => {
    prepareFoodMenusProjectionMock.mockRejectedValueOnce({
      code: '23505',
      message:
        'duplicate key value violates unique constraint "restaurant_gbp_food_menu_snapshots_hash_idx"',
    });

    await expect(
      refreshFromGoogle({
        client,
        restaurantId: RESTAURANT_ID,
      }),
    ).rejects.toThrow(
      'duplicate key value violates unique constraint "restaurant_gbp_food_menu_snapshots_hash_idx"',
    );

    expect(refreshFoodMenusImportReviewFromGoogleMock).not.toHaveBeenCalled();
    expect(failSnapshotRunMock).toHaveBeenCalledWith({
      client,
      runId: 'run-1',
      errorCode: '23505',
      errorMessage:
        'duplicate key value violates unique constraint "restaurant_gbp_food_menu_snapshots_hash_idx"',
    });
  });
});
