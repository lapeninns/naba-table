"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildBookingsQueryKeyParams } from "@/guest/services/bookings-params";
import { useGuestServices } from "@/guest/services/di";
import { queryKeys } from "@/lib/query/keys";

import type { BookingsFilters, BookingsPage } from "@/guest/services/ports";
import type { HttpError } from "@/lib/http/errors";

export const useGuestBookings = (filters: BookingsFilters = {}): UseQueryResult<BookingsPage, HttpError> => {
  const services = useGuestServices();

  const queryKeyParams = useMemo(() => buildBookingsQueryKeyParams(filters), [filters]);

  return useQuery<BookingsPage, HttpError>({
    queryKey: queryKeys.bookings.list(queryKeyParams),
    queryFn: () => services.bookings.list(filters),
    placeholderData: keepPreviousData,
  });
};
