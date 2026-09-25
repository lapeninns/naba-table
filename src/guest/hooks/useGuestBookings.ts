'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { buildBookingsQueryKeyParams } from '@/guest/services/bookings-params';
import { useGuestServices } from '@/guest/services/di';
import { queryKeys } from '@/lib/query/keys';

import type { BookingsFilters, BookingsPage } from '@/guest/services/ports';
import type { HttpError } from '@/lib/http/errors';

type GuestBookingsQueryOptions = {
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false;
};

export const useGuestBookings = (
  filters: BookingsFilters = {},
  options: GuestBookingsQueryOptions = {},
): UseQueryResult<BookingsPage, HttpError> => {
  const services = useGuestServices();
  const [isVisible, setIsVisible] = useState(true);
  const pollIntervalMs = 60_000;

  const queryKeyParams = useMemo(() => buildBookingsQueryKeyParams(filters), [filters]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsVisible(document.visibilityState === 'visible');
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return useQuery<BookingsPage, HttpError>({
    queryKey: queryKeys.bookings.list(queryKeyParams),
    queryFn: () => services.bookings.list(filters),
    placeholderData: keepPreviousData,
    // Omit when unset so the client's `['bookings']` default applies (an own `undefined` overrides it).
    ...(options.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    refetchOnReconnect: options.refetchOnReconnect ?? true,
    refetchInterval:
      options.refetchInterval === false
        ? false
        : isVisible
          ? (options.refetchInterval ?? pollIntervalMs)
          : false,
    refetchIntervalInBackground: false,
  });
};
