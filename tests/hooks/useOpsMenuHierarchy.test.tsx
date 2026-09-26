import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  useOpsCreateRestaurantMenu,
  useOpsCreateRestaurantMenuItem,
  useOpsCreateRestaurantMenuSection,
  useOpsDeleteRestaurantMenu,
  useOpsDeleteRestaurantMenuItem,
  useOpsMenuHierarchy,
  useOpsReorderMenuChildren,
  useOpsUpdateRestaurantMenu,
  useOpsUpdateRestaurantMenuItem,
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
  reorderChildren: vi.fn(),
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

type Hierarchy = { menus: Array<Record<string, unknown>> };

function seedHierarchy(queryClient: ReturnType<typeof createTestQueryClient>) {
  const hierarchy: Hierarchy = {
    menus: [
      {
        id: 'menu-1',
        displayOrder: 0,
        sections: [
          {
            id: 'section-1',
            displayOrder: 0,
            items: [
              { id: 'item-1', displayOrder: 0, active: true, options: [] },
              { id: 'item-2', displayOrder: 1, active: true, options: [] },
            ],
          },
          { id: 'section-2', displayOrder: 1, items: [] },
        ],
      },
    ],
  };
  queryClient.setQueryData(listKey, hierarchy);
  return hierarchy;
}

function cached(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData(listKey) as Hierarchy;
}

function sectionsOf(queryClient: ReturnType<typeof createTestQueryClient>) {
  return (cached(queryClient).menus[0]!.sections as Array<Record<string, unknown>>).map(
    (section) => [section.id, section.displayOrder],
  );
}

function itemsOf(queryClient: ReturnType<typeof createTestQueryClient>) {
  const section = (cached(queryClient).menus[0]!.sections as Array<{ items: unknown[] }>)[0]!;
  return section.items as Array<Record<string, unknown>>;
}

describe('menu hierarchy mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@contract creating a menu writes it into the cache and refreshes in the background', async () => {
    const menu = { id: 'menu-2', displayOrder: 1, sections: [] };
    menuHierarchyService.createMenu.mockResolvedValue(menu);

    const { result, invalidateSpy, queryClient } = setup(() =>
      useOpsCreateRestaurantMenu(restaurantId),
    );
    seedHierarchy(queryClient);

    await expect(result.current.mutateAsync({ name: 'Dinner' } as never)).resolves.toEqual(menu);

    expect(menuHierarchyService.createMenu).toHaveBeenCalledWith(restaurantId, { name: 'Dinner' });
    expect(cached(queryClient).menus.map((entry) => entry.id)).toEqual(['menu-1', 'menu-2']);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listKey });
  });

  it('@contract creating a menu without a restaurant id fails before calling the service', async () => {
    const { result } = setup(() => useOpsCreateRestaurantMenu(null));

    await expect(result.current.mutateAsync({ name: 'Dinner' } as never)).rejects.toThrow(
      'Restaurant id is required',
    );
    expect(menuHierarchyService.createMenu).not.toHaveBeenCalled();
  });

  it('@contract resolves from the saved entity without waiting for the hierarchy refetch', async () => {
    let releaseRefetch: (() => void) | undefined;
    menuHierarchyService.listMenus.mockImplementation(
      () => new Promise((resolve) => (releaseRefetch = () => resolve({ menus: [] }))),
    );
    menuHierarchyService.updateItem.mockResolvedValue({
      id: 'item-1',
      displayOrder: 0,
      active: false,
      options: [{ id: 'opt-1' }],
    });

    const { result, queryClient } = setup(() => ({
      hierarchy: useOpsMenuHierarchy(restaurantId),
      update: useOpsUpdateRestaurantMenuItem(restaurantId),
    }));
    seedHierarchy(queryClient);

    await result.current.update.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { active: false },
    });

    // Saved before the background refetch settles: the canonical item is already cached.
    expect(itemsOf(queryClient)[0]).toMatchObject({ id: 'item-1', active: false });
    expect(itemsOf(queryClient)[0]!.options).toEqual([{ id: 'opt-1' }]);
    releaseRefetch?.();
  });

  it('@contract one item update hook passes the full id path', async () => {
    menuHierarchyService.updateItem.mockResolvedValue({
      id: 'item-1',
      displayOrder: 0,
      options: [],
    });

    const { result } = setup(() => useOpsUpdateRestaurantMenuItem(restaurantId));

    await result.current.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { attributesMerge: { spiciness: 'MILD' } },
    });

    expect(menuHierarchyService.updateItem).toHaveBeenCalledWith(
      restaurantId,
      'menu-1',
      'section-1',
      'item-1',
      { attributesMerge: { spiciness: 'MILD' } },
    );
  });

  it('@contract section updates keep the cached items (the response has none)', async () => {
    menuHierarchyService.updateSection.mockResolvedValue({
      id: 'section-1',
      displayOrder: 0,
      active: false,
      items: [],
    });

    const { result, queryClient } = setup(() => useOpsUpdateRestaurantMenuSection(restaurantId));
    seedHierarchy(queryClient);

    await result.current.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      payload: { active: false },
    });

    const section = (cached(queryClient).menus[0]!.sections as Array<Record<string, unknown>>)[0]!;
    expect(section).toMatchObject({ id: 'section-1', active: false });
    expect(section.items).toHaveLength(2);
  });

  it('@contract created sections and items are appended from the server response', async () => {
    menuHierarchyService.createSection.mockResolvedValue({
      id: 'section-3',
      displayOrder: 2,
      items: [],
    });
    menuHierarchyService.createItem.mockResolvedValue({
      id: 'item-3',
      displayOrder: 2,
      options: [],
    });

    const { result, queryClient } = setup(() => ({
      section: useOpsCreateRestaurantMenuSection(restaurantId),
      item: useOpsCreateRestaurantMenuItem(restaurantId),
    }));
    seedHierarchy(queryClient);

    await result.current.section.mutateAsync({ menuId: 'menu-1', payload: {} as never });
    await result.current.item.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      payload: { idempotencyKey: 'draft-key-1' } as never,
    });

    expect(sectionsOf(queryClient).map(([id]) => id)).toEqual([
      'section-1',
      'section-2',
      'section-3',
    ]);
    expect(itemsOf(queryClient).map((item) => item.id)).toEqual(['item-1', 'item-2', 'item-3']);
    expect(menuHierarchyService.createItem).toHaveBeenCalledWith(
      restaurantId,
      'menu-1',
      'section-1',
      {
        idempotencyKey: 'draft-key-1',
      },
    );
  });

  it('@contract deleting an item removes it from the cache', async () => {
    menuHierarchyService.deleteItem.mockResolvedValue(undefined);

    const { result, queryClient } = setup(() => useOpsDeleteRestaurantMenuItem(restaurantId));
    seedHierarchy(queryClient);

    await result.current.mutateAsync({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
    });

    expect(itemsOf(queryClient).map((item) => item.id)).toEqual(['item-2']);
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
    const menu = { id: 'menu-1', displayOrder: 0, sections: [] };
    menuHierarchyService.updateMenu.mockResolvedValue(menu);

    const { result, invalidateSpy } = setup(() => useOpsUpdateRestaurantMenu(restaurantId));

    await result.current.mutateAsync({ menuId: 'menu-1', payload: { active: false } });

    expect(
      (invalidateSpy.mock.calls as Array<[{ queryKey: readonly unknown[] }]>).map(
        ([filters]) => filters.queryKey,
      ),
    ).toEqual([listKey]);
    expect(listKey).toContain(restaurantId);
  });
});

describe('useOpsReorderMenuChildren', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@contract shows the new order immediately and keeps it after the save', async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    menuHierarchyService.reorderChildren.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );

    const { result, queryClient } = setup(() => useOpsReorderMenuChildren(restaurantId));
    seedHierarchy(queryClient);

    const pending = result.current.mutateAsync({
      target: { level: 'sections', menuId: 'menu-1' },
      orderedIds: ['section-2', 'section-1'],
    });

    await waitFor(() =>
      expect(sectionsOf(queryClient)).toEqual([
        ['section-2', 0],
        ['section-1', 1],
      ]),
    );
    expect(menuHierarchyService.reorderChildren).toHaveBeenCalledWith(
      restaurantId,
      { level: 'sections', menuId: 'menu-1' },
      ['section-2', 'section-1'],
    );

    resolveSave?.([
      { id: 'section-2', displayOrder: 0 },
      { id: 'section-1', displayOrder: 1 },
    ]);
    await pending;
    expect(sectionsOf(queryClient)).toEqual([
      ['section-2', 0],
      ['section-1', 1],
    ]);
  });

  it('@contract rolls the optimistic order back when the save fails', async () => {
    menuHierarchyService.reorderChildren.mockRejectedValue(new Error('stale'));

    const { result, queryClient } = setup(() => useOpsReorderMenuChildren(restaurantId));
    seedHierarchy(queryClient);

    await expect(
      result.current.mutateAsync({
        target: { level: 'items', menuId: 'menu-1', sectionId: 'section-1' },
        orderedIds: ['item-2', 'item-1'],
      }),
    ).rejects.toThrow('stale');

    expect(itemsOf(queryClient).map((item) => [item.id, item.displayOrder])).toEqual([
      ['item-1', 0],
      ['item-2', 1],
    ]);
  });

  it('@contract declares global error feedback with copy for a stale order', async () => {
    menuHierarchyService.reorderChildren.mockRejectedValue(new Error('stale'));
    const { result, queryClient } = setup(() => useOpsReorderMenuChildren(restaurantId));

    await result.current
      .mutateAsync({ target: { level: 'sections', menuId: 'menu-1' }, orderedIds: ['section-1'] })
      .catch(() => undefined);

    const [mutation] = queryClient.getMutationCache().getAll();
    expect(mutation?.meta?.feedback?.error).toMatchObject({
      copy: { MENU_ORDER_STALE: expect.any(String) },
      fallback: expect.stringContaining('previous order'),
    });
    expect(mutation?.options.scope).toEqual({ id: `menu-order:${restaurantId}` });
  });
});

describe('useOpsReorderMenuChildren with overlapping reorders in one scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type Deferred = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

  /** Each reorder call waits for the test to settle it, in call order. */
  function controlledSaves() {
    const saves: Deferred[] = [];
    menuHierarchyService.reorderChildren.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          saves.push({ resolve, reject });
        }),
    );
    return saves;
  }

  function setupTwoLists() {
    return setup(() => ({
      sections: useOpsReorderMenuChildren(restaurantId),
      items: useOpsReorderMenuChildren(restaurantId),
    }));
  }

  const sectionsTarget = { level: 'sections', menuId: 'menu-1' } as const;
  const itemsTarget = { level: 'items', menuId: 'menu-1', sectionId: 'section-1' } as const;
  /** Items of section-1, wherever a section reorder has moved it. */
  const itemOrder = (queryClient: ReturnType<typeof createTestQueryClient>) => {
    const sections = cached(queryClient).menus[0]!.sections as Array<{
      id: string;
      items: Array<Record<string, unknown>>;
    }>;
    const section = sections.find((candidate) => candidate.id === 'section-1')!;
    return section.items.map((item) => [item.id, item.displayOrder]);
  };

  it('@contract a failed section reorder rolls back only the sections, keeping a queued item reorder', async () => {
    const saves = controlledSaves();
    const { result, queryClient } = setupTwoLists();
    seedHierarchy(queryClient);

    const a = result.current.sections
      .mutateAsync({ target: sectionsTarget, orderedIds: ['section-2', 'section-1'] })
      .catch(() => undefined);
    await waitFor(() => expect(saves).toHaveLength(1));
    const b = result.current.items.mutateAsync({
      target: itemsTarget,
      orderedIds: ['item-2', 'item-1'],
    });
    await waitFor(() =>
      expect(itemOrder(queryClient)).toEqual([
        ['item-2', 0],
        ['item-1', 1],
      ]),
    );

    saves[0]!.reject(new Error('stale'));
    await a;

    expect(sectionsOf(queryClient)).toEqual([
      ['section-1', 0],
      ['section-2', 1],
    ]);
    // B is still pending: its optimistic item order must survive A's rollback.
    expect(itemOrder(queryClient)).toEqual([
      ['item-2', 0],
      ['item-1', 1],
    ]);

    await waitFor(() => expect(saves).toHaveLength(2));
    saves[1]!.resolve([
      { id: 'item-2', displayOrder: 0 },
      { id: 'item-1', displayOrder: 1 },
    ]);
    await b;
  });

  it('@contract when both fail, the later rollback does not bring back the earlier rejected order', async () => {
    const saves = controlledSaves();
    const { result, queryClient } = setupTwoLists();
    seedHierarchy(queryClient);

    const a = result.current.sections
      .mutateAsync({ target: sectionsTarget, orderedIds: ['section-2', 'section-1'] })
      .catch(() => undefined);
    await waitFor(() => expect(saves).toHaveLength(1));
    const b = result.current.items
      .mutateAsync({ target: itemsTarget, orderedIds: ['item-2', 'item-1'] })
      .catch(() => undefined);
    await waitFor(() =>
      expect(itemOrder(queryClient)).toEqual([
        ['item-2', 0],
        ['item-1', 1],
      ]),
    );

    saves[0]!.reject(new Error('stale'));
    await a;
    await waitFor(() => expect(saves).toHaveLength(2));
    saves[1]!.reject(new Error('stale'));
    await b;

    expect(sectionsOf(queryClient)).toEqual([
      ['section-1', 0],
      ['section-2', 1],
    ]);
    expect(itemOrder(queryClient)).toEqual([
      ['item-1', 0],
      ['item-2', 1],
    ]);
  });

  it('@contract refetches the hierarchy only once the reorder scope drains', async () => {
    const saves = controlledSaves();
    const { result, queryClient, invalidateSpy } = setupTwoLists();
    seedHierarchy(queryClient);
    const listInvalidations = () =>
      invalidateSpy.mock.calls.filter(
        ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(listKey),
      ).length;

    const a = result.current.sections.mutateAsync({
      target: sectionsTarget,
      orderedIds: ['section-2', 'section-1'],
    });
    await waitFor(() => expect(saves).toHaveLength(1));
    const b = result.current.items.mutateAsync({
      target: itemsTarget,
      orderedIds: ['item-2', 'item-1'],
    });
    await waitFor(() =>
      expect(itemOrder(queryClient)).toEqual([
        ['item-2', 0],
        ['item-1', 1],
      ]),
    );

    saves[0]!.resolve([
      { id: 'section-2', displayOrder: 0 },
      { id: 'section-1', displayOrder: 1 },
    ]);
    await a;
    // A refetch now would return a hierarchy without B's order and overwrite it.
    expect(listInvalidations()).toBe(0);
    expect(itemOrder(queryClient)).toEqual([
      ['item-2', 0],
      ['item-1', 1],
    ]);

    await waitFor(() => expect(saves).toHaveLength(2));
    saves[1]!.resolve([
      { id: 'item-2', displayOrder: 0 },
      { id: 'item-1', displayOrder: 1 },
    ]);
    await b;
    await waitFor(() => expect(listInvalidations()).toBe(1));
  });

  it('@contract a menu edit does not refetch over a reorder that is still saving', async () => {
    const saves = controlledSaves();
    menuHierarchyService.updateMenu.mockResolvedValue({ id: 'menu-1', displayOrder: 0 });
    const { result, queryClient, invalidateSpy } = setup(() => ({
      reorder: useOpsReorderMenuChildren(restaurantId),
      update: useOpsUpdateRestaurantMenu(restaurantId),
    }));
    seedHierarchy(queryClient);

    const a = result.current.reorder.mutateAsync({
      target: itemsTarget,
      orderedIds: ['item-2', 'item-1'],
    });
    await waitFor(() => expect(saves).toHaveLength(1));
    invalidateSpy.mockClear();

    await result.current.update.mutateAsync({ menuId: 'menu-1', payload: { name: 'Dinner' } });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: listKey });
    expect(itemOrder(queryClient)).toEqual([
      ['item-2', 0],
      ['item-1', 1],
    ]);

    saves[0]!.resolve([
      { id: 'item-2', displayOrder: 0 },
      { id: 'item-1', displayOrder: 1 },
    ]);
    await a;
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listKey }));
  });
});
