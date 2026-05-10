'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useMenuHierarchyService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  RestaurantMenuInput,
  RestaurantMenuItemInput,
  RestaurantMenuItemPatch,
  RestaurantMenuOptionInput,
  RestaurantMenuOptionPatch,
  RestaurantMenuPatch,
  RestaurantMenuSectionInput,
  RestaurantMenuSectionPatch,
} from '@/server/menu-hierarchy/types';

type MenuHierarchyResponse = {
  menus: CanonicalRestaurantMenu[];
};

type MutationError = HttpError | Error;

function hierarchyListKey(restaurantId?: string | null) {
  return queryKeys.opsMenuHierarchy.list(restaurantId ?? 'none');
}

export function useOpsMenuHierarchy(
  restaurantId?: string | null,
): UseQueryResult<MenuHierarchyResponse, MutationError> {
  const menuHierarchyService = useMenuHierarchyService();

  return useQuery<MenuHierarchyResponse, MutationError>({
    queryKey: hierarchyListKey(restaurantId),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.listMenus(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useOpsCreateRestaurantMenu(
  restaurantId?: string | null,
): UseMutationResult<CanonicalRestaurantMenu, MutationError, RestaurantMenuInput> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId) throw new Error('Restaurant id is required');
      return menuHierarchyService.createMenu(restaurantId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsUpdateRestaurantMenu({
  restaurantId,
  menuId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenu, MutationError, RestaurantMenuPatch> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId) {
        throw new Error('Restaurant id and menu id are required');
      }
      return menuHierarchyService.updateMenu(restaurantId, menuId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsCreateRestaurantMenuSection({
  restaurantId,
  menuId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenuSection, MutationError, RestaurantMenuSectionInput> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId) {
        throw new Error('Restaurant id and menu id are required');
      }
      return menuHierarchyService.createSection(restaurantId, menuId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsUpdateRestaurantMenuSection({
  restaurantId,
  menuId,
  sectionId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
  sectionId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenuSection, MutationError, RestaurantMenuSectionPatch> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId || !sectionId) {
        throw new Error('Restaurant id, menu id, and section id are required');
      }
      return menuHierarchyService.updateSection(restaurantId, menuId, sectionId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsPatchRestaurantMenuSection(
  restaurantId?: string | null,
): UseMutationResult<
  CanonicalRestaurantMenuSection,
  MutationError,
  { menuId: string; sectionId: string; payload: RestaurantMenuSectionPatch }
> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.updateSection(restaurantId, menuId, sectionId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsCreateRestaurantMenuItem({
  restaurantId,
  menuId,
  sectionId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
  sectionId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenuItem, MutationError, RestaurantMenuItemInput> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId || !sectionId) {
        throw new Error('Restaurant id, menu id, and section id are required');
      }
      return menuHierarchyService.createItem(restaurantId, menuId, sectionId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsUpdateRestaurantMenuItem({
  restaurantId,
  menuId,
  sectionId,
  itemId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
  sectionId?: string | null;
  itemId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenuItem, MutationError, RestaurantMenuItemPatch> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId || !sectionId || !itemId) {
        throw new Error('Restaurant id, menu id, section id, and item id are required');
      }
      return menuHierarchyService.updateItem(restaurantId, menuId, sectionId, itemId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsPatchRestaurantMenuItem(
  restaurantId?: string | null,
): UseMutationResult<
  CanonicalRestaurantMenuItem,
  MutationError,
  { menuId: string; sectionId: string; itemId: string; payload: RestaurantMenuItemPatch }
> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.updateItem(restaurantId, menuId, sectionId, itemId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsCreateRestaurantMenuOption({
  restaurantId,
  menuId,
  sectionId,
  itemId,
}: {
  restaurantId?: string | null;
  menuId?: string | null;
  sectionId?: string | null;
  itemId?: string | null;
}): UseMutationResult<CanonicalRestaurantMenuOption, MutationError, RestaurantMenuOptionInput> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId || !menuId || !sectionId || !itemId) {
        throw new Error('Restaurant id, menu id, section id, and item id are required');
      }
      return menuHierarchyService.createOption(restaurantId, menuId, sectionId, itemId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsPatchRestaurantMenuOption(restaurantId?: string | null): UseMutationResult<
  CanonicalRestaurantMenuOption,
  MutationError,
  {
    menuId: string;
    sectionId: string;
    itemId: string;
    optionId: string;
    payload: RestaurantMenuOptionPatch;
  }
> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, optionId, payload }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.updateOption(
        restaurantId,
        menuId,
        sectionId,
        itemId,
        optionId,
        payload,
      );
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId, optionId }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.deleteOption(restaurantId, menuId, sectionId, itemId, optionId);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsDeleteRestaurantMenu(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.deleteMenu(restaurantId, menuId);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsDeleteRestaurantMenuSection(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string; sectionId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.deleteSection(restaurantId, menuId, sectionId);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}

export function useOpsDeleteRestaurantMenuItem(
  restaurantId?: string | null,
): UseMutationResult<void, MutationError, { menuId: string; sectionId: string; itemId: string }> {
  const menuHierarchyService = useMenuHierarchyService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, sectionId, itemId }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuHierarchyService.deleteItem(restaurantId, menuId, sectionId, itemId);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: hierarchyListKey(restaurantId) });
    },
  });
}
