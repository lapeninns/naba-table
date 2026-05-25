import { describe, expect, it } from 'vitest';

import {
  buildCanonicalAttributes,
  buildCanonicalExpandedOptionItem,
  buildCanonicalGoogleFoodMenusProjection,
  buildCanonicalParentOnlyItem,
  canonicalOptionIdentityPaths,
  canonicalProjectionOptionDisplayMode,
} from '@/server/google-business-profile/food-menus-canonical-projection';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

type CanonicalMenuItem = CanonicalRestaurantMenu['sections'][number]['items'][number];
type CanonicalMenuOption = CanonicalMenuItem['options'][number];

function makeCanonicalOption(overrides: Partial<CanonicalMenuOption> = {}): CanonicalMenuOption {
  return {
    id: 'option-chicken',
    restaurantId: 'rest-1',
    menuItemId: 'item-korma',
    externalOptionId: 'chicken',
    labels: [{ displayName: 'Chicken', languageCode: 'en-GB' }],
    attributes: {
      price: { currencyCode: 'GBP', amount: 12.5 },
      allergen: [],
      dietaryRestriction: [],
      ingredients: [],
      preparationMethods: [],
      mediaKeys: [],
      nutritionFacts: {},
    },
    media: { googleMediaKeys: [], localMedia: {} },
    displayOrder: 0,
    active: true,
    legacySource: {},
    ...overrides,
  };
}

function makeCanonicalItem(overrides: Partial<CanonicalMenuItem> = {}): CanonicalMenuItem {
  return {
    id: 'item-korma',
    restaurantId: 'rest-1',
    menuId: 'food-menu',
    sectionId: 'section-curries',
    itemKind: 'food',
    externalItemId: 'korma',
    legacySource: {},
    labels: [
      {
        displayName: 'Korma',
        description: 'Mild creamy curry.',
        languageCode: 'en-GB',
      },
    ],
    attributes: {
      price: { currencyCode: 'GBP', amount: 10.5 },
      spiciness: 'MILD',
      allergen: ['DAIRY'],
      dietaryRestriction: ['HALAL'],
      ingredients: [{ labels: [{ displayName: 'Coconut', languageCode: 'en-GB' }] }],
      preparationMethods: ['SIMMERED'],
      mediaKeys: ['https://cdn.example.test/korma.jpg', 'attributes-media-key'],
      nutritionFacts: {
        calories: { unit: ' calorie ', lowerAmount: 450.5 },
        sodium: { unit: 'mg', quantity: 800 },
      },
      servesNumPeople: 2,
    },
    media: {
      googleMediaKeys: ['locations/123/media/korma'],
      localImageUrl: 'https://cdn.example.test/korma.jpg',
      localMedia: {},
    },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {},
      availabilityPolicy: {},
      customizationControls: {},
      sourceMetadata: {},
    },
    options: [makeCanonicalOption()],
    displayOrder: 0,
    active: true,
    ...overrides,
  };
}

function makeCanonicalMenu(
  itemOverrides: Partial<CanonicalMenuItem> = {},
): CanonicalRestaurantMenu {
  return {
    id: 'food-menu',
    restaurantId: 'rest-1',
    labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
    sourceUrl: ' https://example.com/menu ',
    cuisines: ['INDIAN', 'NOT_A_CUISINE'],
    defaultLanguageCode: 'en-GB',
    menuKind: 'food',
    displayOrder: 0,
    active: true,
    legacySource: {},
    sections: [
      {
        id: 'section-curries',
        restaurantId: 'rest-1',
        menuId: 'food-menu',
        labels: [{ displayName: 'Authentic Curries', languageCode: 'en-GB' }],
        displayOrder: 0,
        active: true,
        legacyCategory: 'Authentic Curries',
        legacySubcategory: null,
        legacySource: {},
        items: [makeCanonicalItem(itemOverrides)],
      },
    ],
  };
}

describe('google business profile food menus canonical projection', () => {
  it('builds canonical Google attributes while filtering unusable media URLs', () => {
    expect(buildCanonicalAttributes(makeCanonicalItem())).toEqual({
      price: { currencyCode: 'GBP', units: '10', nanos: 500000000 },
      spiciness: 'MILD',
      allergen: ['DAIRY'],
      dietaryRestriction: ['HALAL'],
      ingredients: [{ labels: [{ displayName: 'Coconut', languageCode: 'en-GB' }] }],
      preparationMethods: ['SIMMERED'],
      mediaKeys: ['attributes-media-key', 'locations/123/media/korma'],
      nutritionFacts: {
        calories: { unit: 'calorie', lowerAmount: 450.5 },
        sodium: { unit: 'mg', quantity: 800 },
      },
      servesNumPeople: 2,
    });
  });

  it('detects option display modes and builds parent-only from-price rows', () => {
    const item = makeCanonicalItem({
      legacySource: { googleFoodMenusProjection: { optionDisplay: 'single_from_parent' } },
    });

    expect(canonicalProjectionOptionDisplayMode(item)).toBe('single_from_parent');
    expect(buildCanonicalParentOnlyItem(item)).toMatchObject({
      labels: [{ displayName: 'Korma - from \u00a310.50' }],
      attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 500000000 } },
    });
  });

  it('builds expanded option rows with inherited parent attributes', () => {
    const item = makeCanonicalItem();
    const option = makeCanonicalOption({
      labels: [{ displayName: 'Chicken', description: 'Breast pieces.', languageCode: 'en-GB' }],
      attributes: {
        price: { currencyCode: 'GBP', amount: 12.5 },
        allergen: [],
        dietaryRestriction: [],
        ingredients: [],
        preparationMethods: [],
        mediaKeys: [],
        nutritionFacts: {},
      },
    });

    expect(buildCanonicalExpandedOptionItem(item, option)).toMatchObject({
      labels: [
        {
          displayName: 'Chicken Korma',
          description: 'Breast pieces.',
          languageCode: 'en-GB',
        },
      ],
      attributes: {
        price: { currencyCode: 'GBP', units: '12', nanos: 500000000 },
        allergen: ['DAIRY'],
        dietaryRestriction: ['HALAL'],
        mediaKeys: ['attributes-media-key', 'locations/123/media/korma'],
      },
    });
  });

  it('builds canonical option paths and skips inactive canonical items', () => {
    const item = makeCanonicalItem({
      options: [
        makeCanonicalOption({ externalOptionId: 'beef', displayOrder: 2 }),
        makeCanonicalOption({ externalOptionId: 'chicken', displayOrder: 1 }),
        makeCanonicalOption({ externalOptionId: 'prawn', active: false, displayOrder: 0 }),
      ],
    });

    expect(canonicalOptionIdentityPaths(item, 'menus[0].sections[0].items[0]')).toEqual([
      {
        externalModifierGroupId: 'canonical-options',
        externalModifierOptionId: 'chicken',
        googlePath: 'menus[0].sections[0].items[0].options[0]',
      },
      {
        externalModifierGroupId: 'canonical-options',
        externalModifierOptionId: 'beef',
        googlePath: 'menus[0].sections[0].items[0].options[1]',
      },
    ]);

    const projection = buildCanonicalGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menus: [makeCanonicalMenu({ active: false })],
    });

    expect(projection.foodMenus.menus[0]?.cuisines).toEqual(['INDIAN']);
    expect(projection.foodMenus.menus[0]?.sections[0]?.items).toEqual([]);
    expect(projection.skippedItems).toEqual([
      { localItemId: 'item-korma', externalItemId: 'korma', reason: 'inactive' },
    ]);
  });
});
