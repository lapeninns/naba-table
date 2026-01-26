'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useEmailStatusService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OpsEmailJobType, OpsEmailStatusPage } from '@/types/ops';

export type OpsEmailStatusFilters = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  windowMinutes?: number;
  type?: OpsEmailJobType;
};

function normalizeFilters(filters: OpsEmailStatusFilters) {
  const normalized: Record<string, string | number> = {
    restaurantId: filters.restaurantId,
  };

  if (filters.page) normalized.page = filters.page;
  if (filters.pageSize) normalized.pageSize = filters.pageSize;
  if (filters.windowMinutes) normalized.windowMinutes = filters.windowMinutes;
  if (filters.type) normalized.type = filters.type;

  return normalized;
}

export function useOpsEmailStatus(
  filters: OpsEmailStatusFilters | null,
): UseQueryResult<OpsEmailStatusPage, HttpError> {
  const emailStatusService = useEmailStatusService();

  const normalizedFilters = useMemo(() => {
    if (!filters) return null;
    return normalizeFilters(filters);
  }, [filters]);

  const queryKey = normalizedFilters ? queryKeys.opsEmailStatus.list(normalizedFilters) : queryKeys.opsEmailStatus.list();

  return useQuery<OpsEmailStatusPage, HttpError>({
    queryKey,
    queryFn: () => {
      if (!filters) {
        throw new Error('Restaurant is required to fetch email status');
      }
      return emailStatusService.list(filters);
    },
    enabled: Boolean(filters?.restaurantId),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: Boolean(filters?.restaurantId),
  });
}
