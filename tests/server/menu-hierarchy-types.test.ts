import { describe, expect, it } from 'vitest';

import {
  CanonicalRestaurantMenuSchema,
  CanonicalRestaurantMenuItemSchema,
  CanonicalRestaurantMenuOptionSchema,
  GOOGLE_FOOD_MENU_CUISINES,
  RestaurantMenuItemPatchSchema,
  RestaurantMenuOptionPatchSchema,
  buildCanonicalMenuLabel,
  parseCanonicalMenuMedia,
} from '@/server/menu-hierarchy/types';

describe('canonical menu hierarchy model', () => {
  it('normalizes Google-compatible labels with the Nabatable default language', () => {
    expect(
      buildCanonicalMenuLabel({
        displayName: '  Dinner  ',
        description: '  Evening food and drinks  ',
      }),
    ).toEqual({
      displayName: 'Dinner',
      description: 'Evening food and drinks',
      languageCode: 'en-GB',
    });
  });

  it('rejects local image URLs in Google media key storage', () => {
    expect(() =>
      parseCanonicalMenuMedia({
        googleMediaKeys: ['https://cdn.example.com/menu/chilli-paneer.jpg'],
      }),
    ).toThrow(/Google media keys/);

    expect(
      parseCanonicalMenuMedia({
        googleMediaKeys: ['locations/123/media/menu-photo'],
        localImageUrl: 'https://cdn.example.com/menu/chilli-paneer.jpg',
      }),
    ).toEqual({
      googleMediaKeys: ['locations/123/media/menu-photo'],
      localImageUrl: 'https://cdn.example.com/menu/chilli-paneer.jpg',
      localMedia: {},
    });
  });

  it('accepts the full Google FoodMenus cuisine enum and rejects invalid cuisines', () => {
    expect(GOOGLE_FOOD_MENU_CUISINES).toContain('CUISINE_UNSPECIFIED');
    expect(GOOGLE_FOOD_MENU_CUISINES).toContain('VIETNAMESE');
    expect(
      CanonicalRestaurantMenuSchema.parse({
        restaurantId: 'restaurant-1',
        labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
        menuKind: 'food',
        cuisines: [...GOOGLE_FOOD_MENU_CUISINES],
      }).cuisines,
    ).toEqual([...GOOGLE_FOOD_MENU_CUISINES]);
    expect(() =>
      CanonicalRestaurantMenuSchema.parse({
        restaurantId: 'restaurant-1',
        labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
        menuKind: 'food',
        cuisines: ['NOT_A_CUISINE'],
      }),
    ).toThrow();
  });

  it('keeps Nabatable operational extensions separate from Google attributes', () => {
    const parsed = CanonicalRestaurantMenuItemSchema.parse({
      restaurantId: 'restaurant-1',
      itemKind: 'drink',
      externalItemId: 'drink:house-lager',
      labels: [{ displayName: 'House Lager', languageCode: 'en-GB' }],
      attributes: {
        dietaryRestriction: ['VEGETARIAN'],
        mediaKeys: [],
      },
      extensions: {
        drinkProfile: { abv: 4.2, servingSize: 'pint' },
        customizationControls: { operationalModifierGroupIds: ['pour-size'] },
      },
    });

    expect(parsed.attributes).toMatchObject({
      dietaryRestriction: ['VEGETARIAN'],
      mediaKeys: [],
    });
    expect(parsed.extensions).toMatchObject({
      drinkProfile: { abv: 4.2, servingSize: 'pint' },
      customizationControls: { operationalModifierGroupIds: ['pour-size'] },
    });
  });

  it('accepts structured drink, recommendation, availability, customization, and source metadata', () => {
    const parsed = CanonicalRestaurantMenuItemSchema.parse({
      restaurantId: 'restaurant-1',
      itemKind: 'drink',
      externalItemId: 'drink:pinot-noir',
      labels: [{ displayName: 'Pinot Noir', languageCode: 'en-GB' }],
      extensions: {
        drinkProfile: {
          abvPercent: 13.5,
          volumeMl: 750,
          servingSize: 'Bottle',
          style: 'Red wine',
          region: 'Marlborough',
          grape: 'Pinot Noir',
          containsGluten: false,
          nonAlcoholic: false,
        },
        recommendationMetadata: {
          featured: true,
          signature: false,
          popularityScore: 84,
          pairingNotes: 'Pairs with lamb',
          recommendationTags: ['wine', 'red'],
        },
        availabilityPolicy: {
          availabilityStatus: 'available',
          soldOut: false,
          orderable: true,
          servicePeriods: ['dinner'],
        },
        customizationControls: {
          allowCustomizations: true,
          operationalModifierGroupIds: ['wine-size'],
          requiredOptionGroupIds: ['serve'],
          maxSelections: 1,
        },
        sourceMetadata: {
          sourceSystem: 'google-foodmenus',
          sourceItemId: 'google-item-1',
          importedAt: '2026-05-08T12:00:00Z',
        },
      },
    });

    expect(parsed.extensions.drinkProfile).toMatchObject({
      abvPercent: 13.5,
      servingSize: 'Bottle',
      grape: 'Pinot Noir',
    });
    expect(parsed.extensions.recommendationMetadata).toMatchObject({
      featured: true,
      recommendationTags: ['wine', 'red'],
    });
    expect(parsed.extensions.availabilityPolicy).toMatchObject({
      availabilityStatus: 'available',
      servicePeriods: ['dinner'],
    });
    expect(parsed.extensions.customizationControls).toMatchObject({
      operationalModifierGroupIds: ['wine-size'],
      requiredOptionGroupIds: ['serve'],
    });
  });

  it('keeps patch payloads sparse instead of applying create defaults', () => {
    expect(RestaurantMenuItemPatchSchema.parse({ active: false })).toEqual({ active: false });
    expect(RestaurantMenuOptionPatchSchema.parse({ active: false })).toEqual({ active: false });
  });

  it('accepts the complete Google attribute shape on items and options', () => {
    const attributes = {
      price: { currencyCode: 'gbp', amount: 12.5 },
      spiciness: 'HOT',
      allergen: ['DAIRY', 'WHEAT'],
      dietaryRestriction: ['VEGETARIAN'],
      ingredients: [
        {
          labels: [
            { displayName: 'Paneer', description: 'Cheese', languageCode: 'en-GB' },
            { displayName: 'Panir', description: null, languageCode: 'fr-FR' },
          ],
        },
      ],
      preparationMethods: ['FRIED', 'STIR_FRIED'],
      portionSize: {
        quantity: 2,
        unit: [
          { displayName: 'pieces', description: 'Two pieces', languageCode: 'en-GB' },
          { displayName: 'morceaux', description: null, languageCode: 'fr-FR' },
        ],
      },
      mediaKeys: ['locations/123/media/paneer'],
      nutritionFacts: {
        calories: { lowerAmount: 450, upperAmount: 500, unit: 'CALORIE' },
        totalFat: { lowerAmount: 12, upperAmount: 14, unit: 'GRAM' },
        cholesterol: { lowerAmount: 15, upperAmount: 20, unit: 'MILLIGRAM' },
        sodium: { lowerAmount: 250, upperAmount: 300, unit: 'MILLIGRAM' },
        totalCarbohydrate: { lowerAmount: 35, upperAmount: 40, unit: 'GRAM' },
        protein: { lowerAmount: 18, upperAmount: 22, unit: 'GRAM' },
      },
      servesNumPeople: 2,
    } as const;

    expect(
      CanonicalRestaurantMenuItemSchema.parse({
        restaurantId: 'restaurant-1',
        itemKind: 'food',
        externalItemId: 'food:paneer',
        labels: [
          { displayName: 'Chilli Paneer', languageCode: 'en-GB' },
          { displayName: 'Paneer pimente', languageCode: 'fr-FR' },
        ],
        attributes,
      }).attributes,
    ).toMatchObject({
      price: { currencyCode: 'GBP', amount: 12.5 },
      portionSize: { quantity: 2 },
      nutritionFacts: { calories: { lowerAmount: 450, upperAmount: 500 } },
      servesNumPeople: 2,
    });

    expect(
      CanonicalRestaurantMenuOptionSchema.parse({
        restaurantId: 'restaurant-1',
        externalOptionId: 'option:large',
        labels: [
          { displayName: 'Large', languageCode: 'en-GB' },
          { displayName: 'Grand', languageCode: 'fr-FR' },
        ],
        attributes,
      }).attributes,
    ).toMatchObject({
      allergen: ['DAIRY', 'WHEAT'],
      preparationMethods: ['FRIED', 'STIR_FRIED'],
      mediaKeys: ['locations/123/media/paneer'],
    });
  });
});
