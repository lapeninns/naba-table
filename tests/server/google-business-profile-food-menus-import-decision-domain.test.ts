import { describe, expect, it } from 'vitest';

import {
  hasPatchKey,
  isCreateSuggestedPatch,
  parseMenuMetadataPatch,
  parseSuggestedPatch,
} from '@/server/google-business-profile/food-menus-import-decision-domain';

describe('google business profile food menus import decision domain', () => {
  it('parses suggested item patches with normalization and conservative filtering', () => {
    expect(
      parseSuggestedPatch({
        externalItemId: ' google-paneer ',
        itemName: ' Chilli Paneer ',
        category: ' Starters ',
        subcategory: ' Vegetarian ',
        shortDescription: ' Crisp paneer ',
        basePrice: 9.5,
        currency: ' gbp ',
        spiceLevel: ' Hot ',
        preparationMethod: ' Grilled ',
        portionSize: ' large plate ',
        keyIngredients: ['Paneer', 123, 'Chilli'],
        imageUrl: ' https://example.com/paneer.jpg ',
        caloriesKcal: 450,
        proteinG: 17,
        sodiumMg: 850,
        servesNum: 2,
        dietaryTags: ['Vegetarian', false, 'Vegan'],
        allergensContains: ['Milk', null],
        modifierGroups: [
          {
            externalModifierGroupId: ' spice ',
            groupName: ' Spice ',
            required: true,
            minSelect: 1,
            maxSelect: 1,
            displayOrder: 2,
            options: [
              {
                externalModifierOptionId: ' mild ',
                optionName: ' Mild ',
                priceDelta: 0.5,
                defaultSelected: true,
                availabilityStatus: 'unavailable',
                displayOrder: 4,
              },
              { externalModifierOptionId: '', optionName: 'Invalid' },
            ],
          },
          { externalModifierGroupId: '', groupName: 'Invalid' },
        ],
      }),
    ).toEqual({
      externalItemId: 'google-paneer',
      itemName: 'Chilli Paneer',
      category: 'Starters',
      subcategory: 'Vegetarian',
      shortDescription: 'Crisp paneer',
      basePrice: 9.5,
      currency: 'GBP',
      spiceLevel: 'Hot',
      preparationMethod: 'Grilled',
      portionSize: 'large plate',
      keyIngredients: ['Paneer', 'Chilli'],
      imageUrl: 'https://example.com/paneer.jpg',
      caloriesKcal: 450,
      proteinG: 17,
      sodiumMg: 850,
      servesNum: 2,
      dietaryTags: ['Vegetarian', 'Vegan'],
      allergensContains: ['Milk'],
      modifierGroups: [
        {
          externalModifierGroupId: 'spice',
          groupName: 'Spice',
          required: true,
          minSelect: 1,
          maxSelect: 1,
          displayOrder: 2,
          options: [
            {
              externalModifierOptionId: 'mild',
              optionName: 'Mild',
              priceDelta: 0.5,
              defaultSelected: true,
              availabilityStatus: 'unavailable',
              displayOrder: 4,
            },
          ],
        },
      ],
    });
  });

  it('returns null for non-object or empty scalar-only suggested patches', () => {
    expect(parseSuggestedPatch(null)).toBeNull();
    expect(parseSuggestedPatch([])).toBeNull();
    expect(parseSuggestedPatch({ currency: '  ' })).toBeNull();
    expect(parseSuggestedPatch({ keyIngredients: [123] })).toEqual({ keyIngredients: [] });
  });

  it('validates create suggestions by required item fields and non-negative price', () => {
    expect(
      isCreateSuggestedPatch(
        parseSuggestedPatch({
          externalItemId: 'gbp-item',
          itemName: 'Google Item',
          category: 'Starters',
          basePrice: 0,
        }),
      ),
    ).toBe(true);
    expect(
      isCreateSuggestedPatch(
        parseSuggestedPatch({
          externalItemId: 'gbp-item',
          itemName: 'Google Item',
          category: 'Starters',
          basePrice: -1,
        }),
      ),
    ).toBe(false);
    expect(
      isCreateSuggestedPatch(
        parseSuggestedPatch({
          itemName: 'Google Item',
          category: 'Starters',
          basePrice: 9,
        }),
      ),
    ).toBe(false);
  });

  it('parses menu metadata patches while preserving explicit null clears', () => {
    expect(
      parseMenuMetadataPatch({
        menuLabel: ' Dinner menu ',
        sourceUrl: null,
        cuisines: ['INDIAN', 12, 'THAI'],
        languageCode: ' en-GB ',
      }),
    ).toEqual({
      menuLabel: 'Dinner menu',
      sourceUrl: null,
      cuisines: ['INDIAN', 'THAI'],
      languageCode: 'en-GB',
    });
    expect(parseMenuMetadataPatch({ menuLabel: '  ' })).toEqual({ menuLabel: null });
    expect(parseMenuMetadataPatch({ unknown: true })).toBeNull();
  });

  it('detects present patch keys separately from truthiness', () => {
    const patch = { sourceUrl: null };

    expect(hasPatchKey(patch, 'sourceUrl')).toBe(true);
    expect(hasPatchKey(patch, 'menuLabel')).toBe(false);
  });
});
