import { describe, expect, it } from 'vitest';

import {
  buildAttributes,
  buildGoogleFoodMenusProjection,
  buildOptionIdentityPaths,
  getSectionLabel,
  mapAllergen,
  mapDietaryRestriction,
  mapPreparationMethod,
  mapSpiciness,
} from '@/server/google-business-profile/food-menus-local-projection';

import type { FoodMenusLocalItem } from '@/server/google-business-profile/food-menus';

function makeMenuItem(overrides: Partial<FoodMenusLocalItem> = {}): FoodMenusLocalItem {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    externalItemId: 'starter-paneer',
    itemName: 'Chilli Paneer',
    category: 'Starters',
    subcategory: 'Vegetarian',
    shortDescription: 'Crisp paneer tossed with peppers and chilli sauce.',
    fullDescription: null,
    basePrice: 8.95,
    currency: 'GBP',
    serviceTime: 'Dinner',
    availabilityStatus: 'available',
    keyIngredients: ['Paneer', 'Peppers', 'Chilli'],
    mainProteinOrBase: 'Paneer',
    cookingStyle: 'Stir fried',
    preparationMethod: 'Fried',
    flavorProfile: null,
    texture: null,
    spiceLevel: 'Medium',
    spiceAdjustable: true,
    portionSize: 'starter plate',
    shareable: false,
    recommendationTags: [],
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    dietaryTags: ['Vegetarian'],
    allergensContains: ['Milk', 'Wheat flour'],
    allergensMayContain: [],
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: true,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: null,
    servingNotes: null,
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

describe('google business profile food menus local projection', () => {
  it('maps local free-text fields into Google FoodMenus enums', () => {
    expect(mapSpiciness('extra spicy')).toBe('HOT');
    expect(mapAllergen('yoghurt sauce')).toBe('DAIRY');
    expect(mapDietaryRestriction('veggie')).toBe('VEGETARIAN');
    expect(mapPreparationMethod('stir-fried')).toBe('STIR_FRIED');
    expect(mapPreparationMethod('tempered')).toBe('OTHER_METHOD');
  });

  it('builds Google item attributes from local menu fields', () => {
    expect(
      buildAttributes(
        makeMenuItem({
          caloriesKcal: 450,
          proteinG: 18.25,
          fatG: 21,
          carbsG: 80,
          sodiumMg: 850,
          servesNum: 2,
        }),
        'en',
        0.5,
      ),
    ).toEqual({
      price: { currencyCode: 'GBP', units: '9', nanos: 450000000 },
      spiciness: 'MEDIUM',
      allergen: ['DAIRY', 'WHEAT'],
      dietaryRestriction: ['VEGETARIAN'],
      ingredients: [
        { labels: [{ displayName: 'Paneer', languageCode: 'en' }] },
        { labels: [{ displayName: 'Peppers', languageCode: 'en' }] },
        { labels: [{ displayName: 'Chilli', languageCode: 'en' }] },
      ],
      preparationMethods: ['FRIED', 'STIR_FRIED'],
      portionSize: {
        quantity: 1,
        unit: [{ displayName: 'starter plate', languageCode: 'en' }],
      },
      nutritionFacts: {
        calories: { lowerAmount: 450, unit: 'CALORIE' },
        protein: { lowerAmount: 18.25, unit: 'GRAM' },
        totalFat: { lowerAmount: 21, unit: 'GRAM' },
        totalCarbohydrate: { lowerAmount: 80, unit: 'GRAM' },
        sodium: { lowerAmount: 850, unit: 'MILLIGRAM' },
      },
      servesNumPeople: 2,
    });
  });

  it('builds section labels and option identity paths deterministically', () => {
    const item = makeMenuItem({
      modifierGroups: [
        {
          externalModifierGroupId: 'spice',
          groupName: 'Spice',
          required: false,
          minSelect: 0,
          maxSelect: 1,
          displayOrder: 0,
          options: [
            {
              externalModifierOptionId: 'hot',
              optionName: 'Hot',
              priceDelta: 0.5,
              defaultSelected: false,
              availabilityStatus: 'available',
              displayOrder: 0,
            },
            {
              externalModifierOptionId: 'gone',
              optionName: 'Gone',
              priceDelta: 0,
              defaultSelected: false,
              availabilityStatus: 'unavailable',
              displayOrder: 1,
            },
          ],
        },
      ],
    });

    expect(getSectionLabel(item)).toBe('Starters - Vegetarian');
    expect(buildOptionIdentityPaths(item, 'menus[0].sections[0].items[0]')).toEqual([
      {
        externalModifierGroupId: 'spice',
        externalModifierOptionId: 'hot',
        googlePath: 'menus[0].sections[0].items[0].options[0]',
      },
    ]);
  });

  it('builds a Google FoodMenus projection with stable identities and skipped items', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: ' Dinner menu ',
      sourceUrl: ' https://example.com/menu ',
      languageCode: 'en',
      cuisines: ['INDIAN', 'NOT_A_CUISINE'],
      items: [
        makeMenuItem(),
        makeMenuItem({
          id: 'inactive',
          externalItemId: 'inactive',
          itemName: 'Inactive',
          active: false,
        }),
      ],
    });

    expect(projection.foodMenus).toMatchObject({
      name: 'accounts/123/locations/456/foodMenus',
      menus: [
        {
          labels: [{ displayName: 'Dinner menu', languageCode: 'en' }],
          sourceUrl: 'https://example.com/menu',
          cuisines: ['INDIAN'],
          sections: [
            {
              labels: [{ displayName: 'Starters - Vegetarian', languageCode: 'en' }],
              items: [
                {
                  labels: [
                    {
                      displayName: 'Chilli Paneer',
                      description: 'Crisp paneer tossed with peppers and chilli sauce.',
                      languageCode: 'en',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(projection.identities).toEqual([
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
    ]);
    expect(projection.skippedItems).toEqual([
      { localItemId: 'inactive', externalItemId: 'inactive', reason: 'inactive' },
    ]);
  });
});
