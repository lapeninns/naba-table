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

  it('updates and deletes canonical Google item options through the option routes', async () => {
    const service = createMenuHierarchyService();
    fetchJsonMock.mockResolvedValueOnce({ option: { id: 'option-1' } });
    fetchJsonMock.mockResolvedValueOnce({ ok: true });

    await service.updateOption('rest-1', 'menu-1', 'section-1', 'item-1', 'option-1', {
      active: false,
    });
    await service.deleteOption('rest-1', 'menu-1', 'section-1', 'item-1', 'option-1');

    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      },
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      '/api/ops/restaurants/rest-1/menus/menu-1/sections/section-1/items/item-1/options/option-1',
      { method: 'DELETE' },
    );
  });
});
