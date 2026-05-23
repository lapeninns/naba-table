import { describe, expect, it } from 'vitest';

import {
  buildItemModifierGroupsPatch,
  findExistingOptionsGroup,
  modifierGroupsEqual,
  normalizeModifierGroups,
  synthesizeOptionsModifierGroup,
} from '@/server/google-business-profile/food-menus-modifier-import';

import type {
  FoodMenusLocalItem,
  FoodMenusLocalModifierGroup,
  GoogleFoodMenuItem,
} from '@/server/google-business-profile/food-menus';

function makeLocalItem(overrides: Partial<FoodMenusLocalItem> = {}): FoodMenusLocalItem {
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

function makeGoogleItem(overrides: Partial<GoogleFoodMenuItem> = {}): GoogleFoodMenuItem {
  return {
    labels: [{ displayName: 'Chilli Paneer', languageCode: 'en-GB' }],
    attributes: { price: { currencyCode: 'GBP', units: '8', nanos: 950000000 } },
    ...overrides,
  };
}

function makeOptionsGroup(
  overrides: Partial<FoodMenusLocalModifierGroup> = {},
): FoodMenusLocalModifierGroup {
  return {
    externalModifierGroupId: 'existing-options',
    groupName: 'Options',
    required: false,
    minSelect: 0,
    maxSelect: 1,
    displayOrder: 3,
    options: [
      {
        externalModifierOptionId: 'existing-large',
        optionName: 'Large',
        priceDelta: 2,
        defaultSelected: true,
        availabilityStatus: 'available',
        displayOrder: 4,
      },
    ],
    ...overrides,
  };
}

describe('google business profile food menus modifier import', () => {
  it('normalizes modifier groups for stable comparison', () => {
    const groups = normalizeModifierGroups([
      {
        externalModifierGroupId: 'second',
        groupName: 'Second',
        required: false,
        minSelect: 0,
        maxSelect: 2,
        displayOrder: 2,
        options: [
          {
            externalModifierOptionId: 'second-b',
            optionName: 'Second B',
            priceDelta: 1.236,
            defaultSelected: false,
            availabilityStatus: 'available',
            displayOrder: 2,
          },
        ],
      },
      {
        externalModifierGroupId: 'first',
        groupName: 'First',
        required: true,
        minSelect: 1,
        maxSelect: 1,
        displayOrder: 1,
        options: [
          {
            externalModifierOptionId: 'first-b',
            optionName: 'First B',
            priceDelta: 0,
            defaultSelected: false,
            availabilityStatus: 'available',
            displayOrder: 2,
          },
          {
            externalModifierOptionId: 'first-a',
            optionName: 'First A',
            priceDelta: 0.333,
            defaultSelected: true,
            availabilityStatus: 'available',
            displayOrder: 1,
          },
        ],
      },
    ]);

    expect(groups.map((group) => group.externalModifierGroupId)).toEqual(['first', 'second']);
    expect(groups[0]?.options.map((option) => option.externalModifierOptionId)).toEqual([
      'first-a',
      'first-b',
    ]);
    expect(groups[0]?.options[0]?.priceDelta).toBe(0.33);
  });

  it('finds an existing Options group by normalized group name', () => {
    const optionsGroup = makeOptionsGroup({ groupName: ' options ' });
    expect(findExistingOptionsGroup(makeLocalItem({ modifierGroups: [optionsGroup] }))).toBe(
      optionsGroup,
    );
    expect(findExistingOptionsGroup(makeLocalItem())).toBeNull();
  });

  it('synthesizes Google item options into a local Options modifier group', () => {
    const group = synthesizeOptionsModifierGroup(
      makeLocalItem(),
      makeGoogleItem({
        options: [
          {
            labels: [{ displayName: ' Large ', languageCode: 'en-GB' }],
            attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 950000000 } },
          },
        ],
      }),
      'menus[0].sections[0].items[0]',
    );

    expect(group).toEqual({
      externalModifierGroupId: 'gbp-menus-0-sections-0-items-0-options',
      groupName: 'Options',
      required: false,
      minSelect: 0,
      maxSelect: 1,
      displayOrder: 0,
      options: [
        {
          externalModifierOptionId: 'gbp-menus-0-sections-0-items-0-option-large',
          optionName: 'Large',
          priceDelta: 2,
          defaultSelected: false,
          availabilityStatus: 'available',
          displayOrder: 0,
        },
      ],
    });
  });

  it('reuses existing Options group and option identity by normalized option name', () => {
    const existingOptions = makeOptionsGroup();
    const group = synthesizeOptionsModifierGroup(
      makeLocalItem({ modifierGroups: [existingOptions] }),
      makeGoogleItem({
        options: [
          {
            labels: [{ displayName: ' large ', languageCode: 'en-GB' }],
            attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 950000000 } },
          },
        ],
      }),
      'menus[0].sections[0].items[0]',
    );

    expect(group).toEqual({
      ...existingOptions,
      options: [{ ...existingOptions.options[0]!, optionName: 'large' }],
    });
  });

  it('suppresses unchanged modifier patches after normalization', () => {
    const existingOptions = makeOptionsGroup();
    const patch = buildItemModifierGroupsPatch(
      makeLocalItem({ modifierGroups: [existingOptions] }),
      makeGoogleItem({
        options: [
          {
            labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
            attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 950000000 } },
          },
        ],
      }),
      'menus[0].sections[0].items[0]',
    );

    expect(patch).toBeNull();
  });

  it('removes stale Options groups when Google item options disappear', () => {
    const sauceGroup = makeOptionsGroup({
      externalModifierGroupId: 'sauce',
      groupName: 'Sauce',
      displayOrder: 0,
      options: [],
    });
    const patch = buildItemModifierGroupsPatch(
      makeLocalItem({ modifierGroups: [makeOptionsGroup(), sauceGroup] }),
      makeGoogleItem(),
      'menus[0].sections[0].items[0]',
    );

    expect(patch).toEqual([sauceGroup]);
  });

  it('compares modifier groups by normalized structure', () => {
    const left = [
      makeOptionsGroup({ options: [{ ...makeOptionsGroup().options[0]!, priceDelta: 2 }] }),
    ];
    const right = [
      makeOptionsGroup({ options: [{ ...makeOptionsGroup().options[0]!, priceDelta: 2.004 }] }),
    ];

    expect(modifierGroupsEqual(left, right)).toBe(true);
  });
});
