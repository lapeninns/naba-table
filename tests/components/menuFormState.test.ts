import { describe, expect, it } from 'vitest';

import {
  buildMenuItemPayload,
  createEmptyMenuItemFormState,
  createEmptyModifierGroupFormState,
  createEmptyModifierOptionFormState,
} from '@/components/features/menu/menuFormState';

describe('buildMenuItemPayload', () => {
  it('normalizes booleans, arrays, scores, and numeric strings', () => {
    const form = createEmptyMenuItemFormState();
    form.externalItemId = 'item-1';
    form.itemName = 'Burrata';
    form.category = 'Starters';
    form.subcategory = ' Cold ';
    form.basePrice = '9.50';
    form.currency = 'gbp';
    form.serviceTime = 'Dinner';
    form.keyIngredients = 'burrata, tomato, basil';
    form.recommendationTags = 'popular, fresh';
    form.pairings = 'white wine';
    form.signatureScore = '88';
    form.popularityScore = '92';
    form.dietaryTags = 'vegetarian, gluten-free';
    form.allergensContains = 'milk';
    form.allergensMayContain = 'nuts';
    form.removableIngredients = 'basil';
    form.spiceAdjustable = true;
    form.shareable = true;
    form.substitutionsAllowed = true;
    form.canBeMadeVegetarian = true;
    form.canBeMadeVegan = false;
    form.canBeMadeGlutenFree = true;
    form.customizationRules = 'Swap basil for rocket';
    form.servingNotes = 'Serve chilled';
    form.displayOrder = '7';
    form.imageUrl = 'https://example.com/burrata.jpg';
    form.caloriesKcal = '320';
    form.proteinG = '14.5';
    form.fatG = '22';
    form.saturatedFatG = '9.5';
    form.carbsG = '8';
    form.sugarG = '3.25';
    form.fiberG = '1.5';
    form.sodiumMg = '410';
    form.servesNum = '2';

    const group = createEmptyModifierGroupFormState();
    group.externalModifierGroupId = 'group-1';
    group.groupName = 'Bread choice';
    group.required = true;
    group.minSelect = '1';
    group.maxSelect = '2';
    group.displayOrder = '3';

    const option = createEmptyModifierOptionFormState();
    option.externalModifierOptionId = 'option-1';
    option.optionName = 'Sourdough';
    option.priceDelta = '-0.50';
    option.defaultSelected = true;
    option.displayOrder = '4';

    group.options = [option];
    form.modifierGroups = [group];

    expect(buildMenuItemPayload(form)).toEqual({
      externalItemId: 'item-1',
      itemName: 'Burrata',
      category: 'Starters',
      subcategory: 'Cold',
      shortDescription: null,
      fullDescription: null,
      basePrice: 9.5,
      currency: 'GBP',
      serviceTime: 'Dinner',
      availabilityStatus: 'available',
      keyIngredients: ['burrata', 'tomato', 'basil'],
      mainProteinOrBase: null,
      cookingStyle: null,
      preparationMethod: null,
      flavorProfile: null,
      texture: null,
      spiceLevel: null,
      spiceAdjustable: true,
      portionSize: null,
      shareable: true,
      recommendationTags: ['popular', 'fresh'],
      pairings: ['white wine'],
      signatureScore: 88,
      popularityScore: 92,
      dietaryTags: ['vegetarian', 'gluten-free'],
      allergensContains: ['milk'],
      allergensMayContain: ['nuts'],
      removableIngredients: ['basil'],
      substitutionsAllowed: true,
      canBeMadeVegetarian: true,
      canBeMadeVegan: false,
      canBeMadeGlutenFree: true,
      customizationRules: 'Swap basil for rocket',
      servingNotes: 'Serve chilled',
      active: true,
      seasonal: false,
      limitedTime: false,
      soldOut: false,
      displayOrder: 7,
      imageUrl: 'https://example.com/burrata.jpg',
      caloriesKcal: 320,
      proteinG: 14.5,
      fatG: 22,
      saturatedFatG: 9.5,
      carbsG: 8,
      sugarG: 3.25,
      fiberG: 1.5,
      sodiumMg: 410,
      servesNum: 2,
      modifierGroups: [
        {
          externalModifierGroupId: 'group-1',
          groupName: 'Bread choice',
          required: true,
          minSelect: 1,
          maxSelect: 2,
          displayOrder: 3,
          options: [
            {
              externalModifierOptionId: 'option-1',
              optionName: 'Sourdough',
              priceDelta: -0.5,
              defaultSelected: true,
              availabilityStatus: 'available',
              displayOrder: 4,
            },
          ],
        },
      ],
    });
  });
});
