'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { BookingStatus, BookingsPage } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';


export type OpsBookingsFilters = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  status?: BookingStatus | 'all';
  sort?: 'asc' | 'desc';
  from?: Date | string | null;
  to?: Date | string | null;
};

function toIsoString(value?: Date | string | null): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function useOpsBookings(filters: OpsBookingsFilters): UseQueryResult<BookingsPage, HttpError> {
  const searchParams = useMemo(() => {
    const params = new URLSearchParams();

    params.set('restaurantId', filters.restaurantId);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }

    if (filters.sort) {
      params.set('sort', filters.sort);
    }

    const from = toIsoString(filters.from);
    if (from) {
      params.set('from', from);
    }

    const to = toIsoString(filters.to);
    if (to) {
      params.set('to', to);
    }

    return params;
  }, [filters.from, filters.page, filters.pageSize, filters.restaurantId, filters.sort, filters.status, filters.to]);

  const queryKeyParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const search = searchParams.toString();

  type OpsBookingsListKey = ReturnType<(typeof queryKeys)['opsBookings']['list']>;

  return useQuery<BookingsPage, HttpError, BookingsPage, OpsBookingsListKey>({
    queryKey: queryKeys.opsBookings.list(queryKeyParams),
    queryFn: () => fetchJson<BookingsPage>(`/api/ops/bookings?${search}`),
    placeholderData: keepPreviousData,
    enabled: Boolean(filters.restaurantId),
  });
}
