import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: fetchJsonMock }));

import { createMenuHierarchyService } from '@/services/ops/menu-hierarchy';

describe('menu hierarchy reorder service', () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it.each([
    [
      { level: 'sections', menuId: 'm 1' } as const,
      '/api/ops/restaurants/rest-1/menus/m%201/sections/order',
    ],
    [
      { level: 'items', menuId: 'menu-1', sectionId: 'section-1' } as const,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/order',
    ],
    [
      { level: 'options', menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' } as const,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/order',
    ],
  ])('sends one PATCH …/order for %o', async (target, url) => {
    const order = [{ id: 'b', displayOrder: 0 }];
    fetchJsonMock.mockResolvedValue({ data: { order } });

    await expect(
      createMenuHierarchyService().reorderChildren('rest-1', target, ['b']),
    ).resolves.toEqual(order);
    expect(fetchJsonMock).toHaveBeenCalledWith(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds: ['b'] }),
    });
  });
});
