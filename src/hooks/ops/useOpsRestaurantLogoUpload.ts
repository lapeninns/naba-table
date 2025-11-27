'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';

export type RestaurantLogoUploadResult = {
  path: string;
  url: string;
  cacheKey: string;
};

export function useOpsRestaurantLogoUpload(
  restaurantId?: string | null,
): UseMutationResult<RestaurantLogoUploadResult, HttpError | Error, File> {
  return useMutation<RestaurantLogoUploadResult, HttpError | Error, File>({
    mutationFn: async (file) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      const formData = new FormData();
      formData.append('file', file);

      return fetchJson<RestaurantLogoUploadResult>(`/api/restaurants/${restaurantId}/logo`, {
        method: 'POST',
        body: formData,
      });
    },
  });
}
