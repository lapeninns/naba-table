import { describe, expect, it } from 'vitest';

import {
  CanonicalRestaurantMenuSchema,
  CanonicalRestaurantMenuItemSchema,
  GOOGLE_FOOD_MENU_CUISINES,
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
});
