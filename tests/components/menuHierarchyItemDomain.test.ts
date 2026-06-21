import { describe, expect, it } from 'vitest';

import {
  buildItemPayload,
  itemInitialState,
} from '@/components/features/menu/menuHierarchyItemDomain';

import type { CanonicalRestaurantMenuItem } from '@/server/menu-hierarchy/types';

function label(displayName: string, description: string | null = null) {
  return { displayName, description, languageCode: 'en-GB' };
}

function buildCanonicalItem(): CanonicalRestaurantMenuItem {
  return {
    id: 'item-cocktail',
    restaurantId: 'rest-1',
    menuId: 'menu-drinks',
    sectionId: 'section-signatures',
    itemKind: 'drink',
    externalItemId: 'cocktail-signature',
    labels: [label('Signature cocktail', 'House special')],
    attributes: {
      price: { currencyCode: 'GBP', amount: 12.5 },
      spiciness: null,
      allergen: [],
      dietaryRestriction: [],
      ingredients: [{ labels: [label('Gin')] }, { labels: [label('Citrus')] }],
      preparationMethods: [],
      portionSize: {
        quantity: 1,
        unit: [label('glass'), { displayName: 'verre', description: null, languageCode: 'fr-FR' }],
      },
      mediaKeys: ['locations/1/media/google-1'],
      nutritionFacts: {
        calories: {
          lowerAmount: 140,
          upperAmount: 180,
          unit: 'CALORIE',
        },
      },
      servesNumPeople: 1,
    },
    media: {
      googleMediaKeys: ['locations/1/media/google-1'],
      localImageUrl: '/uploads/menu/cocktail.jpg',
      localMedia: {},
    },
    extensions: {
      drinkProfile: {
        abvPercent: 11,
        volumeMl: 125,
        style: 'spritz',
        containsCaffeine: false,
        nonAlcoholic: false,
        opsNote: 'Serve chilled',
      },
      recommendationMetadata: {
        featured: true,
        recommendationTags: ['aperitif', 'summer'],
      },
      availabilityPolicy: {
        availabilityStatus: 'seasonal',
        soldOut: false,
        orderable: true,
        servicePeriods: ['dinner', 'bar'],
      },
      customizationControls: {
        allowCustomizations: true,
        operationalModifierGroupIds: ['ice-level'],
        requiredOptionGroupIds: ['garnish'],
        maxSelections: 2,
      },
      sourceMetadata: {
        sourceSystem: 'importer',
        sourceItemId: 'source-123',
        opsNote: 'Imported from source menu',
      },
    },
    options: [],
    displayOrder: 2,
    active: true,
    legacySource: { importedFrom: 'legacy' },
  };
}

describe('menuHierarchyItemDomain', () => {
  it('hydrates item form state from canonical item extensions', () => {
    const state = itemInitialState(buildCanonicalItem(), 'drinks');

    expect(state.displayName).toBe('Signature cocktail');
    expect(state.ingredients).toBe('Gin, Citrus');
    expect(state.portionUnitName).toBe('glass');
    expect(state.portionAdditionalUnits).toContain('fr-FR | verre');
    expect(state.calories).toBe('140');
    expect(state.caloriesUpper).toBe('180');
    expect(state.abvPercent).toBe('11');
    expect(state.drinkProfileNote).toBe('Serve chilled');
    expect(state.recommendationTags).toBe('aperitif, summer');
    expect(state.modifierGroupIds).toBe('ice-level');
    expect(state.maxSelections).toBe('2');
    expect(state.sourceItemId).toBe('source-123');
  });

  it('builds item payloads without dropping existing extension metadata', () => {
    const existing = buildCanonicalItem();
    const state = {
      ...itemInitialState(existing, 'drinks'),
      price: '13.75',
      recommendationTags: 'aperitif, house',
      modifierGroupIds: 'ice-level, glassware',
    };

    const payload = buildItemPayload({
      state,
      menuKind: 'drinks',
      displayOrder: 4,
      existing,
    });

    expect(payload).toMatchObject({
      itemKind: 'drink',
      externalItemId: 'cocktail-signature',
      attributes: {
        price: { currencyCode: 'GBP', amount: 13.75 },
        mediaKeys: ['locations/1/media/google-1'],
        portionSize: {
          quantity: 1,
          unit: expect.arrayContaining([expect.objectContaining({ displayName: 'glass' })]),
        },
      },
      extensions: {
        recommendationMetadata: expect.objectContaining({
          featured: true,
          recommendationTags: ['aperitif', 'house'],
        }),
        customizationControls: expect.objectContaining({
          requiredOptionGroupIds: ['garnish'],
          operationalModifierGroupIds: ['ice-level', 'glassware'],
          maxSelections: 2,
        }),
        sourceMetadata: expect.objectContaining({
          sourceSystem: 'importer',
          sourceItemId: 'source-123',
          editedFrom: 'ops-menu-hierarchy-ui',
        }),
      },
      displayOrder: 4,
      legacySource: { importedFrom: 'legacy' },
    });
  });
});
