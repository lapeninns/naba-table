'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';

import type { ReviewGrowthRange, ReviewGrowthSummaryResponse } from '@/types/reviewGrowth';

export function useOpsReviewGrowthSummary(params: {
  restaurantId: string | null;
  range: ReviewGrowthRange;
}) {
  return useQuery({
    queryKey: ['ops', 'review-growth', params.restaurantId ?? 'disabled', params.range] as const,
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
