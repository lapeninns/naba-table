'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { useDrinkMenuService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type {
  DrinkImportResult,
  DrinkItemDetail,
  DrinkItemUpsertInput,
  DrinkListFilters,
  DrinkListResponse,
} from '@/server/drinks-menu/types';
import type { DrinkMenuImportPayload } from '@/services/ops/drinks-menu';

export function useOpsDrinkMenuList(
  restaurantId?: string | null,
  filters: DrinkListFilters = {},
): UseQueryResult<DrinkListResponse, HttpError | Error> {
  const drinkMenuService = useDrinkMenuService();

  return useQuery<DrinkListResponse, HttpError | Error>({
    queryKey: restaurantId
      ? queryKeys.opsDrinksMenu.list(restaurantId, filters)
      : queryKeys.opsDrinksMenu.list('none', filters),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return drinkMenuService.listItems(restaurantId, filters);
    },
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  });
}

export function useOpsDrinkMenuItem(
  restaurantId?: string | null,
  itemId?: string | null,
): UseQueryResult<DrinkItemDetail, HttpError | Error> {
  const drinkMenuService = useDrinkMenuService();

  return useQuery<DrinkItemDetail, HttpError | Error>({
    queryKey:
      restaurantId && itemId
        ? queryKeys.opsDrinksMenu.detail(restaurantId, itemId)
        : queryKeys.opsDrinksMenu.detail('none', 'none'),
    queryFn: () => {
      if (!restaurantId || !itemId) {
        throw new Error('Restaurant id and item id are required');
      }
      return drinkMenuService.getItem(restaurantId, itemId);
    },
    enabled: Boolean(restaurantId && itemId),
    staleTime: 60_000,
  });
}

export function useOpsCreateDrinkMenuItem(
  restaurantId?: string | null,
): UseMutationResult<DrinkItemDetail, HttpError | Error, DrinkItemUpsertInput> {
  const drinkMenuService = useDrinkMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DrinkItemUpsertInput) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return drinkMenuService.createItem(restaurantId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: ['ops', 'drinks-menu', restaurantId] });
    },
  });
}

export function useOpsUpdateDrinkMenuItem(
  restaurantId?: string | null,
  itemId?: string | null,
): UseMutationResult<DrinkItemDetail, HttpError | Error, DrinkItemUpsertInput> {
  const drinkMenuService = useDrinkMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DrinkItemUpsertInput) => {
      if (!restaurantId || !itemId) {
        throw new Error('Restaurant id and item id are required');
      }
      return drinkMenuService.updateItem(restaurantId, itemId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId || !itemId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ops', 'drinks-menu', restaurantId] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.opsDrinksMenu.detail(restaurantId, itemId) }),
      ]);
    },
  });
}

export function useOpsDrinkMenuImportPreview(
  restaurantId?: string | null,
): UseMutationResult<DrinkImportResult, HttpError | Error, DrinkMenuImportPayload> {
  const drinkMenuService = useDrinkMenuService();

  return useMutation({
    mutationFn: async (payload: DrinkMenuImportPayload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return drinkMenuService.previewImport(restaurantId, payload);
    },
  });
}

export function useOpsDrinkMenuImportApply(
  restaurantId?: string | null,
): UseMutationResult<DrinkImportResult, HttpError | Error, DrinkMenuImportPayload> {
  const drinkMenuService = useDrinkMenuService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DrinkMenuImportPayload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return drinkMenuService.applyImport(restaurantId, payload);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: ['ops', 'drinks-menu', restaurantId] });
    },
  });
}
