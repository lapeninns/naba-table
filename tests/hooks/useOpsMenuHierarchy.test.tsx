import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  useOpsCreateRestaurantMenu,
  useOpsDeleteRestaurantMenu,
  useOpsMenuHierarchy,
  useOpsPatchRestaurantMenuItem,
  useOpsUpdateRestaurantMenu,
  useOpsUpdateRestaurantMenuSection,
} from '@src/hooks/ops/useOpsMenuHierarchy';

const menuHierarchyService = vi.hoisted(() => ({
  listMenus: vi.fn(),
  createMenu: vi.fn(),
  updateMenu: vi.fn(),
  createSection: vi.fn(),
  updateSection: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  createOption: vi.fn(),
  updateOption: vi.fn(),
  deleteOption: vi.fn(),
  deleteMenu: vi.fn(),
  deleteSection: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useMenuHierarchyService: () => menuHierarchyService,
}));

const restaurantId = 'rest-1';
const listKey = queryKeys.opsMenuHierarchy.list(restaurantId);

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, invalidateSpy, ...renderHook(hook, { wrapper }) };
}

describe('useOpsMenuHierarchy', () => {
  beforeEach(() => {
    menuHierarchyService.listMenus.mockResolvedValue({ menus: [] });
  });

  it('@contract stays disabled without a restaurant id', () => {
    setup(() => useOpsMenuHierarchy(null));

    expect(menuHierarchyService.listMenus).not.toHaveBeenCalled();
  });

  it('@contract lists menus for the restaurant', async () => {
    const menus = [{ id: 'menu-1', name: 'Dinner' }];
    menuHierarchyService.listMenus.mockResolvedValue({ menus });

    const { result } = setup(() => useOpsMenuHierarchy(restaurantId));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ menus });
    expect(menuHierarchyService.listMenus).toHaveBeenCalledWith(restaurantId, {
      signal: expect.any(AbortSignal),
    });
  });

  it('@contract surfaces service errors', async () => {
    menuHierarchyService.listMenus.mockRejectedValue(new Error('boom'));

    const { result } = setup(() => useOpsMenuHierarchy(restaurantId));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('menu hierarchy mutations', () => {
  it('@contract creating a menu invalidates the hierarchy list for the restaurant', async () => {
    const menu = { id: 'menu-1', name: 'Dinner' };
    menuHierarchyService.createMenu.mockResolvedValue(menu);

    const { result, invalidateSpy } = setup(() => useOpsCreateRestaurantMenu(restaurantId));

    await expect(result.current.mutateAsync({ name: 'Dinner' } as never)).resolves.toEqual(menu);

    expect(menuHierarchyService.createMenu).toHaveBeenCalledWith(restaurantId, {
      name: 'Dinner',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it('@contract creating a menu without a restaurant id fails before calling the service', async () => {
    const { result } = setup(() => useOpsCreateRestaurantMenu(null));

    await expect(result.current.mutateAsync({ name: 'Dinner' } as never)).rejects.toThrow(
      'Restaurant id is required',
    );
    expect(menuHierarchyService.createMenu).not.toHaveBeenCalled();
  });

  it('@contract updating a section requires both menu and section ids', async () => {
    const { result } = setup(() =>
      useOpsUpdateRestaurantMenuSection({ restaurantId, menuId: 'menu-1', sectionId: null }),
    );

    await expect(result.current.mutateAsync({ name: 'Starters' } as never)).rejects.toThrow(
      'Restaurant id, menu id, and section id are required',
    );
    expect(menuHierarchyService.updateSection).not.toHaveBeenCalled();
  });

  it('@contract patching an item passes the full id path and invalidates the list', async () => {
    const item = { id: 'item-1', name: 'Soup' };
    menuHierarchyService.updateItem.mockResolvedValue(item);

    const { result, invalidateSpy } = setup(() => useOpsPatchRestaurantMenuItem(restaurantId));

    await result.current.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { name: 'Soup' } as never,
    });

    expect(menuHierarchyService.updateItem).toHaveBeenCalledWith(
      restaurantId,
      'menu-1',
      'section-1',
      'item-1',
      { name: 'Soup' },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it('@contract deleting a menu invalidates the hierarchy list', async () => {
    menuHierarchyService.deleteMenu.mockResolvedValue(undefined);

    const { result, invalidateSpy } = setup(() => useOpsDeleteRestaurantMenu(restaurantId));

    await result.current.mutateAsync({ menuId: 'menu-1' });

    expect(menuHierarchyService.deleteMenu).toHaveBeenCalledWith(restaurantId, 'menu-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it('@contract mutation errors do not invalidate the hierarchy list', async () => {
    menuHierarchyService.deleteMenu.mockRejectedValue(new Error('in use'));

    const { result, invalidateSpy } = setup(() => useOpsDeleteRestaurantMenu(restaurantId));

    await expect(result.current.mutateAsync({ menuId: 'menu-1' })).rejects.toThrow('in use');
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
  it('@contract menu edits invalidate only the restaurant hierarchy list, not dual-sync state', async () => {
    // Dual-sync food-menu drift compares the stored Nabatable projection, which only
    // dual-sync refresh/publish rebuilds, so a menu edit cannot change the state response.
    const menu = { id: 'menu-1', name: 'Dinner' };
    menuHierarchyService.updateMenu.mockResolvedValue(menu);

    const { result, invalidateSpy } = setup(() =>
      useOpsUpdateRestaurantMenu({ restaurantId, menuId: 'menu-1' }),
    );

    await result.current.mutateAsync({ name: 'Dinner' } as never);

    expect(
      (invalidateSpy.mock.calls as Array<[{ queryKey: readonly unknown[] }]>).map(
        ([filters]) => filters.queryKey,
      ),
    ).toEqual([listKey]);
    expect(listKey).toContain(restaurantId);
  });
});
