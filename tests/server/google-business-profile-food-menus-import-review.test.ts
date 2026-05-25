import { describe, expect, it } from 'vitest';

import {
  buildGoogleFoodMenusImportReview,
  classifyMenuTarget,
  previousIdentityMatchesGoogleRow,
} from '@/server/google-business-profile/food-menus-import-review';
import {
  buildMenuMetadataSuggestedPatch,
  splitSectionLabelForCreate,
} from '@/server/google-business-profile/food-menus-import-review-patches';

import type {
  FoodMenusLocalItem,
  GoogleFoodMenusProjectedIdentity,
  GoogleFoodMenusResource,
} from '@/server/google-business-profile/food-menus';

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
    keyIngredients: ['Paneer'],
    mainProteinOrBase: 'Paneer',
    cookingStyle: 'Stir fried',
    preparationMethod: 'Fried',
    flavorProfile: null,
    texture: null,
    spiceLevel: 'Medium',
    spiceAdjustable: true,
    portionSize: 'Starter',
    shareable: false,
    recommendationTags: [],
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    dietaryTags: ['Vegetarian'],
    allergensContains: ['Milk'],
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
    displayOrder: 0,
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

function makeGoogleFoodMenus(): GoogleFoodMenusResource {
  return {
    name: 'accounts/123/locations/456/foodMenus',
    menus: [
      {
        labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
        sourceUrl: 'https://example.com/menu',
        cuisines: ['INDIAN'],
        sections: [
          {
            labels: [{ displayName: 'Starters - Vegetarian', languageCode: 'en-GB' }],
            items: [
              {
                labels: [
                  {
                    displayName: 'Chilli Paneer',
                    description: 'Updated by Google',
                    languageCode: 'en-GB',
                  },
                ],
                attributes: {
                  price: { currencyCode: 'GBP', units: '9', nanos: 500000000 },
                  dietaryRestriction: ['VEGETARIAN', 'VEGAN'],
                  allergen: ['DAIRY'],
                  spiciness: 'HOT',
                  mediaKeys: ['locations/123/media/item'],
                  nutritionFacts: {
                    calories: { unit: 'CALORIE', lowerAmount: 450 },
                  },
                  servesNumPeople: 2,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('google business profile food menus import review', () => {
  it('classifies menu targets conservatively', () => {
    const menu = (displayName: string) => ({
      labels: [{ displayName, languageCode: 'en-GB' }],
      sections: [],
    });

    expect(classifyMenuTarget(menu('Drinks Menu'))).toBe('drink');
    expect(classifyMenuTarget(menu('Bar list'))).toBe('drink');
    expect(classifyMenuTarget(menu('Food and Drinks'))).toBe('food');
    expect(classifyMenuTarget(menu('Dinner menu'))).toBe('food');
  });

  it('guards previous identity matches by section and item display names', () => {
    const identity: GoogleFoodMenusProjectedIdentity = {
      stableKey: 'foodMenu.item.starters.starter-paneer',
      localItemId: 'item-1',
      externalItemId: 'starter-paneer',
      itemName: 'Chilli Paneer',
      sectionKey: 'starters',
      sectionLabel: 'Starters',
      googlePath: 'menus[0].sections[0].items[0]',
      googleOptionPaths: [],
    };

    expect(
      previousIdentityMatchesGoogleRow({
        identity,
        googleSectionLabel: 'Starters',
        googleItemName: 'Chilli Paneer',
      }),
    ).toBe(true);
    expect(
      previousIdentityMatchesGoogleRow({
        identity,
        googleSectionLabel: 'Mains',
        googleItemName: 'Chilli Paneer',
      }),
    ).toBe(false);
  });

  it('builds menu metadata patches and create section labels', () => {
    expect(
      buildMenuMetadataSuggestedPatch(
        {
          labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
          sourceUrl: 'https://example.com/menu',
          cuisines: ['INDIAN'],
          sections: [],
        },
        {
          menuLabel: 'Old menu',
          sourceUrl: null,
          cuisines: [],
          languageCode: 'en',
        },
      ),
    ).toEqual({
      menuLabel: 'Dinner menu',
      sourceUrl: 'https://example.com/menu',
      cuisines: ['INDIAN'],
      languageCode: 'en-GB',
    });
    expect(splitSectionLabelForCreate('Starters - Vegetarian')).toEqual({
      category: 'Starters',
      subcategory: 'Vegetarian',
    });
  });

  it('reviews matched Google rows as suggested patches with warnings and missing local rows', () => {
    const localItem = makeMenuItem();
    const missingItem = makeMenuItem({
      id: 'item-2',
      externalItemId: 'mains-korma',
      itemName: 'Korma',
      category: 'Mains',
      subcategory: null,
    });
    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: makeGoogleFoodMenus(),
      localItems: [localItem, missingItem],
      previousIdentities: [
        {
          stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
          localItemId: localItem.id,
          externalItemId: localItem.externalItemId,
          itemName: localItem.itemName,
          sectionKey: 'starters/vegetarian',
          sectionLabel: 'Starters - Vegetarian',
          googlePath: 'menus[0].sections[0].items[0]',
          googleOptionPaths: [],
        },
      ],
    });

    expect(review.items).toEqual(
      expect.arrayContaining([
        {
          googlePath: 'menus[0].sections[0].items[0]',
          googleSectionLabel: 'Starters - Vegetarian',
          googleItemName: 'Chilli Paneer',
          targetKind: 'food',
          match: {
            status: 'matched',
            confidence: 'previous_identity',
            localItemId: 'item-1',
            externalItemId: 'starter-paneer',
          },
          suggestedPatch: expect.objectContaining({
            shortDescription: 'Updated by Google',
            basePrice: 9.5,
            dietaryTags: ['Vegan', 'Vegetarian'],
            spiceLevel: 'Hot',
            caloriesKcal: 450,
            servesNum: 2,
          }),
          warnings: ['Google item media keys need a public URL before image import.'],
        },
        {
          googlePath: null,
          googleSectionLabel: null,
          googleItemName: 'Korma',
          targetKind: 'food',
          match: {
            status: 'missing_from_google',
            confidence: 'none',
            localItemId: 'item-2',
            externalItemId: 'mains-korma',
          },
          suggestedPatch: null,
          warnings: ['This local item was not present in the latest Google FoodMenus pull.'],
        },
      ]),
    );
    expect(review.localItemsMissingFromGoogle).toEqual([
      {
        localItemId: 'item-2',
        externalItemId: 'mains-korma',
        itemName: 'Korma',
        targetKind: 'food',
        reason: 'not_present_in_google',
      },
    ]);
  });

  it('builds create suggestions with generated IDs and synthesized options', () => {
    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: {
        name: 'accounts/123/locations/456/foodMenus',
        menus: [
          {
            labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
            sections: [
              {
                labels: [{ displayName: 'Mains - Curry', languageCode: 'en-GB' }],
                items: [
                  {
                    labels: [{ displayName: 'Korma', languageCode: 'en-GB' }],
                    attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 0 } },
                    options: [
                      {
                        labels: [{ displayName: 'Chicken', languageCode: 'en-GB' }],
                        attributes: {
                          price: { currencyCode: 'GBP', units: '12', nanos: 500000000 },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      localItems: [],
    });

    const unmatched = review.items.find((item) => item.match.status === 'unmatched');
    expect(unmatched?.match).toEqual({ status: 'unmatched', confidence: 'none' });
    expect(unmatched?.suggestedPatch).toEqual(
      expect.objectContaining({
        externalItemId: 'gbp-menus-0-sections-0-items-0',
        itemName: 'Korma',
        category: 'Mains',
        subcategory: 'Curry',
        basePrice: 10,
        modifierGroups: [
          expect.objectContaining({
            externalModifierGroupId: 'gbp-menus-0-sections-0-items-0-options',
            options: [
              expect.objectContaining({
                externalModifierOptionId: 'gbp-menus-0-sections-0-items-0-option-chicken',
                optionName: 'Chicken',
                priceDelta: 2.5,
              }),
            ],
          }),
        ],
      }),
    );
  });
});
