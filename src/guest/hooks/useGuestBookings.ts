"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { buildBookingsQueryKeyParams } from "@/guest/services/bookings-params";
import { useGuestServices } from "@/guest/services/di";
import { queryKeys } from "@/lib/query/keys";

import type { BookingsFilters, BookingsPage } from "@/guest/services/ports";
import type { HttpError } from "@/lib/http/errors";

export const useGuestBookings = (filters: BookingsFilters = {}): UseQueryResult<BookingsPage, HttpError> => {
  const services = useGuestServices();
  const [isVisible, setIsVisible] = useState(true);
  const pollIntervalMs = 60_000;

  const queryKeyParams = useMemo(() => buildBookingsQueryKeyParams(filters), [filters]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => setIsVisible(document.visibilityState === "visible");
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return useQuery<BookingsPage, HttpError>({
    queryKey: queryKeys.bookings.list(queryKeyParams),
    queryFn: () => services.bookings.list(filters),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: isVisible ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
  });
};
