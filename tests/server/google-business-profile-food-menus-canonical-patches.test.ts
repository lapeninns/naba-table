import { describe, expect, it } from 'vitest';

import {
  defaultMenuLabel,
  inputFromSuggestedPatch,
  itemPatchFromSuggestedPatch,
  menuKindForTarget,
} from '@/server/google-business-profile/food-menus-canonical-patches';

import type { CanonicalRestaurantMenuItem } from '@/server/menu-hierarchy/types';

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
      allergen: ['DAIRY'],
      dietaryRestriction: ['VEGETARIAN'],
      ingredients: [],
      preparationMethods: ['GRILLED'],
      mediaKeys: [],
      nutritionFacts: {},
    },
    media: { googleMediaKeys: [], localMedia: {}, localImageUrl: 'https://example.com/item.jpg' },
    extensions: {
      drinkProfile: {},
      recommendationMetadata: {},
      availabilityPolicy: { availabilityStatus: 'available', soldOut: false },
      customizationControls: {},
      sourceMetadata: {},
    },
    options: [],
    displayOrder: 10,
    active: true,
    legacySource: {},
    ...overrides,
  };
}

describe('google business profile food menus canonical patches', () => {
  it('builds canonical update payloads from suggested patches', () => {
    expect(
      itemPatchFromSuggestedPatch(
        makeItem(),
        {
          itemName: 'Google Paneer',
          shortDescription: null,
          basePrice: 9.5,
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
      ),
    ).toMatchObject({
      labels: [{ displayName: 'Google Paneer', description: null, languageCode: 'en-GB' }],
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
      media: { localImageUrl: undefined },
      extensions: { sourceMetadata: { importReviewId: 'review-1' } },
    });
  });

  it('builds canonical create inputs with target-aware menu and item kinds', () => {
    expect(menuKindForTarget('drink')).toBe('drinks');
    expect(defaultMenuLabel('drink')).toBe('Drinks');

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
        sourceMetadata: {
          sourceSystem: 'google_foodmenus_import_review',
          sourceItemId: 'gbp-spritz',
          importReviewId: 'review-1',
          importedAt: expect.any(String),
        },
      },
    });
  });
});
