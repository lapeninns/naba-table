'use client';

import type {
  DrinkFacetSet,
  DrinkImportResult,
  DrinkItemDetail,
  DrinkListFilters,
  DrinkListResponse,
} from '@/server/drinks-menu/types';
import type { DrinkMenuService } from '@/services/ops/drinks-menu';

type DevDrinkMenuState = {
  items: DrinkItemDetail[];
};

function createSeedItems(): DrinkItemDetail[] {
  return [
    {
      id: 'drink-item-1',
      restaurantId: 'dev-restaurant',
      externalDrinkId: 'house-negroni',
      drinkName: 'House Negroni',
      category: 'cocktail',
      subcategory: 'classic',
      shortDescription: 'Bittersweet gin-led classic served over a large cube.',
      fullDescription: 'A balanced house negroni with London dry gin, sweet vermouth, and Campari, finished with orange oils.',
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
      dietaryTags: ['Vegan'],
      allergensContains: [],
      allergensMayContain: [],
      canBeMadeNonAlcoholic: true,
      canBeMadeDecaf: false,
      customizationRules: 'Can be served up on request.',
      pairings: ['Salt beef croquettes', 'Steak frites'],
      signatureScore: 92,
      popularityScore: 88,
      recommendationTags: ['House favourite', 'Aperitif'],
      seasonal: false,
      limitedTime: false,
      soldOut: false,
      active: true,
      displayOrder: 10,
      imageUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modifierGroups: [
        {
          id: 'drink-group-1',
          restaurantId: 'dev-restaurant',
          drinkItemId: 'drink-item-1',
          externalModifierGroupId: 'negroni-style',
          groupName: 'Serve style',
          required: false,
          minSelect: 0,
          maxSelect: 1,
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: [
            {
              id: 'drink-option-1',
              restaurantId: 'dev-restaurant',
              modifierGroupId: 'drink-group-1',
              externalModifierOptionId: 'served-up',
              optionName: 'Served up',
              priceDelta: 0,
              defaultSelected: false,
              availabilityStatus: 'available',
              displayOrder: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  ];
}

function buildFacets(items: DrinkItemDetail[]): DrinkFacetSet {
  return {
    categories: Array.from(new Set(items.map((item) => item.category))).sort(),
    subcategories: Array.from(new Set(items.map((item) => item.subcategory).filter(Boolean) as string[])).sort(),
    serviceTimes: Array.from(new Set(items.map((item) => item.serviceTime).filter(Boolean) as string[])).sort(),
    drinkTypes: Array.from(new Set(items.map((item) => item.drinkType).filter(Boolean) as string[])).sort(),
  };
}

function toListResponse(items: DrinkItemDetail[], filters: DrinkListFilters): DrinkListResponse {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const filtered = items.filter((item) => {
    if (search) {
      const haystack = `${item.drinkName} ${item.category} ${item.subcategory ?? ''} ${item.drinkType ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.category && item.category !== filters.category) return false;
    if (filters.subcategory && item.subcategory !== filters.subcategory) return false;
    switch (filters.status) {
      case 'active':
        return item.active;
      case 'inactive':
        return !item.active;
      case 'sold-out':
        return item.soldOut;
      case 'available':
        return item.availabilityStatus === 'available';
      case 'unavailable':
        return item.availabilityStatus === 'unavailable';
      default:
        return true;
    }
  });

  return {
    items: filtered.map((item) => ({
      id: item.id,
      restaurantId: item.restaurantId,
      externalDrinkId: item.externalDrinkId,
      drinkName: item.drinkName,
      category: item.category,
      subcategory: item.subcategory,
      basePrice: item.basePrice,
      currency: item.currency,
      serviceTime: item.serviceTime,
      availabilityStatus: item.availabilityStatus,
      drinkType: item.drinkType,
      alcoholic: item.alcoholic,
      active: item.active,
      soldOut: item.soldOut,
      displayOrder: item.displayOrder,
      imageUrl: item.imageUrl,
      modifierGroupCount: item.modifierGroups.length,
      updatedAt: item.updatedAt,
    })),
    facets: buildFacets(items),
  };
}

function estimateRows(file: File): Promise<number> {
  return file
    .text()
    .then((text) => text.split(/\r?\n/).filter((line) => line.trim().length > 0).length - 1)
    .then((count) => Math.max(count, 0));
}

export function createDevDrinkMenuService(): DrinkMenuService {
  const state: DevDrinkMenuState = {
    items: createSeedItems(),
  };

  const previewImport: DrinkMenuService['previewImport'] = async (_restaurantId, payload) => {
    const itemRows = await estimateRows(payload.itemsFile);
    const groupRows = payload.modifierGroupsFile ? await estimateRows(payload.modifierGroupsFile) : 0;
    const optionRows = payload.modifierOptionsFile ? await estimateRows(payload.modifierOptionsFile) : 0;
    return {
      applied: false,
      canApply: true,
      summary: {
        itemRows,
        modifierGroupRows: groupRows,
        modifierOptionRows: optionRows,
        itemsToCreate: itemRows,
        itemsToUpdate: 0,
        modifierGroupsToCreate: groupRows,
        modifierGroupsToUpdate: 0,
        modifierOptionsToCreate: optionRows,
        modifierOptionsToUpdate: 0,
        impactedItemCount: itemRows,
        replaceModifiers: Boolean(payload.modifierGroupsFile),
      },
      errors: [],
    };
  };

  return {
    async listItems(_restaurantId, filters = {}) {
      return toListResponse(state.items, filters);
    },
    async getItem(_restaurantId, itemId) {
      const item = state.items.find((entry) => entry.id === itemId);
      if (!item) {
        throw new Error('Item not found');
      }
      return structuredClone(item);
    },
    async createItem(restaurantId, payload) {
      const created: DrinkItemDetail = {
        ...payload,
        id: `drink-item-${state.items.length + 1}`,
        restaurantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modifierGroups: payload.modifierGroups.map((group, groupIndex) => ({
          ...group,
          id: `drink-group-${state.items.length + groupIndex + 1}`,
          restaurantId,
          drinkItemId: `drink-item-${state.items.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: group.options.map((option, optionIndex) => ({
            ...option,
            id: `drink-option-${state.items.length + groupIndex + optionIndex + 1}`,
            restaurantId,
            modifierGroupId: `drink-group-${state.items.length + groupIndex + 1}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
        })),
      };
      state.items = [created, ...state.items];
      return structuredClone(created);
    },
    async updateItem(_restaurantId, itemId, payload) {
      const existingIndex = state.items.findIndex((entry) => entry.id === itemId);
      if (existingIndex < 0) {
        throw new Error('Item not found');
      }
      const existing = state.items[existingIndex];
      const updated: DrinkItemDetail = {
        ...payload,
        id: existing.id,
        restaurantId: existing.restaurantId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        modifierGroups: payload.modifierGroups.map((group, groupIndex) => ({
          ...group,
          id: existing.modifierGroups[groupIndex]?.id ?? `drink-group-${existing.id}-${groupIndex}`,
          restaurantId: existing.restaurantId,
          drinkItemId: existing.id,
          createdAt: existing.modifierGroups[groupIndex]?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: group.options.map((option, optionIndex) => ({
            ...option,
            id:
              existing.modifierGroups[groupIndex]?.options[optionIndex]?.id ??
              `drink-option-${existing.id}-${groupIndex}-${optionIndex}`,
            restaurantId: existing.restaurantId,
            modifierGroupId: existing.modifierGroups[groupIndex]?.id ?? `drink-group-${existing.id}-${groupIndex}`,
            createdAt:
              existing.modifierGroups[groupIndex]?.options[optionIndex]?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
        })),
      };
      state.items[existingIndex] = updated;
      return structuredClone(updated);
    },
    previewImport,
    async applyImport(restaurantId, payload) {
      const preview = await previewImport(restaurantId, payload);
      return {
        ...preview,
        applied: true,
        canApply: true,
      } as DrinkImportResult;
    },
  };
}
