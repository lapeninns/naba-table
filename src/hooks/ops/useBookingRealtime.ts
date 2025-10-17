"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTransitionToast } from "@/components/features/booking-state-machine";
import { useOptionalBookingStateMachine } from "@/contexts/booking-state-machine";
import { useBookingService } from "@/contexts/ops-services";
import type { OpsBookingStatus } from "@/types/ops";

type UseBookingRealtimeOptions = {
  restaurantId: string | null;
  targetDate: string | null;
  bookingIds: string[];
  visibleBookingIds?: string[];
  enabled?: boolean;
  intervalMs?: number;
};

type BookingSnapshot = {
  id: string;
  status: OpsBookingStatus;
  updatedAt: string | null;
  displayName?: string | null;
};

const DEFAULT_INTERVAL_MS = 5_000;

export function useBookingRealtime({
  restaurantId,
  targetDate,
  bookingIds,
  visibleBookingIds,
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseBookingRealtimeOptions) {
  const bookingService = useBookingService();
  const bookingStateMachine = useOptionalBookingStateMachine();
  const { showExternalUpdate } = useTransitionToast();

  const normalizedIds = useMemo(() => Array.from(new Set(bookingIds)).sort(), [bookingIds]);
  const idsKey = useMemo(() => normalizedIds.join(","), [normalizedIds]);
  const shouldEnable = enabled && Boolean(restaurantId) && normalizedIds.length > 0;
  const idSet = useMemo(() => new Set(normalizedIds), [normalizedIds]);
  const visibleIds = useMemo(() => {
    if (!visibleBookingIds || visibleBookingIds.length === 0) {
      return idSet;
    }
    return new Set(visibleBookingIds);
  }, [idSet, visibleBookingIds]);

  const lastStatusesRef = useRef<Record<string, OpsBookingStatus>>({});
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!shouldEnable) {
      lastStatusesRef.current = {};
      bootstrappedRef.current = false;
    }
  }, [shouldEnable]);

  useEffect(() => {
    const allowed = new Set(normalizedIds);
    const current = lastStatusesRef.current;
    Object.keys(current).forEach((id) => {
      if (!allowed.has(id)) {
        delete current[id];
      }
    });
  }, [normalizedIds]);

  useEffect(() => {
    if (!bookingStateMachine) return;
    const entries = bookingStateMachine.state.entries;
    for (const entry of Object.values(entries)) {
      if (entry) {
        lastStatusesRef.current[entry.id] = entry.status;
      }
    }
  }, [bookingStateMachine, bookingStateMachine?.state]);

  const query = useQuery({
    queryKey: ["ops", "bookings", "realtime", restaurantId, targetDate, idsKey],
    queryFn: async () => {
      if (!restaurantId) {
        return null;
      }
      return bookingService.getTodaySummary({ restaurantId, date: targetDate ?? undefined });
    },
    enabled: shouldEnable,
    refetchInterval: shouldEnable ? intervalMs : false,
    refetchIntervalInBackground: true,
    refetchOnReconnect: shouldEnable,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!shouldEnable) return;
    if (!query.data || query.data.bookings.length === 0) return;

    const snapshots: BookingSnapshot[] = [];
    const changes: Array<BookingSnapshot & { previousStatus: OpsBookingStatus | undefined }> = [];

    for (const booking of query.data.bookings) {
      if (!idSet.has(booking.id)) {
        continue;
      }
      snapshots.push({
        id: booking.id,
        status: booking.status,
        updatedAt: booking.checkedOutAt ?? booking.checkedInAt ?? null,
        displayName: booking.customerName,
      });

      const previous = lastStatusesRef.current[booking.id];
      if (bootstrappedRef.current && previous && previous !== booking.status && visibleIds.has(booking.id)) {
        const entry = bookingStateMachine?.getEntry(booking.id);
        const optimisticTarget = entry?.optimistic?.targetStatus ?? null;
        if (!optimisticTarget || optimisticTarget !== booking.status) {
          changes.push({
            id: booking.id,
            status: booking.status,
            updatedAt: booking.checkedOutAt ?? booking.checkedInAt ?? null,
            displayName: booking.customerName,
            previousStatus: previous,
          });
        }
      }
      lastStatusesRef.current[booking.id] = booking.status;
    }

    if (snapshots.length > 0) {
      bookingStateMachine?.registerBookings(
        snapshots.map(({ id, status, updatedAt }) => ({
          id,
          status,
          updatedAt,
        })),
      );
    }

    if (changes.length > 0) {
      for (const change of changes) {
        showExternalUpdate({
          bookingLabel: change.displayName ?? change.id,
          fromStatus: change.previousStatus ?? null,
          toStatus: change.status,
        });
      }
    }

    bootstrappedRef.current = true;
  }, [
    bookingStateMachine,
    idSet,
    query.data,
    shouldEnable,
    showExternalUpdate,
    visibleIds,
  ]);

  return {
    isPolling: query.isFetching,
    lastUpdatedAt: query.data?.date ?? null,
  };
}
