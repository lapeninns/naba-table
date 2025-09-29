'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type BookingStatus = 'pending' | 'pending_allocation' | 'confirmed' | 'cancelled';

export type BookingDTO = {
  id: string;
  restaurantName: string;
  partySize: number;
  startIso: string;
  endIso: string;
  status: BookingStatus;
  notes?: string | null;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export type BookingsPage = {
  items: BookingDTO[];
  pageInfo: PageInfo;
};

export type BookingsFilters = {
  page?: number;
  pageSize?: number;
  status?: BookingStatus | 'all';
  sort?: 'asc' | 'desc';
  from?: Date | string | null;
  to?: Date | string | null;
  restaurantId?: string;
};

function toIsoString(value?: Date | string | null): string | undefined {
  if (!value) return undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value.toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function useBookings(filters: BookingsFilters = {}): UseQueryResult<BookingsPage, HttpError> {
  const searchParams = useMemo(() => {
    const params = new URLSearchParams({ me: '1' });

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

    if (filters.restaurantId) {
      params.set('restaurantId', filters.restaurantId);
    }

    return params;
  }, [filters.from, filters.page, filters.pageSize, filters.restaurantId, filters.sort, filters.status, filters.to]);

  const queryKeyParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const search = searchParams.toString();

  type BookingsListKey = ReturnType<(typeof queryKeys)['bookings']['list']>;

  return useQuery<BookingsPage, HttpError, BookingsPage, BookingsListKey>({
    queryKey: queryKeys.bookings.list(queryKeyParams),
    queryFn: () => fetchJson<BookingsPage>(`/api/bookings?${search}`),
    placeholderData: keepPreviousData,
  });
}
