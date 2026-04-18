'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { useMenuService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type {
  MenuImportResult,
  MenuItemDetail,
  MenuItemUpsertInput,
  MenuListFilters,
  MenuListResponse,
} from '@/server/menu/types';
import type {
  MenuImportPayload,
} from '@/services/ops/menu';

export function useOpsMenuList(
  restaurantId?: string | null,
  filters: MenuListFilters = {},
): UseQueryResult<MenuListResponse, HttpError | Error> {
  const menuService = useMenuService();

  return useQuery<MenuListResponse, HttpError | Error>({
    queryKey: restaurantId ? queryKeys.opsMenu.list(restaurantId, filters) : queryKeys.opsMenu.list('none', filters),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuService.listItems(restaurantId, filters);
    },
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  });
}

export function useOpsMenuItem(
  restaurantId?: string | null,
  itemId?: string | null,
): UseQueryResult<MenuItemDetail, HttpError | Error> {
  const menuService = useMenuService();

  return useQuery<MenuItemDetail, HttpError | Error>({
    queryKey: restaurantId && itemId ? queryKeys.opsMenu.detail(restaurantId, itemId) : queryKeys.opsMenu.detail('none', 'none'),
    queryFn: () => {
      if (!restaurantId || !itemId) {
        throw new Error('Restaurant id and item id are required');
      }
      return menuService.getItem(restaurantId, itemId);
    },
    enabled: Boolean(restaurantId && itemId),
    staleTime: 60_000,
  });
}

export function useOpsCreateMenuItem(
  restaurantId?: string | null,
): UseMutationResult<MenuItemDetail, HttpError | Error, MenuItemUpsertInput> {
  const menuService = useMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MenuItemUpsertInput) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuService.createItem(restaurantId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: ['ops', 'menu', restaurantId] });
    },
  });
}

export function useOpsUpdateMenuItem(
  restaurantId?: string | null,
  itemId?: string | null,
): UseMutationResult<MenuItemDetail, HttpError | Error, MenuItemUpsertInput> {
  const menuService = useMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MenuItemUpsertInput) => {
      if (!restaurantId || !itemId) {
        throw new Error('Restaurant id and item id are required');
      }
      return menuService.updateItem(restaurantId, itemId, payload);
    },
    onSuccess: async (_item) => {
      if (!restaurantId || !itemId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops', 'menu', restaurantId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.opsMenu.detail(restaurantId, itemId) }),
      ]);
    },
  });
}

export function useOpsMenuImportPreview(
  restaurantId?: string | null,
): UseMutationResult<MenuImportResult, HttpError | Error, MenuImportPayload> {
  const menuService = useMenuService();

  return useMutation({
    mutationFn: async (payload: MenuImportPayload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuService.previewImport(restaurantId, payload);
    },
  });
}

export function useOpsMenuImportApply(
  restaurantId?: string | null,
): UseMutationResult<MenuImportResult, HttpError | Error, MenuImportPayload> {
  const menuService = useMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MenuImportPayload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return menuService.applyImport(restaurantId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: ['ops', 'menu', restaurantId] });
    },
  });
}
