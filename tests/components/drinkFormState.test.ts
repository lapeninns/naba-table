import { describe, expect, it } from 'vitest';

import {
  buildDrinkItemPayload,
  createEmptyDrinkItemFormState,
  createEmptyDrinkModifierGroupFormState,
  createEmptyDrinkModifierOptionFormState,
} from '@/components/features/menu/drinkFormState';

describe('buildDrinkItemPayload', () => {
  it('normalizes drink booleans, arrays, scores, and numeric strings', () => {
    const form = createEmptyDrinkItemFormState();
    form.externalDrinkId = 'house-negroni';
    form.drinkName = 'House Negroni';
    form.category = 'cocktail';
    form.subcategory = ' classic ';
    form.basePrice = '11.50';
    form.currency = 'gbp';
    form.serviceTime = 'Evening';
    form.drinkType = 'cocktail';
    form.alcoholic = true;
    form.abv = '24.0';
    form.volumeMl = '120';
    form.servingSize = 'Short serve';
    form.servedStyle = 'On the rocks';
    form.temperature = 'Cold';
    form.baseSpirit = 'Gin';
    form.country = 'United Kingdom';
    form.sweetnessLevel = 'Low';
    form.bitternessLevel = 'High';
    form.acidityLevel = 'Low';
    form.bodyLevel = 'Medium';
    form.flavorProfile = 'Bitter, herbal, citrus';
    form.keyIngredients = 'gin, sweet vermouth, campari';
    form.garnish = 'Orange peel';
    form.containsCaffeine = false;
    form.dietaryTags = 'vegan';
    form.canBeMadeNonAlcoholic = true;
    form.customizationRules = 'Can be served up';
    form.pairings = 'salt beef croquettes, steak frites';
    form.signatureScore = '92';
    form.popularityScore = '88';
    form.recommendationTags = 'house favourite, aperitif';
    form.displayOrder = '10';
    form.imageUrl = 'https://example.com/negroni.jpg';

    const group = createEmptyDrinkModifierGroupFormState();
    group.externalModifierGroupId = 'negroni-style';
    group.groupName = 'Serve style';
    group.maxSelect = '1';

    const option = createEmptyDrinkModifierOptionFormState();
    option.externalModifierOptionId = 'served-up';
    option.optionName = 'Served up';
    option.priceDelta = '0.00';

    group.options = [option];
    form.modifierGroups = [group];

    expect(buildDrinkItemPayload(form)).toEqual({
      externalDrinkId: 'house-negroni',
      drinkName: 'House Negroni',
      category: 'cocktail',
      subcategory: 'classic',
      shortDescription: null,
      fullDescription: null,
      basePrice: 11.5,
      currency: 'GBP',
      serviceTime: 'Evening',
      availabilityStatus: 'available',
      drinkType: 'cocktail',
      alcoholic: true,
      abv: 24,
      volumeMl: 120,
      servingSize: 'Short serve',
      servedStyle: 'On the rocks',
      temperature: 'Cold',
      baseSpirit: 'Gin',
      beerStyle: null,
      wineType: null,
      grapeVarietal: null,
      region: null,
      country: 'United Kingdom',
      roastLevel: null,
      caffeineLevel: null,
      sweetnessLevel: 'Low',
      bitternessLevel: 'High',
      acidityLevel: 'Low',
      bodyLevel: 'Medium',
      flavorProfile: 'Bitter, herbal, citrus',
      keyIngredients: ['gin', 'sweet vermouth', 'campari'],
      garnish: 'Orange peel',
      containsDairy: false,
      containsNuts: false,
      containsGluten: false,
      containsCaffeine: false,
      dietaryTags: ['vegan'],
      allergensContains: [],
      allergensMayContain: [],
      canBeMadeNonAlcoholic: true,
      canBeMadeDecaf: false,
      customizationRules: 'Can be served up',
      pairings: ['salt beef croquettes', 'steak frites'],
      signatureScore: 92,
      popularityScore: 88,
      recommendationTags: ['house favourite', 'aperitif'],
      seasonal: false,
      limitedTime: false,
      soldOut: false,
      active: true,
      displayOrder: 10,
      imageUrl: 'https://example.com/negroni.jpg',
      modifierGroups: [
        {
          externalModifierGroupId: 'negroni-style',
          groupName: 'Serve style',
          required: false,
          minSelect: 0,
          maxSelect: 1,
          displayOrder: 0,
          options: [
            {
              externalModifierOptionId: 'served-up',
              optionName: 'Served up',
              priceDelta: 0,
              defaultSelected: false,
              availabilityStatus: 'available',
              displayOrder: 0,
            },
          ],
        },
      ],
    });
  });
});
