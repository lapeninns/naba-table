import { describe, expect, it } from 'vitest';

import {
  buildFoodMenuSettingsUpsertPayload,
  buildFoodMenusProjectionSnapshotMetadata,
  buildFoodMenusSnapshotInsertPayload,
  buildProjectedFoodMenusIdentityUpsertPayloads,
} from '@/server/google-business-profile/food-menus-storage-payloads';

import type { GoogleFoodMenusProjection } from '@/server/google-business-profile/food-menus';

describe('GBP FoodMenus storage payload builders', () => {
  it('builds snapshot insert payloads with provider and null JSON fallbacks', () => {
    expect(
      buildFoodMenusSnapshotInsertPayload({
        restaurantId: 'rest-1',
        snapshotKind: 'google_pull',
        source: 'manual',
        externalProfileId: 'external-1',
        status: 'succeeded',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        projectionMetadata: { source: 'test' },
        snapshotHash: 'hash-1',
        googleEtag: 'etag-1',
        errorCode: null,
        errorMessage: null,
        pulledAt: '2026-05-22T20:00:00.000Z',
        createdByUserId: 'user-1',
      }),
    ).toEqual({
      restaurant_id: 'rest-1',
      external_profile_id: 'external-1',
      provider: 'google_business_profile',
      snapshot_kind: 'google_pull',
      source: 'manual',
      status: 'succeeded',
      food_menus_name: 'accounts/123/locations/456/foodMenus',
      raw_food_menus: null,
      canonical_food_menus: null,
      projection_metadata: {},
      snapshot_hash: 'hash-1',
      google_etag: 'etag-1',
      error_code: null,
      error_message: null,
      pulled_at: '2026-05-22T20:00:00.000Z',
      created_by_user_id: 'user-1',
    });
  });

  it('builds projected identity upsert payloads with Google option paths', () => {
    expect(
      buildProjectedFoodMenusIdentityUpsertPayloads({
        restaurantId: 'rest-1',
        snapshotId: 'snapshot-1',
        identities: [
          {
            stableKey: 'foodMenu.item.starters/default.optionItem.extra-paneer',
            localItemId: 'item-1',
            externalItemId: 'extra-paneer',
            itemName: 'Extra Paneer',
            sectionKey: 'starters/default',
            sectionLabel: 'Starters',
            googlePath: 'menus[0].sections[0].items[0].options[0].items[0]',
            googleOptionPaths: ['menus[0].sections[0].items[0].options[0]'],
            projectionKind: 'option_item',
          },
        ],
      }),
    ).toEqual([
      {
        restaurant_id: 'rest-1',
        snapshot_id: 'snapshot-1',
        menu_item_id: 'item-1',
        external_item_id: 'extra-paneer',
        stable_key: 'foodMenu.item.starters/default.optionItem.extra-paneer',
        item_name: 'Extra Paneer',
        section_key: 'starters/default',
        section_label: 'Starters',
        google_path: 'menus[0].sections[0].items[0].options[0].items[0]',
        google_option_paths: ['menus[0].sections[0].items[0].options[0]'],
      },
    ]);
  });

  it('builds projection metadata while preserving caller overrides', () => {
    const projection: GoogleFoodMenusProjection = {
      foodMenus: { name: 'accounts/123/locations/456/foodMenus', menus: [] },
      skippedItems: [{ itemId: 'item-1', reason: 'missing_price' }],
      identities: [
        {
          stableKey: 'foodMenu.item.starters/default.paneer',
          localItemId: 'item-1',
          externalItemId: 'paneer',
          itemName: 'Paneer',
          sectionKey: 'starters/default',
          sectionLabel: 'Starters',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
        },
      ],
    };

    expect(
      buildFoodMenusProjectionSnapshotMetadata(projection, {
        requestedBy: 'user-1',
        identityCount: 99,
      }),
    ).toEqual({
      skippedItems: [{ itemId: 'item-1', reason: 'missing_price' }],
      identityCount: 99,
      requestedBy: 'user-1',
    });
  });

  it('builds settings upsert payloads with stable null and array defaults', () => {
    expect(
      buildFoodMenuSettingsUpsertPayload({
        restaurantId: 'rest-1',
        menuLabel: undefined,
        sourceUrl: null,
        cuisines: undefined,
        languageCode: 'en-GB',
        updatedAt: '2026-05-22T20:00:00.000Z',
      }),
    ).toEqual({
      restaurant_id: 'rest-1',
      menu_label: null,
      source_url: null,
      cuisines: [],
      language_code: 'en-GB',
      updated_at: '2026-05-22T20:00:00.000Z',
    });
  });
});
