import { describe, expect, it } from 'vitest';

import {
  allergenToTag,
  dietaryRestrictionToTag,
  ingredientsLabelsToArray,
  mediaKeysToImageUrl,
  nutritionFactsFromGoogle,
  portionSizeFromGoogle,
  preparationMethodsEqual,
  preparationMethodsToText,
  servesNumToInt,
  spicinessToSpiceLevel,
} from '@/server/google-business-profile/food-menus-import-mapping';

describe('google business profile food menus import mapping', () => {
  it('maps Google dietary and allergen enums to Nabatable tags', () => {
    expect(dietaryRestrictionToTag('VEGAN')).toBe('Vegan');
    expect(dietaryRestrictionToTag('HALAL')).toBe('Halal');
    expect(allergenToTag('DAIRY')).toBe('Milk');
    expect(allergenToTag('TREE_NUT')).toBe('Nuts');
  });

  it('maps Google spiciness into local spice levels', () => {
    expect(spicinessToSpiceLevel('HOT')).toBe('Hot');
    expect(spicinessToSpiceLevel('MEDIUM')).toBe('Medium');
    expect(spicinessToSpiceLevel(null)).toBeNull();
  });

  it('normalizes preparation methods for display and comparison', () => {
    expect(preparationMethodsToText(['GRILLED', 'OTHER_METHOD', 'BAKED', 'GRILLED'])).toBe(
      'Baked, Grilled',
    );
    expect(preparationMethodsEqual(['GRILLED', 'BAKED'], ['BAKED', 'GRILLED'])).toBe(true);
    expect(preparationMethodsEqual(['GRILLED'], ['BAKED'])).toBe(false);
  });

  it('maps Google portion labels into local portion-size text', () => {
    expect(
      portionSizeFromGoogle({
        quantity: 2,
        unit: [{ displayName: ' pieces ', languageCode: 'en-GB' }],
      }),
    ).toBe('2 pieces');
    expect(
      portionSizeFromGoogle({
        quantity: 1,
        unit: [{ displayName: ' bowl ', languageCode: 'en-GB' }],
      }),
    ).toBe('bowl');
    expect(portionSizeFromGoogle(undefined)).toBeNull();
  });

  it('normalizes ingredient labels into stable local arrays', () => {
    expect(
      ingredientsLabelsToArray([
        { labels: [{ displayName: ' Paneer ', languageCode: 'en-GB' }] },
        { labels: [{ displayName: 'Chilli', languageCode: 'en-GB' }] },
        { labels: [{ displayName: 'Paneer', languageCode: 'en-GB' }] },
      ]),
    ).toEqual(['Chilli', 'Paneer']);
  });

  it('keeps only usable media URLs and truncates serving counts', () => {
    expect(mediaKeysToImageUrl([' google:abc ', ' https://cdn.example.com/dish.jpg '])).toBe(
      'https://cdn.example.com/dish.jpg',
    );
    expect(mediaKeysToImageUrl(['google:abc'])).toBeNull();
    expect(servesNumToInt(2.8)).toBe(2);
    expect(servesNumToInt(-1)).toBeNull();
  });

  it('maps Google nutrition facts into local nutrition columns', () => {
    expect(
      nutritionFactsFromGoogle({
        calories: { unit: 'kilocalories', lowerAmount: 640.2 },
        protein: { unit: 'GRAM', lowerAmount: 18.25 },
        totalFat: { unit: 'MILLIGRAM', lowerAmount: 1250 },
        saturatedFat: { unit: 'g', quantity: 3.444 },
        totalCarbohydrate: { unit: 'GRAM', lowerAmount: 80 },
        sugars: { unit: 'mg', lowerAmount: 900 },
        dietaryFiber: { unit: 'ounce', lowerAmount: 4 },
        sodium: { unit: 'GRAM', lowerAmount: 1.2 },
      }),
    ).toEqual({
      caloriesKcal: 640,
      proteinG: 18.25,
      fatG: 1.25,
      saturatedFatG: 3.44,
      carbsG: 80,
      sugarG: 0.9,
      fiberG: null,
      sodiumMg: 1200,
    });
  });
});
