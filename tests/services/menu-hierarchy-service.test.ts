import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

import { createMenuHierarchyService } from '@/services/ops/menu-hierarchy';

describe('menu hierarchy service', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('uses nested canonical routes for every menu hierarchy mutation', async () => {
    const service = createMenuHierarchyService();
    fetchJsonMock
      .mockResolvedValueOnce({ menu: { id: 'menu-1' } })
      .mockResolvedValueOnce({ menu: { id: 'menu-1' } })
      .mockResolvedValueOnce({ section: { id: 'section-1' } })
      .mockResolvedValueOnce({ section: { id: 'section-1' } })
      .mockResolvedValueOnce({ item: { id: 'item-1' } })
      .mockResolvedValueOnce({ item: { id: 'item-1' } })
      .mockResolvedValueOnce({ option: { id: 'option-1' } })
      .mockResolvedValueOnce({ option: { id: 'option-1' } })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await service.createMenu('rest-1', {
      labels: [{ displayName: 'Dinner', languageCode: 'en-GB' }],
      menuKind: 'food',
      cuisines: [],
      defaultLanguageCode: 'en-GB',
      displayOrder: 0,
      active: true,
      legacySource: {},
    });
    await service.updateMenu('rest-1', 'menu-1', { active: false });
    await service.createSection('rest-1', 'menu-1', {
      labels: [{ displayName: 'Starters', languageCode: 'en-GB' }],
      displayOrder: 0,
      active: true,
      legacySource: {},
    });
    await service.updateSection('rest-1', 'menu-1', 'section-1', { active: false });
    await service.createItem('rest-1', 'menu-1', 'section-1', {
      itemKind: 'food',
      externalItemId: 'item-1',
      labels: [{ displayName: 'Burrata', languageCode: 'en-GB' }],
      attributes: {
        allergen: [],
        dietaryRestriction: [],
        ingredients: [],
        preparationMethods: [],
        mediaKeys: [],
        nutritionFacts: {},
      },
      media: { googleMediaKeys: [], localMedia: {} },
      extensions: {
        drinkProfile: {},
        recommendationMetadata: {},
        availabilityPolicy: {},
        customizationControls: {},
        sourceMetadata: {},
      },
      displayOrder: 0,
      active: true,
      legacySource: {},
    });
    await service.updateItem('rest-1', 'menu-1', 'section-1', 'item-1', { active: false });
    await service.updateOption('rest-1', 'menu-1', 'section-1', 'item-1', 'option-1', {
      active: false,
    });
    await service.createOption('rest-1', 'menu-1', 'section-1', 'item-1', {
      labels: [{ displayName: 'Large', languageCode: 'en-GB' }],
      attributes: {
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
    });
    await service.deleteOption('rest-1', 'menu-1', 'section-1', 'item-1', 'option-1');
    await service.deleteItem('rest-1', 'menu-1', 'section-1', 'item-1');
    await service.deleteSection('rest-1', 'menu-1', 'section-1');
    await service.deleteMenu('rest-1', 'menu-1');

    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/ops/restaurants/rest-1/menus',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      '/api/ops/restaurants/rest-1/menus/menu-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      3,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      4,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      5,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      6,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      7,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      },
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      8,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      9,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
      { method: 'DELETE' },
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      10,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1',
      { method: 'DELETE' },
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      11,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1',
      { method: 'DELETE' },
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(12, '/api/ops/restaurants/rest-1/menus/menu-1', {
      method: 'DELETE',
    });
  });
});
