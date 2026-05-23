import { describe, expect, it } from 'vitest';

import {
  canonicalItemToLocal,
  inputFromSuggestedPatch,
  itemPatchFromSuggestedPatch,
  menuKindForTarget,
} from '@/server/google-business-profile/food-menus-canonical-domain';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

function makeMenu(): CanonicalRestaurantMenu {
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
    sections: [],
  };
}

function makeSection(): CanonicalRestaurantMenuSection {
  return {
    id: 'section-1',
    restaurantId: 'rest-1',
    menuId: 'menu-1',
    labels: [{ displayName: 'Starters - Vegetarian', languageCode: 'en-GB' }],
    displayOrder: 0,
    active: true,
    legacyCategory: 'Starters',
    legacySubcategory: 'Vegetarian',
    legacySource: {},
    items: [],
  };
}

function makeItem(
  overrides: Partial<CanonicalRestaurantMenuItem> = {},
): CanonicalRestaurantMenuItem {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    menuId: 'menu-1',
    sectionId: 'section-1',
    itemKind: 'food',
    externalItemId: 'starter-paneer',
    labels: [
      {
        displayName: 'Chilli Paneer',
        description: 'Crisp paneer tossed with peppers.',
        languageCode: 'en-GB',
      },
    ],
    attributes: {
      price: { amount: 8.95, currencyCode: 'GBP' },
      spiciness: 'HOT',
      allergen: ['DAIRY', 'WHEAT'],
      dietaryRestriction: ['VEGETARIAN', 'VEGAN'],
      ingredients: [{ labels: [{ displayName: 'Paneer', languageCode: 'en-GB' }] }],
      preparationMethods: ['GRILLED'],
      mediaKeys: [],
      nutritionFacts: {
        calories: { lowerAmount: 450, unit: 'CALORIE' },
        protein: { quantity: 17000, unit: 'mg' },
        sodium: { quantity: 0.85, unit: 'g' },
      },
      portionSize: {
        quantity: 1,
        unit: [{ displayName: 'Starter plate', languageCode: 'en-GB' }],
      },
      servesNumPeople: 2,
    },
    media: { googleMediaKeys: [], localMedia: {}, localImageUrl: 'https://example.com/item.jpg' },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {
        featured: true,
        recommendationTags: ['house'],
        popularityScore: 82,
      },
      availabilityPolicy: { availabilityStatus: 'available', soldOut: false },
      customizationControls: {},
      sourceMetadata: {},
    },
    options: [
      {
        id: 'option-1',
        restaurantId: 'rest-1',
        menuItemId: 'item-1',
        externalOptionId: 'large',
        labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
        attributes: {
          price: { amount: 10.95, currencyCode: 'GBP' },
          allergen: [],
          dietaryRestriction: [],
          ingredients: [],
          preparationMethods: [],
          mediaKeys: [],
          nutritionFacts: {},
        },
        media: { googleMediaKeys: [], localMedia: {} },
        displayOrder: 1,
        active: true,
        legacySource: {},
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ],
    displayOrder: 10,
    active: true,
    legacySource: {},
    ...overrides,
  };
}

describe('google business profile food menus canonical domain', () => {
  it('maps canonical menu items into local FoodMenus import items', () => {
    expect(canonicalItemToLocal(makeMenu(), makeSection(), makeItem())).toMatchObject({
      id: 'item-1',
      restaurantId: 'rest-1',
      externalItemId: 'starter-paneer',
      itemName: 'Chilli Paneer',
      category: 'Starters',
      subcategory: 'Vegetarian',
      shortDescription: 'Crisp paneer tossed with peppers.',
      basePrice: 8.95,
      currency: 'GBP',
      availabilityStatus: 'available',
      keyIngredients: ['Paneer'],
      preparationMethod: 'Grilled',
      spiceLevel: 'Hot',
      portionSize: 'Starter plate',
      recommendationTags: ['featured', 'house'],
      dietaryTags: ['Vegan', 'Vegetarian'],
      allergensContains: ['Milk', 'Wheat'],
      canBeMadeVegetarian: true,
      canBeMadeVegan: true,
      imageUrl: 'https://example.com/item.jpg',
      caloriesKcal: 450,
      proteinG: 17,
      sodiumMg: 850,
      servesNum: 2,
      modifierGroups: [
        expect.objectContaining({
          externalModifierGroupId: 'canonical-options',
          options: [
            expect.objectContaining({
              externalModifierOptionId: 'large',
              optionName: 'Large',
              priceDelta: 2,
            }),
          ],
        }),
      ],
    });
  });

  it('builds canonical update payloads from suggested patches', () => {
    const patch = itemPatchFromSuggestedPatch(
      makeItem(),
      {
        itemName: 'Google Paneer',
        shortDescription: null,
        basePrice: 9.5,
        currency: 'GBP',
        spiceLevel: 'Medium',
        dietaryTags: ['Halal', 'Vegetarian'],
        allergensContains: ['Milk'],
        preparationMethod: 'Pan fried',
        keyIngredients: ['Paneer', 'Peppers'],
        portionSize: 'Sharing plate',
        caloriesKcal: 500,
        imageUrl: null,
      },
      { importReviewId: 'review-1' },
    );

    expect(patch).toMatchObject({
      labels: [
        {
          displayName: 'Google Paneer',
          description: null,
          languageCode: 'en-GB',
        },
      ],
      attributes: {
        price: { amount: 9.5, currencyCode: 'GBP' },
        spiciness: 'MEDIUM',
        dietaryRestriction: ['HALAL', 'VEGETARIAN'],
        allergen: ['DAIRY'],
        preparationMethods: ['PAN_FRIED'],
        nutritionFacts: {
          calories: { lowerAmount: 500, unit: 'CALORIE' },
        },
      },
      media: {
        localImageUrl: undefined,
      },
      extensions: {
        sourceMetadata: { importReviewId: 'review-1' },
      },
    });
  });

  it('builds canonical create inputs with target-aware item kind and import metadata', () => {
    expect(menuKindForTarget('drink')).toBe('drinks');
    expect(menuKindForTarget('food')).toBe('food');

    expect(
      inputFromSuggestedPatch({
        restaurantId: 'rest-1',
        targetKind: 'drink',
        reviewId: 'review-1',
        patch: {
          externalItemId: 'gbp-spritz',
          itemName: 'Google Spritz',
          category: 'Cocktails',
          basePrice: 9,
          currency: 'GBP',
          shortDescription: 'Aperitif drink',
        },
      }),
    ).toMatchObject({
      itemKind: 'drink',
      externalItemId: 'gbp-spritz',
      labels: [{ displayName: 'Google Spritz', description: 'Aperitif drink' }],
      attributes: {
        price: { amount: 9, currencyCode: 'GBP' },
      },
      extensions: {
        availabilityPolicy: { availabilityStatus: 'available', soldOut: false, orderable: true },
        sourceMetadata: {
          sourceSystem: 'google_foodmenus_import_review',
          sourceItemId: 'gbp-spritz',
          importReviewId: 'review-1',
          importedAt: expect.any(String),
        },
      },
      legacySource: {
        sourceSystem: 'google_foodmenus_import_review',
        sourceItemId: 'gbp-spritz',
        restaurantId: 'rest-1',
      },
    });
  });
});
