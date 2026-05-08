import { describe, expect, it } from 'vitest';

import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import {
  buildCanonicalGoogleFoodMenusProjection,
  buildGoogleFoodMenusImportReview,
  buildGoogleFoodMenusProjection,
  canonicalizeGoogleFoodMenusResource,
  classifyMenuTarget,
  hashGoogleFoodMenusResource,
  nutritionFactsFromGoogle,
} from '@/server/google-business-profile/food-menus';

import type { GoogleFoodMenusResource } from '@/server/google-business-profile/food-menus';
import type { MenuItemDetail } from '@/server/menu/types';
import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

function makeMenuItem(overrides: Partial<MenuItemDetail> = {}): MenuItemDetail {
  return {
    id: 'item-1',
    restaurantId: 'rest-1',
    externalItemId: 'starter-paneer',
    itemName: 'Chilli Paneer',
    category: 'Starters',
    subcategory: 'Vegetarian',
    shortDescription: 'Crisp paneer tossed with peppers and chilli sauce.',
    fullDescription: 'A richer internal description that remains in Nabatable.',
    basePrice: 8.95,
    currency: 'GBP',
    serviceTime: 'Dinner',
    availabilityStatus: 'available',
    keyIngredients: ['Paneer', 'Peppers', 'Chilli'],
    mainProteinOrBase: 'Paneer',
    cookingStyle: 'Stir fried',
    preparationMethod: 'Fried',
    flavorProfile: 'Savoury',
    texture: 'Crisp',
    spiceLevel: 'Medium',
    spiceAdjustable: true,
    portionSize: 'starter plate',
    shareable: true,
    recommendationTags: ['signature'],
    pairings: ['Lager'],
    signatureScore: 95,
    popularityScore: 80,
    dietaryTags: ['Vegetarian'],
    allergensContains: ['Milk', 'Wheat'],
    allergensMayContain: ['Nuts'],
    removableIngredients: ['Chilli'],
    substitutionsAllowed: true,
    canBeMadeVegetarian: true,
    canBeMadeVegan: false,
    canBeMadeGlutenFree: false,
    customizationRules: 'Can reduce spice.',
    servingNotes: 'Serve hot.',
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: 10,
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

describe('buildGoogleFoodMenusProjection', () => {
  it('projects active canonical food and mixed menus into deterministic Google menus', () => {
    const canonicalMenus: CanonicalRestaurantMenu[] = [
      {
        id: 'drinks-menu',
        restaurantId: 'rest-1',
        labels: [{ displayName: 'Drinks', languageCode: 'en-GB' }],
        sourceUrl: null,
        cuisines: [],
        defaultLanguageCode: 'en-GB',
        menuKind: 'drinks',
        displayOrder: 0,
        active: true,
        legacySource: {},
        sections: [],
      },
      {
        id: 'food-menu',
        restaurantId: 'rest-1',
        labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
        sourceUrl: 'https://example.com/dinner',
        cuisines: ['INDIAN', 'VIETNAMESE'],
        defaultLanguageCode: 'en-GB',
        menuKind: 'food',
        displayOrder: 1,
        active: true,
        legacySource: {},
        sections: [
          {
            id: 'section-1',
            restaurantId: 'rest-1',
            menuId: 'food-menu',
            labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
            displayOrder: 0,
            active: true,
            legacyCategory: 'Starters',
            legacySubcategory: null,
            legacySource: {},
            items: [
              {
                id: 'item-1',
                restaurantId: 'rest-1',
                menuId: 'food-menu',
                sectionId: 'section-1',
                itemKind: 'food',
                externalItemId: 'starter-paneer',
                legacySource: {},
                labels: [{ displayName: 'Chilli Paneer', languageCode: 'en-GB' }],
                attributes: {
                  price: { currencyCode: 'GBP', amount: 8.95 },
                  spiciness: null,
                  allergen: [],
                  dietaryRestriction: [],
                  ingredients: [],
                  preparationMethods: [],
                  mediaKeys: [],
                  nutritionFacts: {
                    calories: { unit: 'CALORIE', lowerAmount: 450 },
                    cholesterol: { unit: 'MILLIGRAM', lowerAmount: 35 },
                    protein: { unit: 'GRAM', lowerAmount: 17 },
                  },
                },
                media: {
                  googleMediaKeys: ['locations/123/media/paneer'],
                  localImageUrl: 'https://cdn.example.test/paneer.jpg',
                  localMedia: {},
                },
                extensions: {
                  drinkProfile: {},
                  recommendationMetadata: {},
                  availabilityPolicy: {},
                  customizationControls: {},
                  sourceMetadata: {},
                },
                options: [
                  {
                    id: 'option-large',
                    restaurantId: 'rest-1',
                    menuItemId: 'item-1',
                    externalOptionId: 'large',
                    labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
                    attributes: {
                      price: { currencyCode: 'GBP', amount: 10.95 },
                      spiciness: null,
                      allergen: [],
                      dietaryRestriction: [],
                      ingredients: [],
                      preparationMethods: [],
                      mediaKeys: [],
                      nutritionFacts: {},
                    },
                    media: { googleMediaKeys: [], localMedia: {} },
                    displayOrder: 0,
                    active: true,
                    legacySource: {},
                  },
                ],
                displayOrder: 0,
                active: true,
              },
            ],
          },
        ],
      },
    ];

    const projection = buildCanonicalGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menus: canonicalMenus,
    });

    expect(projection.foodMenus.menus).toHaveLength(1);
    expect(projection.foodMenus.menus[0]).toMatchObject({
      labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
      sourceUrl: 'https://example.com/dinner',
      cuisines: ['INDIAN', 'VIETNAMESE'],
      sections: [
        {
          labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
          items: [
            {
              labels: [{ displayName: 'Chilli Paneer', languageCode: 'en-GB' }],
              attributes: {
                price: { currencyCode: 'GBP', units: '8', nanos: 950000000 },
                mediaKeys: ['locations/123/media/paneer'],
                nutritionFacts: {
                  calories: { unit: 'CALORIE', lowerAmount: 450 },
                  cholesterol: { unit: 'MILLIGRAM', lowerAmount: 35 },
                  protein: { unit: 'GRAM', lowerAmount: 17 },
                },
              },
              options: [
                {
                  labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
                  attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 950000000 } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(projection.identities[0]?.googlePath).toBe('menus[0].sections[0].items[0]');
    expect(projection.identities[0]?.googleOptionPaths[0]?.googlePath).toBe(
      'menus[0].sections[0].items[0].options[0]',
    );
  });

  it('projects rich Nabatable menu items into a Google FoodMenus payload and identity map', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: 'Dinner menu',
      sourceUrl: 'https://example.com/menu',
      items: [makeMenuItem()],
      cuisines: ['INDIAN'],
    });

    expect(projection.foodMenus).toMatchObject({
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
                      description: 'Crisp paneer tossed with peppers and chilli sauce.',
                      languageCode: 'en-GB',
                    },
                  ],
                  attributes: {
                    price: { currencyCode: 'GBP', units: '8', nanos: 950000000 },
                    spiciness: 'MEDIUM',
                    allergen: ['DAIRY', 'WHEAT'],
                    dietaryRestriction: ['VEGETARIAN'],
                    ingredients: [
                      { labels: [{ displayName: 'Paneer', languageCode: 'en-GB' }] },
                      { labels: [{ displayName: 'Peppers', languageCode: 'en-GB' }] },
                      { labels: [{ displayName: 'Chilli', languageCode: 'en-GB' }] },
                    ],
                    preparationMethods: ['FRIED', 'STIR_FRIED'],
                    portionSize: {
                      quantity: 1,
                      unit: [{ displayName: 'starter plate', languageCode: 'en-GB' }],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(projection.identities).toEqual([
      {
        stableKey: 'foodMenu.item.starters/vegetarian.starter-paneer',
        localItemId: 'item-1',
        externalItemId: 'starter-paneer',
        itemName: 'Chilli Paneer',
        sectionKey: 'starters/vegetarian',
        sectionLabel: 'Starters - Vegetarian',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: [],
      },
    ]);
    expect(projection.skippedItems).toEqual([]);
  });

  it('skips inactive, sold-out, and unavailable items by default', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [
        makeMenuItem({ id: 'inactive', externalItemId: 'inactive', active: false }),
        makeMenuItem({ id: 'sold-out', externalItemId: 'sold-out', soldOut: true }),
        makeMenuItem({
          id: 'unavailable',
          externalItemId: 'unavailable',
          availabilityStatus: 'unavailable',
        }),
      ],
    });

    expect(projection.foodMenus.menus[0]?.sections).toEqual([]);
    expect(projection.identities).toEqual([]);
    expect(projection.skippedItems).toEqual([
      { localItemId: 'inactive', externalItemId: 'inactive', reason: 'inactive' },
      { localItemId: 'sold-out', externalItemId: 'sold-out', reason: 'sold_out' },
      { localItemId: 'unavailable', externalItemId: 'unavailable', reason: 'unavailable' },
    ]);
  });

  it('projects available modifier options with deterministic identity paths', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      languageCode: 'en',
      items: [
        makeMenuItem({
          modifierGroups: [
            {
              id: 'group-1',
              restaurantId: 'rest-1',
              menuItemId: 'item-1',
              externalModifierGroupId: 'spice',
              groupName: 'Spice level',
              required: false,
              minSelect: 0,
              maxSelect: 1,
              displayOrder: 0,
              createdAt: '2026-05-01T10:00:00.000Z',
              updatedAt: '2026-05-01T10:00:00.000Z',
              options: [
                {
                  id: 'option-hot',
                  restaurantId: 'rest-1',
                  modifierGroupId: 'group-1',
                  externalModifierOptionId: 'hot',
                  optionName: 'Extra hot',
                  priceDelta: 0.5,
                  defaultSelected: false,
                  availabilityStatus: 'available',
                  displayOrder: 0,
                  createdAt: '2026-05-01T10:00:00.000Z',
                  updatedAt: '2026-05-01T10:00:00.000Z',
                },
                {
                  id: 'option-gone',
                  restaurantId: 'rest-1',
                  modifierGroupId: 'group-1',
                  externalModifierOptionId: 'gone',
                  optionName: 'Unavailable option',
                  priceDelta: 0,
                  defaultSelected: false,
                  availabilityStatus: 'unavailable',
                  displayOrder: 1,
                  createdAt: '2026-05-01T10:00:00.000Z',
                  updatedAt: '2026-05-01T10:00:00.000Z',
                },
              ],
            },
          ],
        }),
      ],
    });

    const item = projection.foodMenus.menus[0]?.sections[0]?.items[0];
    expect(item?.options).toEqual([
      {
        labels: [{ displayName: 'Extra hot', languageCode: 'en' }],
        attributes: expect.objectContaining({
          price: { currencyCode: 'GBP', units: '9', nanos: 450000000 },
        }),
      },
    ]);
    expect(projection.identities[0]?.googleOptionPaths).toEqual([
      {
        externalModifierGroupId: 'spice',
        externalModifierOptionId: 'hot',
        googlePath: 'menus[0].sections[0].items[0].options[0]',
      },
    ]);
  });

  it('sorts sections and items deterministically by display order then label', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [
        makeMenuItem({
          id: 'z',
          externalItemId: 'z',
          itemName: 'Z item',
          category: 'Mains',
          subcategory: null,
          displayOrder: 20,
        }),
        makeMenuItem({
          id: 'a',
          externalItemId: 'a',
          itemName: 'A item',
          category: 'Starters',
          subcategory: null,
          displayOrder: 10,
        }),
        makeMenuItem({
          id: 'b',
          externalItemId: 'b',
          itemName: 'B item',
          category: 'Starters',
          subcategory: null,
          displayOrder: 10,
        }),
      ],
    });

    expect(
      projection.foodMenus.menus[0]?.sections.map((section) => section.labels[0]?.displayName),
    ).toEqual(['Starters', 'Mains']);
    expect(
      projection.foodMenus.menus[0]?.sections[0]?.items.map((item) => item.labels[0]?.displayName),
    ).toEqual(['A item', 'B item']);
  });

  it('reviews Google FoodMenus imports as suggestions matched by previous identity', () => {
    const localItem = makeMenuItem();
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [localItem],
    });
    const googleFoodMenus = structuredClone(projection.foodMenus);
    const googleItem = googleFoodMenus.menus[0]!.sections[0]!.items[0]!;
    googleItem.labels[0] = {
      displayName: 'Chilli Paneer',
      description: 'Updated by Google',
      languageCode: 'en-GB',
    };
    googleItem.attributes.price = { currencyCode: 'GBP', units: '9', nanos: 500000000 };
    googleItem.attributes.dietaryRestriction = ['VEGETARIAN', 'VEGAN'];
    googleItem.attributes.allergen = ['DAIRY'];
    googleItem.attributes.spiciness = 'HOT';
    googleItem.attributes.portionSize = {
      quantity: 2,
      unit: [{ displayName: 'pieces', languageCode: 'en-GB' }],
    };
    googleItem.attributes.nutritionFacts = {
      calories: { unit: 'CALORIE', lowerAmount: 450 },
      protein: { unit: 'GRAM', lowerAmount: 17 },
      sodium: { unit: 'MILLIGRAM', lowerAmount: 850 },
    };
    googleItem.attributes.servesNumPeople = 2;

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus,
      localItems: [localItem],
      previousIdentities: projection.identities,
    });

    expect(review.items).toEqual([
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
        suggestedPatch: {
          shortDescription: 'Updated by Google',
          basePrice: 9.5,
          dietaryTags: ['Vegan', 'Vegetarian'],
          allergensContains: ['Milk'],
          spiceLevel: 'Hot',
          portionSize: '2 pieces',
          caloriesKcal: 450,
          proteinG: 17,
          sodiumMg: 850,
          servesNum: 2,
        },
        warnings: [],
      },
    ]);
    expect(review.localItemsMissingFromGoogle).toEqual([]);
  });

  it('can fall back to conservative section, name, and price matching', () => {
    const localItem = makeMenuItem();
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [localItem],
    });

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: projection.foodMenus,
      localItems: [localItem],
      previousIdentities: [],
    });

    expect(review.items[0]?.match).toEqual({
      status: 'matched',
      confidence: 'section_name_price',
      localItemId: 'item-1',
      externalItemId: 'starter-paneer',
    });
    expect(review.items[0]?.suggestedPatch).toBeNull();
  });

  it('creates menu metadata suggestions for each Google menu path', () => {
    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: {
        name: 'accounts/123/locations/456/foodMenus',
        menus: [
          {
            labels: [{ displayName: 'Breakfast menu', languageCode: 'en-GB' }],
            cuisines: ['BREAK_FAST'],
            sections: [],
          },
          {
            labels: [{ displayName: 'Dinner menu', languageCode: 'en-GB' }],
            cuisines: ['INDIAN'],
            sections: [],
          },
        ],
      },
      localItems: [],
      previousIdentities: [],
      settings: {
        menuLabel: 'Old menu',
        sourceUrl: null,
        cuisines: [],
        languageCode: 'en-GB',
      },
    });

    expect(
      review.items
        .filter((item) => item.match.status === 'menu_metadata')
        .map((item) => item.googlePath),
    ).toEqual(['menus[0].metadata', 'menus[1].metadata']);
  });

  it('keeps matched Google rows without prices as suggestions instead of crashing', () => {
    const localItem = makeMenuItem();
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [localItem],
    });
    const googleFoodMenus = structuredClone(projection.foodMenus);
    delete googleFoodMenus.menus[0]!.sections[0]!.items[0]!.attributes.price;

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus,
      localItems: [localItem],
      previousIdentities: projection.identities,
    });

    expect(review.items[0]?.match).toMatchObject({
      status: 'matched',
      confidence: 'previous_identity',
    });
    expect(review.items[0]?.suggestedPatch).toBeNull();
    expect(review.items[0]?.warnings).toEqual(['Google item has no parseable price.']);
  });

  it('keeps unmatched Google rows as explicit create suggestions and does not delete missing local rows', () => {
    const localItem = makeMenuItem();
    const googleOnlyItem = makeMenuItem({
      id: 'google-only-local-shape',
      externalItemId: 'google-only',
      itemName: 'Google Only Dish',
      category: 'Mains',
      subcategory: null,
      basePrice: 12,
    });
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [googleOnlyItem],
    });

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: projection.foodMenus,
      localItems: [localItem],
      previousIdentities: [],
    });

    expect(review.items).toEqual([
      expect.objectContaining({
        googlePath: 'menus[0].sections[0].items[0]',
        googleSectionLabel: 'Mains',
        googleItemName: 'Google Only Dish',
        targetKind: 'food',
        match: { status: 'unmatched', confidence: 'none' },
        suggestedPatch: expect.objectContaining({
          externalItemId: 'gbp-menus-0-sections-0-items-0',
          itemName: 'Google Only Dish',
          category: 'Mains',
          basePrice: 12,
          currency: 'GBP',
        }),
      }),
      expect.objectContaining({
        googlePath: null,
        googleItemName: 'Chilli Paneer',
        targetKind: 'food',
        match: {
          status: 'missing_from_google',
          confidence: 'none',
          localItemId: 'item-1',
          externalItemId: 'starter-paneer',
        },
      }),
    ]);
    expect(review.localItemsMissingFromGoogle).toEqual([
      {
        localItemId: 'item-1',
        externalItemId: 'starter-paneer',
        itemName: 'Chilli Paneer',
        targetKind: 'food',
        reason: 'not_present_in_google',
      },
    ]);
  });

  it('classifies drink menus conservatively and keeps mixed food-and-drinks menus as food', () => {
    const menu = (displayName: string) => ({
      labels: [{ displayName, languageCode: 'en-GB' }],
      sections: [],
    });

    expect(classifyMenuTarget(menu('Drinks Menu'))).toBe('drink');
    expect(classifyMenuTarget(menu('Bar list'))).toBe('drink');
    expect(classifyMenuTarget(menu('Food and Drinks'))).toBe('food');
    expect(classifyMenuTarget(menu('Dinner menu'))).toBe('food');
  });

  it('imports Google item options as a reviewable synthetic Options modifier group', () => {
    const localItem = makeMenuItem();
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [localItem],
    });
    const googleFoodMenus = structuredClone(projection.foodMenus);
    googleFoodMenus.menus[0]!.sections[0]!.items[0]!.options = [
      {
        labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
        attributes: { price: { currencyCode: 'GBP', units: '10', nanos: 950000000 } },
      },
    ];

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus,
      localItems: [localItem],
      previousIdentities: projection.identities,
    });

    const matched = review.items.find((item) => item.match.status === 'matched');
    expect(matched?.suggestedPatch).toEqual(
      expect.objectContaining({
        modifierGroups: [
          {
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
          },
        ],
      }),
    );
  });

  it('canonicalizes FoodMenus resources for stable preflight hashing', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      menuLabel: ' Dinner menu ',
      sourceUrl: ' https://example.com/menu ',
      items: [makeMenuItem()],
      cuisines: ['INDIAN', 'VEGETARIAN'],
    });
    const withPresentationNoise = structuredClone(projection.foodMenus);
    withPresentationNoise.menus[0]!.labels[0] = {
      displayName: '  Dinner menu  ',
      description: '   ',
      languageCode: '',
    };
    withPresentationNoise.menus[0]!.sections[0]!.items[0]!.attributes.allergen = ['WHEAT', 'DAIRY'];
    withPresentationNoise.menus[0]!.sections[0]!.items[0]!.attributes.dietaryRestriction = [
      'VEGETARIAN',
      'VEGAN',
    ];

    const canonical = canonicalizeGoogleFoodMenusResource(withPresentationNoise);

    expect(canonical.menus[0]?.labels).toEqual([
      { displayName: 'Dinner menu', languageCode: 'en-GB' },
    ]);
    expect(canonical.menus[0]?.sourceUrl).toBe('https://example.com/menu');
    expect(canonical.menus[0]?.cuisines).toEqual(['INDIAN', 'VEGETARIAN']);
    expect(canonical.menus[0]?.sections[0]?.items[0]?.attributes).toMatchObject({
      price: { currencyCode: 'GBP', amount: 8.95 },
      allergen: ['DAIRY', 'WHEAT'],
      dietaryRestriction: ['VEGAN', 'VEGETARIAN'],
      ingredients: ['Chilli', 'Paneer', 'Peppers'],
      preparationMethods: ['FRIED', 'STIR_FRIED'],
      portionSize: 'starter plate',
    });
    expect(hashGoogleFoodMenusResource(withPresentationNoise)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats an omitted Google menus array as an empty FoodMenus resource', () => {
    const emptyGoogleResource = {
      name: 'accounts/123/locations/456/foodMenus',
    } as GoogleFoodMenusResource;

    expect(canonicalizeGoogleFoodMenusResource(emptyGoogleResource)).toEqual({
      name: 'accounts/123/locations/456/foodMenus',
      menus: [],
    });
    expect(hashGoogleFoodMenusResource(emptyGoogleResource)).toMatch(/^[a-f0-9]{64}$/);

    const review = buildGoogleFoodMenusImportReview({
      googleFoodMenus: emptyGoogleResource,
      localItems: [makeMenuItem()],
    });

    expect(review.items).toContainEqual(
      expect.objectContaining({
        googleItemName: 'Chilli Paneer',
        match: expect.objectContaining({ status: 'missing_from_google' }),
      }),
    );
    expect(review.localItemsMissingFromGoogle).toHaveLength(1);
  });

  it('adds extended attributes to canonical output without changing legacy payload hashes', () => {
    const foodMenus = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [makeMenuItem()],
    }).foodMenus;
    const canonical = canonicalizeGoogleFoodMenusResource(foodMenus);
    const legacyCanonical = structuredClone(canonical);
    const legacyAttributes = legacyCanonical.menus[0]!.sections[0]!.items[0]!.attributes as Record<
      string,
      unknown
    >;
    delete legacyAttributes.mediaKeys;
    delete legacyAttributes.nutritionFacts;
    delete legacyAttributes.servesNumPeople;

    expect(canonical.menus[0]?.sections[0]?.items[0]?.attributes).toMatchObject({
      mediaKeys: [],
      nutritionFacts: {
        calories: { unit: null, lowerAmount: null, upperAmount: null },
        totalFat: { unit: null, lowerAmount: null, upperAmount: null },
        saturatedFat: { unit: null, lowerAmount: null, upperAmount: null },
        cholesterol: { unit: null, lowerAmount: null, upperAmount: null },
        sodium: { unit: null, lowerAmount: null, upperAmount: null },
        totalCarbohydrate: { unit: null, lowerAmount: null, upperAmount: null },
        sugars: { unit: null, lowerAmount: null, upperAmount: null },
        dietaryFiber: { unit: null, lowerAmount: null, upperAmount: null },
        protein: { unit: null, lowerAmount: null, upperAmount: null },
      },
      servesNumPeople: null,
    });
    expect(hashGoogleFoodMenusResource(foodMenus)).toBe(hashCanonicalJson(legacyCanonical));
  });

  it('maps nutrition facts into Nabatable nutrition columns', () => {
    expect(
      nutritionFactsFromGoogle({
        calories: { unit: 'CALORIE', lowerAmount: 640.2 },
        protein: { unit: 'GRAM', lowerAmount: 18.25 },
        totalFat: { unit: 'GRAM', lowerAmount: 21 },
        totalCarbohydrate: { unit: 'GRAM', lowerAmount: 80 },
        sodium: { unit: 'GRAM', lowerAmount: 1.2 },
      }),
    ).toEqual({
      caloriesKcal: 640,
      proteinG: 18.25,
      fatG: 21,
      saturatedFatG: null,
      carbsG: 80,
      sugarG: null,
      fiberG: null,
      sodiumMg: 1200,
    });
  });

  it('canonicalizes FoodMenus rows with omitted optional price fields', () => {
    const projection = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [makeMenuItem()],
    });
    delete projection.foodMenus.menus[0]!.sections[0]!.items[0]!.attributes.price;

    expect(
      canonicalizeGoogleFoodMenusResource(projection.foodMenus).menus[0]?.sections[0]?.items[0]
        ?.attributes.price,
    ).toEqual({
      currencyCode: 'GBP',
      amount: null,
    });
  });

  it('changes the canonical hash when menu content changes', () => {
    const first = buildGoogleFoodMenusProjection({
      foodMenusName: 'accounts/123/locations/456/foodMenus',
      items: [makeMenuItem()],
    }).foodMenus;
    const second = structuredClone(first);
    second.menus[0]!.sections[0]!.items[0]!.attributes.price = {
      currencyCode: 'GBP',
      units: '10',
      nanos: 0,
    };

    expect(hashGoogleFoodMenusResource(first)).not.toBe(hashGoogleFoodMenusResource(second));
  });
});
