'use client';

import type {
  MenuFacetSet,
  MenuImportResult,
  MenuItemDetail,
  MenuListFilters,
  MenuListResponse,
} from '@/server/menu/types';
import type { MenuService } from '@/services/ops/menu';

type DevMenuState = {
  items: MenuItemDetail[];
};

function createSeedItems(): MenuItemDetail[] {
  return [
    {
      id: 'menu-item-1',
      restaurantId: 'dev-restaurant',
      externalItemId: 'starter-burrata',
      itemName: 'Burrata & Heritage Tomatoes',
      category: 'Starters',
      subcategory: 'Cold',
      shortDescription: 'Creamy burrata with seasonal tomatoes.',
      fullDescription: 'A bright starter finished with basil oil, toasted seeds, and aged balsamic.',
      basePrice: 9.5,
      currency: 'GBP',
      serviceTime: 'Lunch',
      availabilityStatus: 'available',
      keyIngredients: ['burrata', 'tomato', 'basil'],
      mainProteinOrBase: 'Cheese',
      cookingStyle: 'Fresh',
      preparationMethod: 'Plated to order',
      flavorProfile: 'Bright and creamy',
      texture: 'Soft',
      spiceLevel: 'Mild',
      spiceAdjustable: false,
      portionSize: 'Starter',
      shareable: false,
      recommendationTags: ['Signature', 'Seasonal'],
      pairings: ['House white'],
      signatureScore: 90,
      popularityScore: 82,
      dietaryTags: ['Vegetarian'],
      allergensContains: ['Milk'],
      allergensMayContain: ['Nuts'],
      removableIngredients: ['Seeds'],
      substitutionsAllowed: true,
      canBeMadeVegetarian: true,
      canBeMadeVegan: false,
      canBeMadeGlutenFree: true,
      customizationRules: 'No balsamic on request.',
      servingNotes: 'Serve chilled.',
      active: true,
      seasonal: true,
      limitedTime: false,
      soldOut: false,
      displayOrder: 10,
      imageUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modifierGroups: [
        {
          id: 'menu-group-1',
          restaurantId: 'dev-restaurant',
          menuItemId: 'menu-item-1',
          externalModifierGroupId: 'burrata-add-ons',
          groupName: 'Add-ons',
          required: false,
          minSelect: 0,
          maxSelect: 2,
          displayOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: [
            {
              id: 'menu-option-1',
              restaurantId: 'dev-restaurant',
              modifierGroupId: 'menu-group-1',
              externalModifierOptionId: 'extra-prosciutto',
              optionName: 'Add prosciutto',
              priceDelta: 2.5,
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

function buildFacets(items: MenuItemDetail[]): MenuFacetSet {
  return {
    categories: Array.from(new Set(items.map((item) => item.category))).sort(),
    subcategories: Array.from(new Set(items.map((item) => item.subcategory).filter(Boolean) as string[])).sort(),
    serviceTimes: Array.from(new Set(items.map((item) => item.serviceTime).filter(Boolean) as string[])).sort(),
  };
}

function toListResponse(items: MenuItemDetail[], filters: MenuListFilters): MenuListResponse {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const filtered = items.filter((item) => {
    if (search) {
      const haystack = `${item.itemName} ${item.category} ${item.subcategory ?? ''}`.toLowerCase();
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
      externalItemId: item.externalItemId,
      itemName: item.itemName,
      category: item.category,
      subcategory: item.subcategory,
      basePrice: item.basePrice,
      currency: item.currency,
      serviceTime: item.serviceTime,
      availabilityStatus: item.availabilityStatus,
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

export function createDevMenuService(): MenuService {
  const state: DevMenuState = {
    items: createSeedItems(),
  };

  const previewImport: MenuService['previewImport'] = async (_restaurantId, payload) => {
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
      const created: MenuItemDetail = {
        ...payload,
        id: `menu-item-${state.items.length + 1}`,
        restaurantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        modifierGroups: payload.modifierGroups.map((group, groupIndex) => ({
          ...group,
          id: `menu-group-${state.items.length + groupIndex + 1}`,
          restaurantId,
          menuItemId: `menu-item-${state.items.length + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: group.options.map((option, optionIndex) => ({
            ...option,
            id: `menu-option-${state.items.length + groupIndex + optionIndex + 1}`,
            restaurantId,
            modifierGroupId: `menu-group-${state.items.length + groupIndex + 1}`,
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
      const updated: MenuItemDetail = {
        ...payload,
        id: existing.id,
        restaurantId: existing.restaurantId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        modifierGroups: payload.modifierGroups.map((group, groupIndex) => ({
          ...group,
          id: existing.modifierGroups[groupIndex]?.id ?? `menu-group-${existing.id}-${groupIndex}`,
          restaurantId: existing.restaurantId,
          menuItemId: existing.id,
          createdAt: existing.modifierGroups[groupIndex]?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          options: group.options.map((option, optionIndex) => ({
            ...option,
            id:
              existing.modifierGroups[groupIndex]?.options[optionIndex]?.id ??
              `menu-option-${existing.id}-${groupIndex}-${optionIndex}`,
            restaurantId: existing.restaurantId,
            modifierGroupId: existing.modifierGroups[groupIndex]?.id ?? `menu-group-${existing.id}-${groupIndex}`,
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
      } as MenuImportResult;
    },
  };
}
