import { describe, expect, it } from 'vitest';

import {
  buildLabel,
  buildMoney,
  canonicalizeGoogleFoodMenusResource,
  cleanText,
  googleMoneyToNumber,
  hashGoogleFoodMenusResource,
  normalizeStringValues,
  slugify,
} from '@/server/google-business-profile/food-menus-serialization';

import type { GoogleFoodMenusResource } from '@/server/google-business-profile/food-menus';

describe('google food menus serialization domain', () => {
  it('normalizes text, slugs, labels, and money values', () => {
    expect(cleanText('  Chicken   Tikka  ')).toBe('Chicken Tikka');
    expect(cleanText('   ')).toBeNull();
    expect(slugify('Chef Special / Hot', 'fallback')).toBe('chef-special-hot');
    expect(slugify('---', 'fallback')).toBe('fallback');
    expect(buildLabel('  Menu   Item ', '  Rich   sauce ', 'en-GB')).toEqual({
      displayName: 'Menu Item',
      description: 'Rich sauce',
      languageCode: 'en-GB',
    });
    expect(buildMoney(12.345, 'gbp')).toEqual({
      currencyCode: 'GBP',
      units: '12',
      nanos: 350_000_000,
    });
    expect(googleMoneyToNumber({ currencyCode: 'GBP', units: '12', nanos: 350_000_000 })).toBe(
      12.35,
    );
  });

  it('normalizes string arrays for deterministic comparisons', () => {
    expect(normalizeStringValues([' Vegan ', '', 'Halal', 'vegan', 'Halal'])).toEqual([
      'Halal',
      'vegan',
      'Vegan',
    ]);
  });

  it('canonicalizes labels, prices, attributes, and option payloads', () => {
    const foodMenus: GoogleFoodMenusResource = {
      name: 'accounts/1/locations/2/foodMenus/3',
      menus: [
        {
          labels: [{ displayName: '  Food   menu ', languageCode: '' }],
          sourceUrl: ' https://example.com/menu ',
          cuisines: ['NEPALESE', 'INDIAN', 'INDIAN'],
          sections: [
            {
              labels: [{ displayName: ' Mains ', description: '  Main dishes ', languageCode: '' }],
              items: [
                {
                  labels: [{ displayName: ' Curry ', languageCode: 'en' }],
                  attributes: {
                    price: { currencyCode: 'gbp', units: '10', nanos: 500_000_000 },
                    allergen: ['DAIRY', 'DAIRY'],
                    dietaryRestriction: ['HALAL'],
                    ingredients: [{ labels: [{ displayName: '  Chicken ', languageCode: 'en' }] }],
                    mediaKeys: [' image-2 ', 'image-1'],
                    nutritionFacts: {
                      calories: { unit: 'kcal', quantity: 123.456 },
                    },
                    servesNum: 2.8,
                  },
                  options: [
                    {
                      labels: [{ displayName: ' Large ', languageCode: 'en' }],
                      attributes: {
                        price: { currencyCode: 'GBP', units: '2', nanos: 0 },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(canonicalizeGoogleFoodMenusResource(foodMenus)).toMatchObject({
      name: 'accounts/1/locations/2/foodMenus/3',
      menus: [
        {
          labels: [{ displayName: 'Food menu', languageCode: 'en-GB' }],
          sourceUrl: 'https://example.com/menu',
          cuisines: ['INDIAN', 'NEPALESE'],
          sections: [
            {
              labels: [
                {
                  displayName: 'Mains',
                  description: 'Main dishes',
                  languageCode: 'en-GB',
                },
              ],
              items: [
                {
                  attributes: {
                    price: { currencyCode: 'GBP', amount: 10.5 },
                    allergen: ['DAIRY'],
                    dietaryRestriction: ['HALAL'],
                    ingredients: ['Chicken'],
                    mediaKeys: ['image-1', 'image-2'],
                    servesNumPeople: 2,
                  },
                  options: [
                    {
                      labels: [{ displayName: 'Large', languageCode: 'en' }],
                      attributes: {
                        price: { currencyCode: 'GBP', amount: 2 },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(hashGoogleFoodMenusResource(foodMenus)).toMatch(/^[a-f0-9]{64}$/);
  });
});
