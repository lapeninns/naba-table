import { describe, expect, it } from 'vitest';

import {
  rowToIdentity,
  rowToImportReview,
  rowToSnapshot,
} from '@/server/google-business-profile/food-menus-storage-mappers';

describe('GBP FoodMenus storage row mappers', () => {
  it('maps snapshot rows and falls back to empty projection metadata for non-objects', () => {
    expect(
      rowToSnapshot({
        id: 'snapshot-1',
        restaurant_id: 'rest-1',
        external_profile_id: 'external-1',
        provider: 'google_business_profile',
        snapshot_kind: 'google_pull',
        source: 'manual',
        status: 'succeeded',
        food_menus_name: 'accounts/123/locations/456/foodMenus',
        raw_food_menus: { menus: [] },
        canonical_food_menus: { menus: [] },
        projection_metadata: ['not', 'an', 'object'],
        snapshot_hash: 'hash-1',
        google_etag: 'etag-1',
        error_code: null,
        error_message: null,
        pulled_at: '2026-05-22T01:00:00.000Z',
        created_by_user_id: 'user-1',
        created_at: '2026-05-22T01:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'snapshot-1',
      restaurantId: 'rest-1',
      externalProfileId: 'external-1',
      projectionMetadata: {},
      snapshotHash: 'hash-1',
    });
  });

  it('maps option item identities and normalizes invalid option path payloads', () => {
    expect(
      rowToIdentity({
        id: 'identity-1',
        restaurant_id: 'rest-1',
        snapshot_id: 'snapshot-1',
        menu_item_id: 'item-1',
        external_item_id: 'external-item-1',
        stable_key: 'foodMenu.item.starters/default.optionItem.extra-paneer',
        item_name: 'Extra Paneer',
        section_key: 'starters/default',
        section_label: 'Starters',
        google_path: 'menus[0].sections[0].items[0].options[0].items[0]',
        google_option_paths: { unexpected: true },
        created_at: '2026-05-22T01:00:00.000Z',
      }),
    ).toMatchObject({
      projectionKind: 'option_item',
      googleOptionPaths: [],
    });
  });

  it('maps import-review warnings defensively', () => {
    expect(
      rowToImportReview({
        id: 'review-1',
        restaurant_id: 'rest-1',
        google_snapshot_id: 'google-snapshot-1',
        projection_snapshot_id: 'projection-snapshot-1',
        menu_item_id: 'item-1',
        external_item_id: 'external-item-1',
        target_kind: 'food',
        google_path: 'menus[0].sections[0].items[0]',
        google_section_label: 'Starters',
        google_item_name: 'Paneer',
        match_status: 'matched',
        match_confidence: 'previous_identity',
        suggested_patch: { name: 'Paneer' },
        warnings: { unexpected: true },
        decision_status: 'pending',
        decision_action: null,
        decided_by_user_id: null,
        decided_at: null,
        created_at: '2026-05-22T01:00:00.000Z',
        updated_at: '2026-05-22T01:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'review-1',
      warnings: [],
      suggestedPatch: { name: 'Paneer' },
    });
  });
});
