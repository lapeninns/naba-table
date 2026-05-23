import { describe, expect, it } from 'vitest';

import {
  buildFoodMenuSettingsUpdateFromMetadataPatch,
  buildFoodMenusImportReviewSettings,
  countCanonicalFoodMenuItems,
  createFoodMenusBaselineChangedError,
  createFoodMenusProjectionChangedError,
  mapProjectedFoodMenusIdentityRows,
  normalizeFoodMenusPublishFailure,
  resolveFoodMenusImportReviewDecisionPlan,
  resolveFoodMenusPublishPreflightHashDecision,
  selectCanonicalPublishableFoodMenus,
} from '@/server/google-business-profile/food-menus-sync-domain';

import type {
  FoodMenuSettings,
  FoodMenusImportReviewRecord,
  FoodMenusProjectedIdentityRecord,
  FoodMenusPublishAttempt,
  FoodMenusSnapshot,
} from '@/server/google-business-profile/food-menus-storage';
import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

function makeMenu(
  id: string,
  overrides: Partial<CanonicalRestaurantMenu> = {},
): CanonicalRestaurantMenu {
  return {
    id,
    restaurantId: 'rest-1',
    labels: [{ displayName: id, languageCode: 'en-GB' }],
    sourceUrl: null,
    cuisines: [],
    defaultLanguageCode: 'en-GB',
    menuKind: 'food',
    displayOrder: 0,
    active: true,
    legacySource: {},
    sections: [],
    ...overrides,
  } as CanonicalRestaurantMenu;
}

const attempt = {
  id: 'attempt-1',
  status: 'preflight_failed',
} as FoodMenusPublishAttempt;

const snapshot = {
  id: 'snapshot-1',
  snapshotHash: 'baseline-hash',
} as FoodMenusSnapshot;

function makeReview(
  overrides: Partial<FoodMenusImportReviewRecord> = {},
): FoodMenusImportReviewRecord {
  return {
    id: 'review-1',
    restaurantId: 'rest-1',
    googleSnapshotId: 'google-snapshot-1',
    projectionSnapshotId: 'projection-snapshot-1',
    localItemId: 'item-1',
    externalItemId: 'external-1',
    targetKind: 'food',
    googlePath: 'menus[0].sections[0].items[0]',
    googleSectionLabel: 'Starters',
    googleItemName: 'Paneer',
    matchStatus: 'matched',
    matchConfidence: 'previous_identity',
    suggestedPatch: {
      itemName: 'Paneer',
      shortDescription: 'Google description',
      basePrice: 9.5,
      currency: 'gbp',
    },
    warnings: [],
    decisionStatus: 'pending',
    decisionAction: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: '2026-05-22T19:00:00.000Z',
    updatedAt: '2026-05-22T19:00:00.000Z',
    ...overrides,
  };
}

describe('FoodMenus sync domain helpers', () => {
  it('selects active food or mixed menus and counts their section items', () => {
    const food = makeMenu('food', {
      sections: [{ items: [{ id: 'item-1' }, { id: 'item-2' }] }, { items: [{ id: 'item-3' }] }],
    } as Partial<CanonicalRestaurantMenu>);
    const mixed = makeMenu('mixed', {
      menuKind: 'mixed',
      sections: [{ items: [{ id: 'item-4' }] }],
    } as Partial<CanonicalRestaurantMenu>);
    const inactive = makeMenu('inactive', { active: false });
    const drinks = makeMenu('drinks', { menuKind: 'drink' });

    const publishable = selectCanonicalPublishableFoodMenus([food, mixed, inactive, drinks]);

    expect(publishable.map((menu) => menu.id)).toEqual(['food', 'mixed']);
    expect(countCanonicalFoodMenuItems(publishable)).toBe(4);
  });

  it('builds import review settings from stored FoodMenus settings', () => {
    const settings: FoodMenuSettings = {
      restaurantId: 'rest-1',
      menuLabel: 'Dinner',
      sourceUrl: 'https://example.com/menu',
      cuisines: ['INDIAN'],
      languageCode: 'en-GB',
      updatedAt: '2026-05-22T19:00:00.000Z',
    };

    expect(buildFoodMenusImportReviewSettings(settings)).toEqual({
      menuLabel: 'Dinner',
      sourceUrl: 'https://example.com/menu',
      cuisines: ['INDIAN'],
      languageCode: 'en-GB',
    });
    expect(buildFoodMenusImportReviewSettings(null)).toBeNull();
  });

  it('resolves import-review decision plans for supported action classes', () => {
    expect(resolveFoodMenusImportReviewDecisionPlan(makeReview(), 'ignore_google_change')).toEqual({
      kind: 'ignore_google_change',
    });

    expect(
      resolveFoodMenusImportReviewDecisionPlan(
        makeReview({
          localItemId: null,
          matchStatus: 'menu_metadata',
          suggestedPatch: {
            menuLabel: 'Dinner',
            cuisines: ['INDIAN'],
          },
        }),
        'apply_menu_metadata',
      ),
    ).toEqual({
      kind: 'apply_menu_metadata',
      metadataPatch: {
        menuLabel: 'Dinner',
        cuisines: ['INDIAN'],
      },
    });

    expect(
      resolveFoodMenusImportReviewDecisionPlan(
        makeReview({ matchStatus: 'missing_from_google' }),
        'mark_sold_out',
      ),
    ).toEqual({
      kind: 'missing_local_item',
      action: 'mark_sold_out',
      localItemId: 'item-1',
    });

    expect(
      resolveFoodMenusImportReviewDecisionPlan(
        makeReview({
          localItemId: null,
          matchStatus: 'unmatched',
          suggestedPatch: {
            externalItemId: 'google-paneer',
            itemName: 'Google Paneer',
            category: 'Starters',
            basePrice: 10,
          },
        }),
        'create_new_item',
      ),
    ).toEqual({
      kind: 'create_new_item',
      targetKind: 'food',
      suggestedPatch: {
        externalItemId: 'google-paneer',
        itemName: 'Google Paneer',
        category: 'Starters',
        basePrice: 10,
      },
    });

    expect(
      resolveFoodMenusImportReviewDecisionPlan(makeReview(), 'apply_to_nabatable'),
    ).toMatchObject({
      kind: 'apply_to_nabatable',
      localItemId: 'item-1',
      suggestedPatch: {
        itemName: 'Paneer',
        shortDescription: 'Google description',
        basePrice: 9.5,
        currency: 'GBP',
      },
    });
  });

  it('rejects not-applicable import-review decision actions with stable errors', () => {
    expect(() =>
      resolveFoodMenusImportReviewDecisionPlan(makeReview(), 'apply_menu_metadata'),
    ).toThrow('FoodMenus import review does not contain menu metadata.');
    expect(() => resolveFoodMenusImportReviewDecisionPlan(makeReview(), 'mark_inactive')).toThrow(
      'FoodMenus import review is not a missing local item.',
    );
    expect(() =>
      resolveFoodMenusImportReviewDecisionPlan(
        makeReview({ matchStatus: 'unmatched' }),
        'create_new_item',
      ),
    ).toThrow('FoodMenus import review does not contain a safe new item suggestion.');
    expect(() =>
      resolveFoodMenusImportReviewDecisionPlan(
        makeReview({ localItemId: null, suggestedPatch: null }),
        'apply_to_nabatable',
      ),
    ).toThrow('FoodMenus import review has no matched local item or suggested patch.');
  });

  it('merges menu metadata patches with current settings', () => {
    const currentSettings: FoodMenuSettings = {
      restaurantId: 'rest-1',
      menuLabel: 'Current menu',
      sourceUrl: 'https://example.com/current',
      cuisines: ['BRITISH'],
      languageCode: 'en-GB',
      updatedAt: '2026-05-22T19:00:00.000Z',
    };

    expect(
      buildFoodMenuSettingsUpdateFromMetadataPatch(currentSettings, {
        menuLabel: 'Google menu',
        cuisines: ['INDIAN'],
      }),
    ).toEqual({
      menuLabel: 'Google menu',
      sourceUrl: 'https://example.com/current',
      cuisines: ['INDIAN'],
      languageCode: 'en-GB',
    });
  });

  it('resolves publish preflight hash decisions in guard order', () => {
    expect(
      resolveFoodMenusPublishPreflightHashDecision({
        baselineGoogleHash: 'google-current',
        projectionHash: 'projection-current',
        expectedGoogleHash: null,
        expectedProjectionHash: undefined,
      }),
    ).toEqual({ status: 'ready' });

    expect(
      resolveFoodMenusPublishPreflightHashDecision({
        baselineGoogleHash: 'google-current',
        projectionHash: 'projection-current',
        expectedGoogleHash: 'google-current',
        expectedProjectionHash: 'projection-current',
      }),
    ).toEqual({ status: 'ready' });

    expect(
      resolveFoodMenusPublishPreflightHashDecision({
        baselineGoogleHash: 'google-current',
        projectionHash: 'projection-current',
        expectedGoogleHash: 'google-stale',
        expectedProjectionHash: 'projection-stale',
      }),
    ).toEqual({
      status: 'failed',
      kind: 'baseline_changed',
      errorCode: 'baseline_changed',
      errorMessage: 'Google FoodMenus changed since the expected baseline.',
      baselineGoogleHash: 'google-current',
      expectedGoogleHash: 'google-stale',
    });

    expect(
      resolveFoodMenusPublishPreflightHashDecision({
        baselineGoogleHash: 'google-current',
        projectionHash: 'projection-current',
        expectedGoogleHash: 'google-current',
        expectedProjectionHash: 'projection-stale',
      }),
    ).toEqual({
      status: 'failed',
      kind: 'projection_changed',
      errorCode: 'projection_changed',
      errorMessage: 'Nabatable FoodMenus projection changed since the expected baseline.',
      projectionHash: 'projection-current',
      expectedProjectionHash: 'projection-stale',
    });
  });

  it('maps only projected identity rows that still have local item ids', () => {
    const rows: FoodMenusProjectedIdentityRecord[] = [
      {
        id: 'identity-1',
        restaurantId: 'rest-1',
        snapshotId: 'snapshot-1',
        localItemId: 'item-1',
        externalItemId: 'external-1',
        stableKey: 'stable-1',
        itemName: 'Paneer',
        sectionKey: 'starters',
        sectionLabel: 'Starters',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: ['menus[0].sections[0].items[0].options[0]'],
        createdAt: '2026-05-22T19:00:00.000Z',
      },
      {
        id: 'identity-2',
        restaurantId: 'rest-1',
        snapshotId: 'snapshot-1',
        localItemId: null,
        externalItemId: 'external-2',
        stableKey: 'stable-2',
        itemName: 'Detached',
        sectionKey: 'starters',
        sectionLabel: 'Starters',
        googlePath: 'menus[0].sections[0].items[1]',
        googleOptionPaths: [],
        createdAt: '2026-05-22T19:00:00.000Z',
      },
    ];

    expect(mapProjectedFoodMenusIdentityRows(rows)).toEqual([
      {
        stableKey: 'stable-1',
        localItemId: 'item-1',
        externalItemId: 'external-1',
        itemName: 'Paneer',
        sectionKey: 'starters',
        sectionLabel: 'Starters',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: ['menus[0].sections[0].items[0].options[0]'],
      },
    ]);
  });

  it('creates baseline and projection preflight errors with attached context', () => {
    const baselineError = createFoodMenusBaselineChangedError({
      baselineGoogleHash: 'current-google',
      expectedGoogleHash: 'expected-google',
      attempt,
      baselineGoogleSnapshot: snapshot,
      projection: { projectionHash: 'projection-hash' },
    });

    expect(baselineError).toMatchObject({
      name: 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED',
      message: 'Google FoodMenus changed since the expected baseline.',
      baselineGoogleHash: 'current-google',
      expectedGoogleHash: 'expected-google',
      attempt,
      baselineGoogleSnapshot: snapshot,
      projection: { projectionHash: 'projection-hash' },
    });

    const projectionError = createFoodMenusProjectionChangedError({
      projectionHash: 'current-projection',
      expectedProjectionHash: 'expected-projection',
      baselineGoogleHash: 'current-google',
      attempt,
      baselineGoogleSnapshot: snapshot,
      projection: { projectionHash: 'current-projection' },
    });

    expect(projectionError).toMatchObject({
      name: 'GBP_FOOD_MENUS_PROJECTION_CHANGED',
      message: 'Nabatable FoodMenus projection changed since the expected baseline.',
      projectionHash: 'current-projection',
      expectedProjectionHash: 'expected-projection',
    });
  });

  it('normalizes publish failures while preserving custom error names', () => {
    const googleError = new Error('Google rejected menu');
    googleError.name = 'GOOGLE_REJECTED';

    expect(normalizeFoodMenusPublishFailure(googleError)).toEqual({
      publishError: googleError,
      errorCode: 'GOOGLE_REJECTED',
      errorMessage: 'Google rejected menu',
    });

    const genericError = new Error('Generic failure');
    const generic = normalizeFoodMenusPublishFailure(genericError);
    expect(generic.publishError).toBe(genericError);
    expect(generic.publishError.name).toBe('GBP_FOOD_MENUS_PUBLISH_FAILED');
    expect(generic.errorCode).toBe('Error');
    expect(generic.errorMessage).toBe('Generic failure');

    const unknown = normalizeFoodMenusPublishFailure('nope');
    expect(unknown.publishError).toMatchObject({
      name: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
      message: 'Unable to publish Google FoodMenus.',
    });
    expect(unknown.errorCode).toBe('GBP_FOOD_MENUS_PUBLISH_FAILED');
  });
});
