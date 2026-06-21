import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGoogleBusinessProfileFoodMenusContextMock = vi.hoisted(() => vi.fn());
const publishFoodMenusProjectionToGoogleMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileFoodMenusContext: getGoogleBusinessProfileFoodMenusContextMock,
}));

vi.mock('@/server/google-business-profile/food-menus-sync', () => ({
  publishFoodMenusProjectionToGoogle: publishFoodMenusProjectionToGoogleMock,
}));

import {
  applyFoodMenusExportBatchToGoogle,
  applyFoodMenusExportToGoogle,
} from '@/server/dual-sync/publish/ports';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = 'rest-1';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const FIELD_KEY = 'foodMenus.items.starters.foodMenu_item_starters/default_chilli-paneer';

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: null,
      contactPhone: null,
      address: null,
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
    foodMenus: {
      items: [
        {
          stableKey: 'foodMenu.item.starters/default.chilli-paneer',
          itemName: 'Chilli Paneer',
          sectionLabel: 'Starters',
          description: 'Crisp paneer',
          basePrice: 8.95,
          currency: 'GBP',
          dietaryTags: ['Vegetarian'],
          allergensContains: ['Milk'],
          googlePath: 'menus[0].sections[0].items[0]',
        },
      ],
    },
    ...over,
  };
}

describe('dual-sync FoodMenus export port', () => {
  beforeEach(() => {
    getGoogleBusinessProfileFoodMenusContextMock.mockReset();
    publishFoodMenusProjectionToGoogleMock.mockReset();
    getGoogleBusinessProfileFoodMenusContextMock.mockResolvedValue({
      externalProfileId: 'profile-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
    });
    publishFoodMenusProjectionToGoogleMock.mockResolvedValue({
      baselineGoogleHash: 'b'.repeat(64),
      googleResponse: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      attempt: { id: 'attempt-1', status: 'succeeded' },
    });
  });

  it('publishes the full FoodMenus projection for one dual-sync export field', async () => {
    const snapshot = makeSnapshot();

    const result = await applyFoodMenusExportToGoogle({
      client,
      restaurantId: RESTAURANT_ID,
      publishJobId: 'publish-job-1',
      actorUserId: 'user-1',
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      decision: {
        fieldKey: FIELD_KEY,
        sectionKey: 'foodMenus',
        action: 'export_to_google',
        pinnedCoreHash: null,
        pinnedGbpHash: null,
      },
    });

    expect(getGoogleBusinessProfileFoodMenusContextMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      requirePushEnabled: true,
    });
    expect(publishFoodMenusProjectionToGoogleMock).toHaveBeenCalledWith({
      client,
      restaurantId: RESTAURANT_ID,
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });
    expect(result).toMatchObject({
      status: 'succeeded',
      googleUpdateMask: 'menus',
      afterCoreHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      afterGbpHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('coalesces multiple FoodMenus export decisions into one Google publish call', async () => {
    const snapshot = makeSnapshot({
      foodMenus: {
        items: [
          {
            stableKey: 'foodMenu.item.starters/default.chilli-paneer',
            itemName: 'Chilli Paneer',
            sectionLabel: 'Starters',
            description: 'Crisp paneer',
            basePrice: 8.95,
            currency: 'GBP',
            dietaryTags: ['Vegetarian'],
            allergensContains: ['Milk'],
            googlePath: 'menus[0].sections[0].items[0]',
          },
          {
            stableKey: 'foodMenu.item.mains/default.tikka-masala',
            itemName: 'Tikka Masala',
            sectionLabel: 'Mains',
            description: null,
            basePrice: 12.5,
            currency: 'GBP',
            dietaryTags: [],
            allergensContains: ['Milk'],
            googlePath: 'menus[0].sections[1].items[0]',
          },
        ],
      },
    });

    const result = await applyFoodMenusExportBatchToGoogle({
      client,
      restaurantId: RESTAURANT_ID,
      publishJobId: 'publish-job-1',
      actorUserId: 'user-1',
      sectionKey: 'foodMenus',
      coreSnapshot: snapshot,
      gbpSnapshot: snapshot,
      decisions: [
        {
          fieldKey: FIELD_KEY,
          sectionKey: 'foodMenus',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
        {
          fieldKey: 'foodMenus.items.mains.foodMenu_item_mains/default_tikka-masala',
          sectionKey: 'foodMenus',
          action: 'export_to_google',
          pinnedCoreHash: null,
          pinnedGbpHash: null,
        },
      ],
    });

    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(Object.values(result.perField).map((entry) => entry.status)).toEqual([
        'succeeded',
        'succeeded',
      ]);
    }
    expect(publishFoodMenusProjectionToGoogleMock).toHaveBeenCalledTimes(1);
  });
});
