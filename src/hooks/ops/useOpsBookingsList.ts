'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import type { OpsBookingsFilters, OpsBookingsPage } from '@/types/ops';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeFilters(filters: OpsBookingsFilters) {
  const normalized: Record<string, string | number> = {
    restaurantId: filters.restaurantId,
  };

  if (filters.page) normalized.page = filters.page;
  if (filters.pageSize) normalized.pageSize = filters.pageSize;
  if (filters.status && filters.status !== 'all') normalized.status = filters.status;
  if (filters.sort) normalized.sort = filters.sort;

  const fromIso = toIsoString(filters.from ?? undefined);
  if (fromIso) normalized.from = fromIso;

  const toIso = toIsoString(filters.to ?? undefined);
  if (toIso) normalized.to = toIso;

  const query = filters.query?.toString().trim();
  if (query) normalized.query = query;

  return normalized;
}

export function useOpsBookingsList(
  filters: OpsBookingsFilters | null,
): UseQueryResult<OpsBookingsPage, HttpError> {
  const bookingService = useBookingService();

  const normalizedFilters = useMemo(() => {
    if (!filters) return null;
    return normalizeFilters(filters);
  }, [filters]);

  const queryKey = normalizedFilters ? queryKeys.opsBookings.list(normalizedFilters) : queryKeys.opsBookings.list();

  return useQuery<OpsBookingsPage, HttpError>({
    queryKey,
    queryFn: () => {
      if (!filters) {
        throw new Error('Restaurant is required to fetch bookings');
      }
      return bookingService.listBookings(filters);
    },
    enabled: Boolean(filters?.restaurantId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
