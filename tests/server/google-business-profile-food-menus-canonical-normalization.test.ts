import { describe, expect, it } from 'vitest';

import {
  allergenToTag,
  cleanText,
  dietaryRestrictionToTag,
  nutritionAmount,
  nutritionValue,
  spicinessToText,
  tagToAllergen,
  tagToDietaryRestriction,
  textToPreparationMethod,
  textToSpiciness,
  uniqueSorted,
} from '@/server/google-business-profile/food-menus-canonical-normalization';

describe('google business profile food menus canonical normalization', () => {
  it('normalizes text and sorted string values', () => {
    expect(cleanText('  Chicken   Tikka  ')).toBe('Chicken Tikka');
    expect(cleanText('   ')).toBeNull();
    expect(uniqueSorted(['Vegan', 'Halal', 'Vegan', null, undefined])).toEqual(['Halal', 'Vegan']);
  });

  it('maps spice, allergen, dietary, and preparation text in both directions', () => {
    expect(spicinessToText('HOT')).toBe('Hot');
    expect(textToSpiciness('extra spicy')).toBe('HOT');
    expect(allergenToTag('DAIRY')).toBe('Milk');
    expect(tagToAllergen('cream sauce')).toBe('DAIRY');
    expect(dietaryRestrictionToTag('VEGETARIAN')).toBe('Vegetarian');
    expect(tagToDietaryRestriction('veggie')).toBe('VEGETARIAN');
    expect(textToPreparationMethod('pan-fried with onions')).toBe('PAN_FRIED');
    expect(textToPreparationMethod('steamed rice')).toBe('STEAMED');
  });

  it('converts nutrition amounts between supported units', () => {
    expect(nutritionValue({ quantity: 17000, unit: 'mg' }, 'g')).toBe(17);
    expect(nutritionValue({ quantity: 0.85, unit: 'g' }, 'mg')).toBe(850);
    expect(nutritionValue({ lowerAmount: 451.4, unit: 'CALORIE' }, 'kcal')).toBe(451);
    expect(nutritionValue({ quantity: 1, unit: 'oz' }, 'g')).toBeNull();
    expect(nutritionAmount(12.5, 'GRAM')).toEqual({ lowerAmount: 12.5, unit: 'GRAM' });
    expect(nutritionAmount(Number.NaN, 'GRAM')).toBeUndefined();
  });
});
