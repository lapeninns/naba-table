'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { useMenuHierarchyService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import {
  applyChildOrder,
  removeItem,
  removeMenu,
  removeOption,
  removeSection,
  upsertItem,
  upsertMenu,
  upsertOption,
  upsertSection,
  type MenuHierarchyData,
} from './menuHierarchyCache';

import type { HttpError } from '@/lib/http/errors';
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  MenuChildOrder,
  MenuReorderTarget,
  RestaurantMenuInput,
  RestaurantMenuItemInput,
  RestaurantMenuItemPatch,
  RestaurantMenuOptionInput,
  RestaurantMenuOptionPatch,
  RestaurantMenuPatch,
  RestaurantMenuSectionInput,
  RestaurantMenuSectionPatch,
} from '@/server/menu-hierarchy/types';

type MutationError = HttpError | Error;

function hierarchyListKey(restaurantId?: string | null) {
  return queryKeys.opsMenuHierarchy.list(restaurantId ?? 'none');
}

function requireRestaurantId(restaurantId?: string | null): string {
  if (!restaurantId) throw new Error('Restaurant id is required');
  return restaurantId;
}

/**
 * Writes the canonical server response into the cached hierarchy, then refreshes it in the
 * background (not awaited, so dialogs close as soon as the save succeeds).
 *
 * Dual-sync state is deliberately not invalidated: its food-menu drift compares the stored
 * `nabatable_projection` snapshot, which only a dual-sync refresh or publish rebuilds, so a
 * menu edit cannot change that response (see server/dual-sync/snapshots/food-menus.ts).
 */
function useHierarchyCache(restaurantId?: string | null) {
  const queryClient = useQueryClient();
  const listKey = hierarchyListKey(restaurantId);

  const update = useCallback(
    (updater: (data: MenuHierarchyData) => MenuHierarchyData) => {
      queryClient.setQueryData<MenuHierarchyData>(listKey, (current) =>
        current ? updater(current) : current,
      );
    },
    [listKey, queryClient],
  );

  const refreshInBackground = useCallback(() => {
    if (!restaurantId) return;
    void queryClient.invalidateQueries({ queryKey: listKey });
  }, [listKey, queryClient, restaurantId]);

  return { queryClient, listKey, update, refreshInBackground };
}

export function useOpsMenuHierarchy(
  restaurantId?: string | null,
): UseQueryResult<MenuHierarchyData, MutationError> {
  const menuHierarchyService = useMenuHierarchyService();

  return useQuery<MenuHierarchyData, MutationError>({
    queryKey: hierarchyListKey(restaurantId),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.listMenus(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.menuHierarchy,
    placeholderData: keepPreviousData,
  });
}

// --- menus ------------------------------------------------------------------------------------

export function useOpsCreateRestaurantMenu(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenu, MutationError, RestaurantMenuInput> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async (payload) =>
      menuHierarchyService.createMenu(requireRestaurantId(restaurantId), payload),
    onSuccess: (menu) => {
      cache.update((data) => upsertMenu(data, menu));
      cache.refreshInBackground();
    },
  });
}

export type UpdateMenuVariables = { menuId: string; payload: RestaurantMenuPatch };

export function useOpsUpdateRestaurantMenu(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenu, MutationError, UpdateMenuVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, payload }) =>
      menuHierarchyService.updateMenu(requireRestaurantId(restaurantId), menuId, payload),
    onSuccess: (menu) => {
      cache.update((data) => upsertMenu(data, menu));
      cache.refreshInBackground();
    },
  });
}

export function useOpsDeleteRestaurantMenu(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId }) =>
      menuHierarchyService.deleteMenu(requireRestaurantId(restaurantId), menuId),
    onSuccess: (_data, { menuId }) => {
      cache.update((data) => removeMenu(data, menuId));
      cache.refreshInBackground();
    },
  });
}

// --- sections ---------------------------------------------------------------------------------

export type CreateSectionVariables = { menuId: string; payload: RestaurantMenuSectionInput };

export function useOpsCreateRestaurantMenuSection(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuSection, MutationError, CreateSectionVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, payload }) =>
      menuHierarchyService.createSection(requireRestaurantId(restaurantId), menuId, payload),
    onSuccess: (section, { menuId }) => {
      cache.update((data) => upsertSection(data, menuId, section));
      cache.refreshInBackground();
    },
  });
}

export type UpdateSectionVariables = {
  menuId: string;
  sectionId: string;
  payload: RestaurantMenuSectionPatch;
};

/** One hook for every section update (dialog save and inline patches). */
export function useOpsUpdateRestaurantMenuSection(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuSection, MutationError, UpdateSectionVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, payload }) =>
      menuHierarchyService.updateSection(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        payload,
      ),
    onSuccess: (section, { menuId }) => {
      cache.update((data) => upsertSection(data, menuId, section));
      cache.refreshInBackground();
    },
  });
}

export function useOpsDeleteRestaurantMenuSection(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string; sectionId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId }) =>
      menuHierarchyService.deleteSection(requireRestaurantId(restaurantId), menuId, sectionId),
    onSuccess: (_data, { menuId, sectionId }) => {
      cache.update((data) => removeSection(data, menuId, sectionId));
      cache.refreshInBackground();
    },
  });
}

// --- items ------------------------------------------------------------------------------------

export type CreateItemVariables = {
  menuId: string;
  sectionId: string;
  /** Carries `idempotencyKey`: create it once per draft and reuse it for retries. */
  payload: RestaurantMenuItemInput;
};

export function useOpsCreateRestaurantMenuItem(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuItem, MutationError, CreateItemVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, payload }) =>
      menuHierarchyService.createItem(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        payload,
      ),
    onSuccess: (item, { menuId, sectionId }) => {
      cache.update((data) => upsertItem(data, menuId, sectionId, item));
      cache.refreshInBackground();
    },
  });
}

export type UpdateItemVariables = {
  menuId: string;
  sectionId: string;
  itemId: string;
  payload: RestaurantMenuItemPatch;
};

/** One hook for every item update (dialog save, quick edit and the shown/hidden toggle). */
export function useOpsUpdateRestaurantMenuItem(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuItem, MutationError, UpdateItemVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, payload }) =>
      menuHierarchyService.updateItem(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        itemId,
        payload,
      ),
    onSuccess: (item, { menuId, sectionId }) => {
      cache.update((data) => upsertItem(data, menuId, sectionId, item));
      cache.refreshInBackground();
    },
  });
}

export function useOpsDeleteRestaurantMenuItem(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string; sectionId: string; itemId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId }) =>
      menuHierarchyService.deleteItem(requireRestaurantId(restaurantId), menuId, sectionId, itemId),
    onSuccess: (_data, { menuId, sectionId, itemId }) => {
      cache.update((data) => removeItem(data, menuId, sectionId, itemId));
      cache.refreshInBackground();
    },
  });
}

// --- options ----------------------------------------------------------------------------------

export type CreateOptionVariables = {
  menuId: string;
  sectionId: string;
  itemId: string;
  payload: RestaurantMenuOptionInput;
};

export function useOpsCreateRestaurantMenuOption(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuOption, MutationError, CreateOptionVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, payload }) =>
      menuHierarchyService.createOption(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        itemId,
        payload,
      ),
    onSuccess: (option, { menuId, sectionId, itemId }) => {
      cache.update((data) => upsertOption(data, menuId, sectionId, itemId, option));
      cache.refreshInBackground();
    },
  });
}

export type UpdateOptionVariables = {
  menuId: string;
  sectionId: string;
  itemId: string;
  optionId: string;
  payload: RestaurantMenuOptionPatch;
};

export function useOpsUpdateRestaurantMenuOption(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenuOption, MutationError, UpdateOptionVariables> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, optionId, payload }) =>
      menuHierarchyService.updateOption(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        itemId,
        optionId,
        payload,
      ),
    onSuccess: (option, { menuId, sectionId, itemId }) => {
      cache.update((data) => upsertOption(data, menuId, sectionId, itemId, option));
      cache.refreshInBackground();
    },
  });
}

export function useOpsDeleteRestaurantMenuOption(
  restaurantId?: string | null,
): UseMutationResult<
  void,
  MutationError,
  { menuId: string; sectionId: string; itemId: string; optionId: string }
> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, optionId }) =>
      menuHierarchyService.deleteOption(
        requireRestaurantId(restaurantId),
        menuId,
        sectionId,
        itemId,
        optionId,
      ),
    onSuccess: (_data, { menuId, sectionId, itemId, optionId }) => {
      cache.update((data) => removeOption(data, menuId, sectionId, itemId, optionId));
      cache.refreshInBackground();
    },
  });
}

// --- reorder ----------------------------------------------------------------------------------

export type ReorderMenuChildrenVariables = {
  target: MenuReorderTarget;
  /** The complete new order of the parent's children. */
  orderedIds: readonly string[];
};

type ReorderContext = { previous?: MenuHierarchyData };

export const MENU_REORDER_ERROR_COPY = {
  MENU_ORDER_STALE: 'The menu changed since you loaded it. The latest order is shown.',
} as const;

/**
 * One reorder command for sections, items and options. The new order shows immediately
 * (optimistic) and rolls back if the save fails; writes are serialised per restaurant.
 */
export function useOpsReorderMenuChildren(
  restaurantId?: string | null,
): UseMutationResult<
  MenuChildOrder[],
  MutationError,
  ReorderMenuChildrenVariables,
  ReorderContext
> {
  const menuHierarchyService = useMenuHierarchyService();
  const cache = useHierarchyCache(restaurantId);

  return useMutation<MenuChildOrder[], MutationError, ReorderMenuChildrenVariables, ReorderContext>(
    {
      scope: { id: `menu-order:${restaurantId ?? 'none'}` },
      meta: {
        feedback: {
          error: {
            copy: MENU_REORDER_ERROR_COPY,
            fallback: 'Could not save the new order. The previous order is back.',
          },
        },
      },
      mutationFn: async ({ target, orderedIds }) =>
        menuHierarchyService.reorderChildren(requireRestaurantId(restaurantId), target, orderedIds),
      onMutate: async ({ target, orderedIds }) => {
        await cache.queryClient.cancelQueries({ queryKey: cache.listKey });
        const previous = cache.queryClient.getQueryData<MenuHierarchyData>(cache.listKey);
        cache.update((data) => applyChildOrder(data, target, orderedIds));
        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          cache.queryClient.setQueryData(cache.listKey, context.previous);
        }
      },
      onSuccess: (order, { target }) => {
        cache.update((data) =>
          applyChildOrder(
            data,
            target,
            order.map((entry) => entry.id),
          ),
        );
      },
      onSettled: () => {
        cache.refreshInBackground();
      },
    },
  );
}
