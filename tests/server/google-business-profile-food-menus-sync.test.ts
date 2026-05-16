import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCanonicalFoodMenusImportItemsMock = vi.hoisted(() => vi.fn());
const applyCanonicalFoodMenusSuggestedPatchMock = vi.hoisted(() => vi.fn());
const createCanonicalFoodMenusItemFromPatchMock = vi.hoisted(() => vi.fn());
const decideCanonicalMissingLocalFoodMenusItemMock = vi.hoisted(() => vi.fn());
const getGoogleBusinessProfileFoodMenusMock = vi.hoisted(() => vi.fn());
const updateGoogleBusinessProfileFoodMenusMock = vi.hoisted(() => vi.fn());
const recordFoodMenusProjectionMock = vi.hoisted(() => vi.fn());
const readLatestFoodMenusSnapshotMock = vi.hoisted(() => vi.fn());
const listProjectedFoodMenusIdentitiesMock = vi.hoisted(() => vi.fn());
const recordFoodMenusSnapshotMock = vi.hoisted(() => vi.fn());
const replacePendingFoodMenusImportReviewsMock = vi.hoisted(() => vi.fn());
const readFoodMenusImportReviewForRestaurantMock = vi.hoisted(() => vi.fn());
const claimFoodMenusImportReviewDecisionMock = vi.hoisted(() => vi.fn());
const markFoodMenusImportReviewDecisionMock = vi.hoisted(() => vi.fn());
const openFoodMenusPublishAttemptMock = vi.hoisted(() => vi.fn());
const markFoodMenusPublishAttemptRunningMock = vi.hoisted(() => vi.fn());
const finishFoodMenusPublishAttemptMock = vi.hoisted(() => vi.fn());
const readFoodMenuSettingsMock = vi.hoisted(() => vi.fn());
const upsertFoodMenuSettingsMock = vi.hoisted(() => vi.fn());
const listRestaurantMenuHierarchyMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/food-menus-canonical-adapter', () => ({
  applyCanonicalFoodMenusSuggestedPatch: applyCanonicalFoodMenusSuggestedPatchMock,
  createCanonicalFoodMenusItemFromPatch: createCanonicalFoodMenusItemFromPatchMock,
  decideCanonicalMissingLocalFoodMenusItem: decideCanonicalMissingLocalFoodMenusItemMock,
  listCanonicalFoodMenusImportItems: listCanonicalFoodMenusImportItemsMock,
}));

vi.mock('@/server/menu-hierarchy/repository', () => ({
  listRestaurantMenuHierarchy: listRestaurantMenuHierarchyMock,
}));

vi.mock('@/server/google-business-profile/client', () => ({
  getGoogleBusinessProfileFoodMenus: getGoogleBusinessProfileFoodMenusMock,
  updateGoogleBusinessProfileFoodMenus: updateGoogleBusinessProfileFoodMenusMock,
}));

vi.mock('@/server/google-business-profile/food-menus-storage', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    recordFoodMenusProjection: recordFoodMenusProjectionMock,
    readLatestFoodMenusSnapshot: readLatestFoodMenusSnapshotMock,
    listProjectedFoodMenusIdentities: listProjectedFoodMenusIdentitiesMock,
    recordFoodMenusSnapshot: recordFoodMenusSnapshotMock,
    replacePendingFoodMenusImportReviews: replacePendingFoodMenusImportReviewsMock,
    readFoodMenusImportReviewForRestaurant: readFoodMenusImportReviewForRestaurantMock,
    claimFoodMenusImportReviewDecision: claimFoodMenusImportReviewDecisionMock,
    markFoodMenusImportReviewDecision: markFoodMenusImportReviewDecisionMock,
    openFoodMenusPublishAttempt: openFoodMenusPublishAttemptMock,
    markFoodMenusPublishAttemptRunning: markFoodMenusPublishAttemptRunningMock,
    finishFoodMenusPublishAttempt: finishFoodMenusPublishAttemptMock,
    readFoodMenuSettings: readFoodMenuSettingsMock,
    upsertFoodMenuSettings: upsertFoodMenuSettingsMock,
  };
});

import {
  decideFoodMenusImportReview,
  publishFoodMenusProjectionToGoogle,
  prepareFoodMenusImportReview,
  prepareFoodMenusProjection,
  refreshFoodMenusImportReviewFromGoogle,
} from '@/server/google-business-profile/food-menus-sync';

import type {
  FoodMenusLocalItem,
  GoogleFoodMenusResource,
} from '@/server/google-business-profile/food-menus';
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
} from '@/server/menu-hierarchy/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeMenuItem(overrides: Partial<FoodMenusLocalItem> = {}): FoodMenusLocalItem {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    externalItemId: 'starter-paneer',
    itemName: 'Chilli Paneer',
    category: 'Starters',
    subcategory: 'Vegetarian',
    shortDescription: 'Crisp paneer tossed with peppers and chilli sauce.',
    fullDescription: 'A richer internal description that remains in Nabatable.',
    basePrice: 8.95,
    currency: 'GBP',
    serviceTime: 'Dinner',
    availabilityStatus: 'available',
    keyIngredients: ['Paneer', 'Peppers', 'Chilli'],
    mainProteinOrBase: 'Paneer',
    cookingStyle: 'Stir fried',
    preparationMethod: 'Fried',
    flavorProfile: 'Savoury',
    texture: 'Crisp',
    spiceLevel: 'Medium',
    spiceAdjustable: true,
    portionSize: 'starter plate',
    shareable: true,
    recommendationTags: ['signature'],
    pairings: ['Lager'],
    signatureScore: 95,
    popularityScore: 80,
    dietaryTags: ['Vegetarian'],
    allergensContains: ['Milk', 'Wheat'],
    allergensMayContain: ['Nuts'],
    removableIngredients: ['Chilli'],
    substitutionsAllowed: true,
    canBeMadeVegetarian: true,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: 'Can reduce spice.',
    servingNotes: 'Serve hot.',
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: 10,
    imageUrl: null,
    caloriesKcal: null,
    proteinG: null,
    fatG: null,
    saturatedFatG: null,
    carbsG: null,
    sugarG: null,
    fiberG: null,
    sodiumMg: null,
    servesNum: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    modifierGroups: [],
    ...overrides,
  };
}

function makeCanonicalItem(
  item: FoodMenusLocalItem,
  overrides: Partial<CanonicalRestaurantMenuItem> = {},
): CanonicalRestaurantMenuItem {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    menuId: 'menu-1',
    sectionId: 'section-1',
    itemKind: item.targetKind ?? 'food',
    externalItemId: item.externalItemId,
    legacySource: {},
    labels: [
      {
        displayName: item.itemName,
        description: item.shortDescription,
        languageCode: 'en-GB',
      },
    ],
    attributes: {
      price: { currencyCode: item.currency, amount: item.basePrice },
      spiciness: null,
      allergen: [],
      dietaryRestriction: item.dietaryTags.includes('Vegetarian') ? ['VEGETARIAN'] : [],
      ingredients: [],
      preparationMethods: [],
      mediaKeys: [],
      nutritionFacts: {},
    },
    media: { googleMediaKeys: [], localMedia: {}, localImageUrl: item.imageUrl ?? undefined },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {},
      availabilityPolicy: { soldOut: item.soldOut },
      customizationControls: {},
      sourceMetadata: {},
    },
    options: [],
    displayOrder: item.displayOrder,
    active: item.active,
    ...overrides,
  };
}

function makeCanonicalMenu(
  items: FoodMenusLocalItem[] = [makeMenuItem()],
): CanonicalRestaurantMenu {
  return {
    id: 'menu-1',
    restaurantId: 'rest-1',
    labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
    sourceUrl: null,
    cuisines: [],
    defaultLanguageCode: 'en-GB',
    menuKind: 'food',
    displayOrder: 0,
    active: true,
    legacySource: {},
    sections: [
      {
        id: 'section-1',
        restaurantId: 'rest-1',
        menuId: 'menu-1',
        labels: [{ displayName: 'Starters - Vegetarian', languageCode: 'en-GB' }],
        displayOrder: 0,
        active: true,
        legacyCategory: 'Starters',
        legacySubcategory: 'Vegetarian',
        legacySource: {},
        items: items.map((item) => makeCanonicalItem(item)),
      },
    ],
  };
}

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-1',
    restaurantId: 'rest-1',
    externalProfileId: null,
    provider: 'google_business_profile',
    snapshotKind: 'nabatable_projection',
    source: 'manual',
    status: 'succeeded',
    foodMenusName: 'accounts/123/locations/456/foodMenus',
    rawFoodMenus: null,
    canonicalFoodMenus: null,
    projectionMetadata: {},
    snapshotHash: 'hash-1',
    googleEtag: null,
    errorCode: null,
    errorMessage: null,
    pulledAt: null,
    createdByUserId: null,
    createdAt: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    restaurantId: 'rest-1',
    googleSnapshotId: 'google-snapshot-1',
    projectionSnapshotId: 'projection-snapshot-1',
    localItemId: 'item-1',
    externalItemId: 'starter-paneer',
    targetKind: 'food',
    googlePath: 'menus[0].sections[0].items[0]',
    googleSectionLabel: 'Starters - Vegetarian',
    googleItemName: 'Chilli Paneer',
    matchStatus: 'matched',
    matchConfidence: 'previous_identity',
    suggestedPatch: {
      itemName: 'Chilli Paneer',
      shortDescription: 'Google-side description',
      basePrice: 9.5,
      currency: 'gbp',
      spiceLevel: 'Hot',
      preparationMethod: 'Grilled',
      portionSize: 'large plate',
      keyIngredients: ['Paneer', 'Chilli'],
      caloriesKcal: 450,
      proteinG: 17,
      sodiumMg: 850,
      servesNum: 2,
      dietaryTags: ['Vegetarian'],
      allergensContains: ['Milk'],
    },
    warnings: [],
    decisionStatus: 'pending',
    decisionAction: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: '2026-05-02T18:00:00.000Z',
    updatedAt: '2026-05-02T18:00:00.000Z',
    ...overrides,
  };
}

const googleFoodMenus: GoogleFoodMenusResource = {
  name: 'accounts/123/locations/456/foodMenus',
  menus: [
    {
      labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
      sections: [
        {
          labels: [{ displayName: 'Starters - Vegetarian', languageCode: 'en-GB' }],
          items: [
            {
              labels: [
                {
                  displayName: 'Chilli Paneer',
                  description: 'Google-side description',
                  languageCode: 'en-GB',
                },
              ],
              attributes: { price: { currencyCode: 'GBP', units: '9', nanos: 500000000 } },
            },
          ],
        },
      ],
    },
  ],
};

describe('GBP FoodMenus sync service', () => {
  beforeEach(() => {
    listCanonicalFoodMenusImportItemsMock.mockReset();
    applyCanonicalFoodMenusSuggestedPatchMock.mockReset();
    createCanonicalFoodMenusItemFromPatchMock.mockReset();
    decideCanonicalMissingLocalFoodMenusItemMock.mockReset();
    recordFoodMenusProjectionMock.mockReset();
    readLatestFoodMenusSnapshotMock.mockReset();
    listProjectedFoodMenusIdentitiesMock.mockReset();
    recordFoodMenusSnapshotMock.mockReset();
    replacePendingFoodMenusImportReviewsMock.mockReset();
    readFoodMenusImportReviewForRestaurantMock.mockReset();
    claimFoodMenusImportReviewDecisionMock.mockReset();
    markFoodMenusImportReviewDecisionMock.mockReset();
    getGoogleBusinessProfileFoodMenusMock.mockReset();
    updateGoogleBusinessProfileFoodMenusMock.mockReset();
    openFoodMenusPublishAttemptMock.mockReset();
    markFoodMenusPublishAttemptRunningMock.mockReset();
    finishFoodMenusPublishAttemptMock.mockReset();
    readFoodMenuSettingsMock.mockReset();
    upsertFoodMenuSettingsMock.mockReset();
    listRestaurantMenuHierarchyMock.mockReset();
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    claimFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        decisionStatus: 'processing',
        decisionAction: 'apply_to_nabatable',
        decidedByUserId: 'user-1',
      }),
    );
    readFoodMenuSettingsMock.mockResolvedValue(null);
    listRestaurantMenuHierarchyMock.mockResolvedValue({ menus: [makeCanonicalMenu()] });
  });

  it('builds and persists a deterministic Nabatable projection snapshot from canonical menus', async () => {
    listRestaurantMenuHierarchyMock.mockResolvedValue({
      menus: [
        makeCanonicalMenu([
          makeMenuItem(),
          makeMenuItem({
            id: 'item-2',
            externalItemId: 'sold-out',
            itemName: 'Sold out dish',
            soldOut: true,
          }),
        ]),
      ],
    });
    recordFoodMenusProjectionMock.mockResolvedValue({
      snapshot: makeSnapshot({ snapshotHash: 'projection-hash' }),
      identities: [
        {
          id: 'identity-1',
          restaurantId: 'rest-1',
          snapshotId: 'snapshot-1',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
          stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
          itemName: 'Chilli Paneer',
          sectionKey: 'starters/vegetarian',
          sectionLabel: 'Starters - Vegetarian',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
          createdAt: '2026-05-02T18:00:00.000Z',
        },
      ],
    });

    const result = await prepareFoodMenusProjection({
      client,
      restaurantId: 'rest-1',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: 'Dinner menu',
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });

    expect(listRestaurantMenuHierarchyMock).toHaveBeenCalledWith('rest-1', client);
    expect(result.localItemCount).toBe(2);
    expect(result.projection.skippedItems).toEqual([
      { localItemId: 'item-2', externalItemId: 'sold-out', reason: 'sold_out' },
    ]);
    expect(result.projectionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(recordFoodMenusProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        externalProfileId: 'profile-1',
        createdByUserId: 'user-1',
        snapshotHash: result.projectionHash,
        projection: result.projection,
      }),
    );
    expect(result.identities).toHaveLength(1);
  });

  it('can build a projection without writing audit rows', async () => {
    const result = await prepareFoodMenusProjection({
      client,
      restaurantId: 'rest-1',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      persist: false,
    });

    expect(recordFoodMenusProjectionMock).not.toHaveBeenCalled();
    expect(result.snapshot).toBeNull();
    expect(result.identities).toEqual([]);
    expect(result.projection.identities[0]?.localItemId).toBe('item-1');
  });

  it('projects active canonical food menus', async () => {
    listRestaurantMenuHierarchyMock.mockResolvedValue({
      menus: [
        {
          id: 'menu-1',
          restaurantId: 'rest-1',
          labels: [{ displayName: 'Canonical dinner', languageCode: 'en-GB' }],
          sourceUrl: null,
          cuisines: ['INDIAN'],
          defaultLanguageCode: 'en-GB',
          menuKind: 'food',
          displayOrder: 0,
          active: true,
          legacySource: {},
          sections: [
            {
              id: 'section-1',
              restaurantId: 'rest-1',
              menuId: 'menu-1',
              labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
              displayOrder: 0,
              active: true,
              legacyCategory: 'Starters',
              legacySubcategory: null,
              legacySource: {},
              items: [
                {
                  id: 'canonical-item-1',
                  restaurantId: 'rest-1',
                  menuId: 'menu-1',
                  sectionId: 'section-1',
                  itemKind: 'food',
                  externalItemId: 'canonical-paneer',
                  legacySource: {},
                  labels: [{ displayName: 'Canonical Paneer', languageCode: 'en-GB' }],
                  attributes: {
                    price: { currencyCode: 'GBP', amount: 11 },
                    spiciness: null,
                    allergen: [],
                    dietaryRestriction: [],
                    ingredients: [],
                    preparationMethods: [],
                    mediaKeys: [],
                    nutritionFacts: {},
                  },
                  media: { googleMediaKeys: [], localMedia: {} },
                  extensions: {
                    drinkProfile: {},
                    recommendationMetadata: {},
                    availabilityPolicy: {},
                    customizationControls: {},
                    sourceMetadata: {},
                  },
                  options: [],
                  displayOrder: 0,
                  active: true,
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await prepareFoodMenusProjection({
      client,
      restaurantId: 'rest-1',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      persist: false,
    });

    expect(result.localItemCount).toBe(1);
    expect(result.projection.foodMenus.menus[0]?.labels[0]?.displayName).toBe('Canonical dinner');
    expect(result.projection.identities[0]?.googlePath).toBe('menus[0].sections[0].items[0]');
  });

  it('creates a non-mutating import review using explicit previous identities', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);

    const result = await prepareFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      googleFoodMenus,
      previousIdentities: [
        {
          stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
          itemName: 'Chilli Paneer',
          sectionKey: 'starters/vegetarian',
          sectionLabel: 'Starters - Vegetarian',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
        },
      ],
      persist: false,
    });

    const matchedRow = result.review.items.find((item) => item.match.status === 'matched');
    expect(matchedRow?.match).toEqual({
      status: 'matched',
      confidence: 'previous_identity',
      localItemId: 'item-1',
      externalItemId: 'starter-paneer',
    });
    expect(matchedRow?.suggestedPatch).toEqual({
      shortDescription: 'Google-side description',
      basePrice: 9.5,
    });
    expect(recordFoodMenusSnapshotMock).not.toHaveBeenCalled();
    expect(replacePendingFoodMenusImportReviewsMock).not.toHaveBeenCalled();
  });

  it('uses the latest projection identities, records the Google pull, and replaces pending suggestions', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    readLatestFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({ id: 'projection-snapshot-1' }),
    );
    listProjectedFoodMenusIdentitiesMock.mockResolvedValue([
      {
        id: 'identity-1',
        restaurantId: 'rest-1',
        snapshotId: 'projection-snapshot-1',
        localItemId: 'item-1',
        externalItemId: 'starter-paneer',
        stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
        itemName: 'Chilli Paneer',
        sectionKey: 'starters/vegetarian',
        sectionLabel: 'Starters - Vegetarian',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: [],
        createdAt: '2026-05-02T18:00:00.000Z',
      },
    ]);
    recordFoodMenusSnapshotMock.mockResolvedValue(makeSnapshot({ id: 'google-snapshot-1' }));
    replacePendingFoodMenusImportReviewsMock.mockResolvedValue([
      {
        id: 'review-1',
        restaurantId: 'rest-1',
        googleSnapshotId: 'google-snapshot-1',
        projectionSnapshotId: 'projection-snapshot-1',
        localItemId: 'item-1',
        externalItemId: 'starter-paneer',
        googlePath: 'menus[0].sections[0].items[0]',
        googleSectionLabel: 'Starters - Vegetarian',
        googleItemName: 'Chilli Paneer',
        matchStatus: 'matched',
        matchConfidence: 'previous_identity',
        suggestedPatch: { basePrice: 9.5 },
        warnings: [],
        decisionStatus: 'pending',
        decisionAction: null,
        decidedByUserId: null,
        decidedAt: null,
        createdAt: '2026-05-02T18:00:00.000Z',
        updatedAt: '2026-05-02T18:00:00.000Z',
      },
    ]);

    const result = await prepareFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      googleFoodMenus,
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });

    expect(readLatestFoodMenusSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      snapshotKind: 'nabatable_projection',
    });
    expect(listProjectedFoodMenusIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      snapshotId: 'projection-snapshot-1',
    });
    expect(recordFoodMenusSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        externalProfileId: 'profile-1',
        snapshotKind: 'google_pull',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        rawFoodMenus: googleFoodMenus,
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdByUserId: 'user-1',
      }),
    );
    expect(replacePendingFoodMenusImportReviewsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      googleSnapshotId: 'google-snapshot-1',
      projectionSnapshotId: 'projection-snapshot-1',
      review: result.review,
    });
    expect(result.previousIdentityCount).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

  it('refreshes Google FoodMenus server-side before creating a non-mutating import review', async () => {
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    readLatestFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({ id: 'projection-snapshot-1' }),
    );
    listProjectedFoodMenusIdentitiesMock.mockResolvedValue([
      {
        id: 'identity-1',
        restaurantId: 'rest-1',
        snapshotId: 'projection-snapshot-1',
        localItemId: 'item-1',
        externalItemId: 'starter-paneer',
        stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
        itemName: 'Chilli Paneer',
        sectionKey: 'starters/vegetarian',
        sectionLabel: 'Starters - Vegetarian',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: [],
        createdAt: '2026-05-02T18:00:00.000Z',
      },
    ]);
    recordFoodMenusSnapshotMock.mockResolvedValue(makeSnapshot({ id: 'google-snapshot-1' }));
    replacePendingFoodMenusImportReviewsMock.mockResolvedValue([
      makeReview({ id: 'review-1', suggestedPatch: { basePrice: 9.5 } }),
    ]);

    const result = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId: 'rest-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });

    expect(getGoogleBusinessProfileFoodMenusMock).toHaveBeenCalledWith(
      'access-token',
      'accounts/123/locations/456/foodMenus',
      { readMask: ['name', 'menus'] },
    );
    expect(recordFoodMenusSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalProfileId: 'profile-1',
        snapshotKind: 'google_pull',
        source: 'manual',
        rawFoodMenus: googleFoodMenus,
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdByUserId: 'user-1',
      }),
    );
    expect(result.googleFoodMenus).toBe(googleFoodMenus);
    expect(result.googleFoodMenusHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.importReview.rows).toHaveLength(1);
  });

  it('refreshes deleted Google FoodMenus resources when Google omits the menus array', async () => {
    const emptyGoogleFoodMenus = {
      name: 'accounts/123/locations/456/foodMenus',
    } as GoogleFoodMenusResource;
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(emptyGoogleFoodMenus);
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    readLatestFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({ id: 'projection-snapshot-1' }),
    );
    listProjectedFoodMenusIdentitiesMock.mockResolvedValue([]);
    recordFoodMenusSnapshotMock.mockResolvedValue(makeSnapshot({ id: 'google-snapshot-empty' }));
    replacePendingFoodMenusImportReviewsMock.mockResolvedValue([
      makeReview({ id: 'review-missing', matchStatus: 'missing_from_google' }),
    ]);

    const result = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId: 'rest-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });

    expect(recordFoodMenusSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rawFoodMenus: emptyGoogleFoodMenus,
        canonicalFoodMenus: {
          name: 'accounts/123/locations/456/foodMenus',
          menus: [],
        },
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(replacePendingFoodMenusImportReviewsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        review: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              match: expect.objectContaining({ status: 'missing_from_google' }),
            }),
          ]),
        }),
      }),
    );
    expect(result.googleFoodMenusHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.importReview.rows).toHaveLength(1);
  });

  it('applies an explicitly approved suggested patch while preserving rich local fields and modifiers', async () => {
    const current = makeMenuItem({
      fullDescription: 'Keep the richer local description.',
      keyIngredients: ['Paneer', 'Pepper'],
      allergensMayContain: ['Nuts'],
      modifierGroups: [
        {
          id: 'group-1',
          restaurantId: 'rest-1',
          menuItemId: 'item-1',
          externalModifierGroupId: 'heat',
          groupName: 'Heat',
          required: false,
          minSelect: 0,
          maxSelect: 1,
          displayOrder: 1,
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          options: [
            {
              id: 'option-1',
              restaurantId: 'rest-1',
              modifierGroupId: 'group-1',
              externalModifierOptionId: 'mild',
              optionName: 'Mild',
              priceDelta: 0,
              defaultSelected: true,
              availabilityStatus: 'available',
              displayOrder: 1,
              createdAt: '2026-05-01T10:00:00.000Z',
              updatedAt: '2026-05-01T10:00:00.000Z',
            },
          ],
        },
      ],
    });
    const applied = makeReview({
      decisionStatus: 'applied',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(makeReview());
    const updatedItem = makeCanonicalItem({
      ...current,
      shortDescription: 'Google-side description',
      basePrice: 9.5,
    });
    applyCanonicalFoodMenusSuggestedPatchMock.mockResolvedValue(updatedItem);
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(applied);

    const result = await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });

    expect(applyCanonicalFoodMenusSuggestedPatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      localItemId: 'item-1',
      reviewId: 'review-1',
      suggestedPatch: expect.objectContaining({
        shortDescription: 'Google-side description',
        basePrice: 9.5,
        keyIngredients: ['Paneer', 'Chilli'],
        spiceLevel: 'Hot',
        preparationMethod: 'Grilled',
        portionSize: 'large plate',
        caloriesKcal: 450,
        proteinG: 17,
        sodiumMg: 850,
        servesNum: 2,
      }),
    });
    expect(claimFoodMenusImportReviewDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    expect(markFoodMenusImportReviewDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionStatus: 'applied',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: 'user-1',
    });
    expect(result.review.decisionStatus).toBe('applied');
    expect(result.item).toBe(updatedItem);
  });

  it('does not apply FoodMenus side effects when the pending decision claim is lost', async () => {
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(makeReview());
    claimFoodMenusImportReviewDecisionMock.mockRejectedValue(
      new Error('restaurant_gbp_food_menu_import_reviews claim failed for review-1'),
    );

    await expect(
      decideFoodMenusImportReview({
        client,
        restaurantId: 'rest-1',
        reviewId: 'review-1',
        action: 'apply_to_nabatable',
        decidedByUserId: 'user-1',
      }),
    ).rejects.toThrow('claim failed');

    expect(applyCanonicalFoodMenusSuggestedPatchMock).not.toHaveBeenCalled();
    expect(createCanonicalFoodMenusItemFromPatchMock).not.toHaveBeenCalled();
    expect(decideCanonicalMissingLocalFoodMenusItemMock).not.toHaveBeenCalled();
    expect(markFoodMenusImportReviewDecisionMock).not.toHaveBeenCalled();
  });

  it('records an explicit ignore decision without mutating the menu item', async () => {
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(makeReview());
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        decisionStatus: 'ignored',
        decisionAction: 'ignore_google_change',
        decidedByUserId: 'user-1',
      }),
    );

    const result = await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'ignore_google_change',
      decidedByUserId: 'user-1',
    });

    expect(applyCanonicalFoodMenusSuggestedPatchMock).not.toHaveBeenCalled();
    expect(createCanonicalFoodMenusItemFromPatchMock).not.toHaveBeenCalled();
    expect(markFoodMenusImportReviewDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionStatus: 'ignored',
      decisionAction: 'ignore_google_change',
      decidedByUserId: 'user-1',
    });
    expect(result.item).toBeNull();
    expect(result.review.decisionStatus).toBe('ignored');
  });

  it('applies menu metadata suggestions through the settings store only after approval', async () => {
    const metadataReview = makeReview({
      localItemId: null,
      externalItemId: null,
      targetKind: 'food',
      googlePath: 'menus[0].metadata',
      googleSectionLabel: null,
      googleItemName: 'Dinner menu',
      matchStatus: 'menu_metadata',
      matchConfidence: 'none',
      suggestedPatch: {
        menuLabel: 'Dinner menu',
        cuisines: ['INDIAN'],
      },
    });
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(metadataReview);
    readFoodMenuSettingsMock.mockResolvedValue({
      restaurantId: 'rest-1',
      menuLabel: 'Food menu',
      sourceUrl: 'https://example.com/menu',
      cuisines: [],
      languageCode: 'en-GB',
      updatedAt: '2026-05-02T18:00:00.000Z',
    });
    upsertFoodMenuSettingsMock.mockResolvedValue({});
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        ...metadataReview,
        decisionStatus: 'applied',
        decisionAction: 'apply_menu_metadata',
      }),
    );

    const result = await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'apply_menu_metadata',
      decidedByUserId: 'user-1',
    });

    expect(upsertFoodMenuSettingsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      menuLabel: 'Dinner menu',
      sourceUrl: 'https://example.com/menu',
      cuisines: ['INDIAN'],
      languageCode: 'en-GB',
    });
    expect(applyCanonicalFoodMenusSuggestedPatchMock).not.toHaveBeenCalled();
    expect(result.item).toBeNull();
  });

  it('marks a missing local food item inactive through an explicit delete-handling action', async () => {
    const current = makeMenuItem({ active: true });
    const missingReview = makeReview({
      matchStatus: 'missing_from_google',
      matchConfidence: 'none',
      suggestedPatch: null,
      googlePath: null,
      googleItemName: 'Chilli Paneer',
    });
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(missingReview);
    decideCanonicalMissingLocalFoodMenusItemMock.mockResolvedValue(
      makeCanonicalItem({ ...current, active: false }),
    );
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        ...missingReview,
        decisionStatus: 'applied',
        decisionAction: 'mark_inactive',
      }),
    );

    await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'mark_inactive',
      decidedByUserId: 'user-1',
    });

    expect(decideCanonicalMissingLocalFoodMenusItemMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      localItemId: 'item-1',
      action: 'mark_inactive',
      reviewId: 'review-1',
    });
    expect(markFoodMenusImportReviewDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisionAction: 'mark_inactive' }),
    );
  });

  it('routes drink create suggestions to the canonical hierarchy adapter', async () => {
    const drinkReview = makeReview({
      localItemId: null,
      externalItemId: null,
      targetKind: 'drink',
      googlePath: 'menus[0].sections[0].items[0]',
      googleSectionLabel: 'Cocktails',
      googleItemName: 'Google Spritz',
      matchStatus: 'unmatched',
      matchConfidence: 'none',
      suggestedPatch: {
        externalItemId: 'gbp-drink',
        itemName: 'Google Spritz',
        category: 'Cocktails',
        basePrice: 9,
        currency: 'GBP',
        portionSize: '250 ml',
      },
    });
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(drinkReview);
    const createdDrink = makeCanonicalItem(
      makeMenuItem({
        id: 'drink-1',
        externalItemId: 'gbp-drink',
        itemName: 'Google Spritz',
        category: 'Cocktails',
        basePrice: 9,
        targetKind: 'drink',
      }),
    );
    createCanonicalFoodMenusItemFromPatchMock.mockResolvedValue(createdDrink);
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        ...drinkReview,
        decisionStatus: 'applied',
        decisionAction: 'create_new_item',
      }),
    );

    await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      action: 'create_new_item',
      decidedByUserId: 'user-1',
    });

    expect(createCanonicalFoodMenusItemFromPatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      targetKind: 'drink',
      reviewId: 'review-1',
      suggestedPatch: expect.objectContaining({
        externalItemId: 'gbp-drink',
        itemName: 'Google Spritz',
        category: 'Cocktails',
        portionSize: '250 ml',
      }),
    });
    expect(applyCanonicalFoodMenusSuggestedPatchMock).not.toHaveBeenCalled();
  });

  it('creates a new menu item from an unmatched Google FoodMenus suggestion', async () => {
    const created = makeMenuItem({
      id: 'item-created',
      externalItemId: 'gbp-menus-0-sections-1-items-0',
      itemName: 'Google Curry',
      category: 'Mains',
      subcategory: null,
      shortDescription: 'Google-side item',
      basePrice: 12.5,
      dietaryTags: ['Vegetarian'],
      allergensContains: ['Milk'],
      modifierGroups: [],
    });
    const unmatchedReview = makeReview({
      id: 'review-new',
      localItemId: null,
      externalItemId: null,
      googlePath: 'menus[0].sections[1].items[0]',
      googleSectionLabel: 'Mains',
      googleItemName: 'Google Curry',
      matchStatus: 'unmatched',
      matchConfidence: 'none',
      suggestedPatch: {
        externalItemId: 'gbp-menus-0-sections-1-items-0',
        itemName: 'Google Curry',
        category: 'Mains',
        shortDescription: 'Google-side item',
        basePrice: 12.5,
        currency: 'gbp',
        keyIngredients: ['Paneer'],
        spiceLevel: 'Medium',
        preparationMethod: 'Simmered',
        portionSize: '1 bowl',
        caloriesKcal: 620,
        proteinG: 21,
        servesNum: 1,
        dietaryTags: ['Vegetarian'],
        allergensContains: ['Milk'],
      },
    });
    readFoodMenusImportReviewForRestaurantMock.mockResolvedValue(unmatchedReview);
    const createdCanonicalItem = makeCanonicalItem(created);
    createCanonicalFoodMenusItemFromPatchMock.mockResolvedValue(createdCanonicalItem);
    markFoodMenusImportReviewDecisionMock.mockResolvedValue(
      makeReview({
        ...unmatchedReview,
        decisionStatus: 'applied',
        decisionAction: 'create_new_item',
        decidedByUserId: 'user-1',
      }),
    );

    const result = await decideFoodMenusImportReview({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-new',
      action: 'create_new_item',
      decidedByUserId: 'user-1',
    });

    expect(applyCanonicalFoodMenusSuggestedPatchMock).not.toHaveBeenCalled();
    expect(createCanonicalFoodMenusItemFromPatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      targetKind: 'food',
      reviewId: 'review-new',
      suggestedPatch: expect.objectContaining({
        externalItemId: 'gbp-menus-0-sections-1-items-0',
        itemName: 'Google Curry',
        category: 'Mains',
        shortDescription: 'Google-side item',
        basePrice: 12.5,
        currency: 'GBP',
        keyIngredients: ['Paneer'],
        spiceLevel: 'Medium',
        preparationMethod: 'Simmered',
        portionSize: '1 bowl',
        caloriesKcal: 620,
        proteinG: 21,
        servesNum: 1,
        dietaryTags: ['Vegetarian'],
        allergensContains: ['Milk'],
      }),
    });
    expect(markFoodMenusImportReviewDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-new',
      decisionStatus: 'applied',
      decisionAction: 'create_new_item',
      decidedByUserId: 'user-1',
    });
    expect(result.item?.id).toBe('item-created');
  });

  it('publishes a preflighted FoodMenus projection and records audit snapshots', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    recordFoodMenusProjectionMock.mockResolvedValue({
      snapshot: makeSnapshot({ id: 'projection-snapshot-1', snapshotKind: 'nabatable_projection' }),
      identities: [],
    });
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    recordFoodMenusSnapshotMock
      .mockResolvedValueOnce(
        makeSnapshot({
          id: 'baseline-snapshot-1',
          snapshotKind: 'preflight',
          snapshotHash: 'baseline-hash',
        }),
      )
      .mockResolvedValueOnce(
        makeSnapshot({
          id: 'published-google-snapshot-1',
          snapshotKind: 'google_pull',
          snapshotHash: 'published-hash',
        }),
      );
    openFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'pending',
    });
    markFoodMenusPublishAttemptRunningMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'running',
    });
    updateGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    finishFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'succeeded',
    });

    const result = await publishFoodMenusProjectionToGoogle({
      client,
      restaurantId: 'rest-1',
      accessToken: 'access-token',
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: 'Dinner menu',
      externalProfileId: 'profile-1',
      createdByUserId: 'user-1',
    });

    expect(getGoogleBusinessProfileFoodMenusMock).toHaveBeenCalledWith(
      'access-token',
      'accounts/123/locations/456/foodMenus',
      { readMask: ['name', 'menus'] },
    );
    expect(recordFoodMenusProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'preflight',
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(recordFoodMenusSnapshotMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        snapshotKind: 'preflight',
        source: 'preflight',
        rawFoodMenus: googleFoodMenus,
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(openFoodMenusPublishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionSnapshotId: 'projection-snapshot-1',
        baselineGoogleSnapshotId: 'baseline-snapshot-1',
        baselineGoogleHash: result.baselineGoogleHash,
        projectedPayloadHash: result.projection.projectionHash,
        requestedByUserId: 'user-1',
      }),
    );
    expect(markFoodMenusPublishAttemptRunningMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
    });
    expect(updateGoogleBusinessProfileFoodMenusMock).toHaveBeenCalledWith(
      'access-token',
      result.projection.projection.foodMenus,
      { updateMask: ['menus'] },
    );
    expect(finishFoodMenusPublishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'succeeded',
      googleResponse: googleFoodMenus,
    });
    expect(recordFoodMenusSnapshotMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        snapshotKind: 'google_pull',
        source: 'publish',
        rawFoodMenus: googleFoodMenus,
      }),
    );
    expect(result.attempt.status).toBe('succeeded');
    expect(result.googleResponse).toBe(googleFoodMenus);
  });

  it('fails preflight without calling Google update when the expected baseline changed', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    recordFoodMenusProjectionMock.mockResolvedValue({
      snapshot: makeSnapshot({ id: 'projection-snapshot-1', snapshotKind: 'nabatable_projection' }),
      identities: [],
    });
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    recordFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({
        id: 'baseline-snapshot-1',
        snapshotKind: 'preflight',
      }),
    );
    openFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'pending',
    });
    finishFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'preflight_failed',
    });

    await expect(
      publishFoodMenusProjectionToGoogle({
        client,
        restaurantId: 'rest-1',
        accessToken: 'access-token',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        expectedGoogleHash: 'stale-baseline',
      }),
    ).rejects.toMatchObject({
      name: 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED',
      expectedGoogleHash: 'stale-baseline',
    });

    expect(finishFoodMenusPublishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'preflight_failed',
      errorCode: 'baseline_changed',
      errorMessage: 'Google FoodMenus changed since the expected baseline.',
    });
    expect(markFoodMenusPublishAttemptRunningMock).not.toHaveBeenCalled();
    expect(updateGoogleBusinessProfileFoodMenusMock).not.toHaveBeenCalled();
  });

  it('fails preflight without calling Google update when the expected projection changed', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    recordFoodMenusProjectionMock.mockResolvedValue({
      snapshot: makeSnapshot({ id: 'projection-snapshot-1', snapshotKind: 'nabatable_projection' }),
      identities: [],
    });
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    recordFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({
        id: 'baseline-snapshot-1',
        snapshotKind: 'preflight',
      }),
    );
    openFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'pending',
    });
    finishFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'preflight_failed',
    });

    await expect(
      publishFoodMenusProjectionToGoogle({
        client,
        restaurantId: 'rest-1',
        accessToken: 'access-token',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
        expectedProjectionHash: '0'.repeat(64),
      }),
    ).rejects.toMatchObject({
      name: 'GBP_FOOD_MENUS_PROJECTION_CHANGED',
      expectedProjectionHash: '0'.repeat(64),
      projectionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(finishFoodMenusPublishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'preflight_failed',
      errorCode: 'projection_changed',
      errorMessage: 'Nabatable FoodMenus projection changed since the expected baseline.',
    });
    expect(markFoodMenusPublishAttemptRunningMock).not.toHaveBeenCalled();
    expect(updateGoogleBusinessProfileFoodMenusMock).not.toHaveBeenCalled();
  });

  it('records and throws failed Google FoodMenus publishes instead of resolving success', async () => {
    listCanonicalFoodMenusImportItemsMock.mockResolvedValue([makeMenuItem()]);
    recordFoodMenusProjectionMock.mockResolvedValue({
      snapshot: makeSnapshot({ id: 'projection-snapshot-1', snapshotKind: 'nabatable_projection' }),
      identities: [],
    });
    getGoogleBusinessProfileFoodMenusMock.mockResolvedValue(googleFoodMenus);
    recordFoodMenusSnapshotMock.mockResolvedValue(
      makeSnapshot({
        id: 'baseline-snapshot-1',
        snapshotKind: 'preflight',
      }),
    );
    openFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'pending',
    });
    markFoodMenusPublishAttemptRunningMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'running',
    });
    updateGoogleBusinessProfileFoodMenusMock.mockRejectedValue(new Error('Google rejected menu'));
    finishFoodMenusPublishAttemptMock.mockResolvedValue({
      id: 'attempt-1',
      status: 'failed',
    });

    await expect(
      publishFoodMenusProjectionToGoogle({
        client,
        restaurantId: 'rest-1',
        accessToken: 'access-token',
        foodMenusName: 'accounts/123/locations/456/foodMenus',
      }),
    ).rejects.toMatchObject({
      name: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
      message: 'Google rejected menu',
      attempt: { status: 'failed' },
      googleResponse: null,
    });

    expect(finishFoodMenusPublishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'failed',
      errorCode: 'Error',
      errorMessage: 'Google rejected menu',
    });
    expect(recordFoodMenusSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
