'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { ReviewGrowthRange, ReviewGrowthSummaryResponse } from '@/types/reviewGrowth';

export function useOpsReviewGrowthSummary(params: {
  restaurantId: string | null;
  range: ReviewGrowthRange;
}) {
  return useQuery({
    queryKey: queryKeys.opsReviewGrowth.summary(params.restaurantId, params.range),
    queryFn: () => {
      const query = new URLSearchParams({
        restaurantId: params.restaurantId ?? '',
        range: params.range,
      });
      return fetchJson<ReviewGrowthSummaryResponse>(`/api/ops/reviews/summary?${query}`);
    },
    enabled: Boolean(params.restaurantId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
