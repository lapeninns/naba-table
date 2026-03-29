'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOpsBooking } from '@/hooks/ops/useOpsBooking';
import { useOpsCancelBooking } from '@/hooks/ops/useOpsCancelBooking';
import { getDateInTimezone, getTodayInTimezone } from '@/lib/utils/datetime';
import { mapOpsBookingListItemToBookingDTO } from '@/utils/ops/mapOpsBookingListItemToBookingDTO';

import type { BookingDTO } from '@/hooks/useBookings';

export type UseOpsBookingsDialogsParams = {
  bookingById: Map<string, BookingDTO>;
  focusBookingId: string | null;
  activeRestaurantId: string | null;
  restaurantTimezone: string | null;
  appliedDate: string | null;
  fallbackRestaurantSlug: string | null;
  clearFocusParam: () => void;
};

export function useOpsBookingsDialogs({
  bookingById,
  focusBookingId,
  activeRestaurantId,
  restaurantTimezone,
  appliedDate,
  fallbackRestaurantSlug,
  clearFocusParam,
}: UseOpsBookingsDialogsParams) {
  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isFocusAutoOpenReady, setIsFocusAutoOpenReady] = useState(false);

  const cancelBookingMutation = useOpsCancelBooking();
  const focusedBookingFromList = useMemo(
    () => (focusBookingId ? bookingById.get(focusBookingId) ?? null : null),
    [bookingById, focusBookingId],
  );
  const { data: focusedBookingData } = useOpsBooking(focusedBookingFromList ? null : focusBookingId);
  const focusedBooking = useMemo(
    () =>
      focusedBookingData
        ? mapOpsBookingListItemToBookingDTO(focusedBookingData, fallbackRestaurantSlug)
        : null,
    [fallbackRestaurantSlug, focusedBookingData],
  );
  const focusAutoOpenTarget = useMemo(
    () => focusedBookingFromList || focusedBooking,
    [focusedBooking, focusedBookingFromList],
  );

  useEffect(() => {
    setIsFocusAutoOpenReady(true);
  }, []);

  useEffect(() => {
    if (!isFocusAutoOpenReady) return;
    if (!focusBookingId) return;

    const target = focusAutoOpenTarget;
    if (!target) return;

    setDetailsBooking(target);
    setIsDetailsOpen(true);

    // Also scroll to row as backup/context if it exists in the DOM.
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-booking-id="${focusBookingId}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 100);
  }, [focusAutoOpenTarget, focusBookingId, isFocusAutoOpenReady]);

  const onDetails = useCallback((booking: BookingDTO) => {
    setIsEditOpen(false);
    setEditBooking(null);
    setDetailsBooking(booking);
    setIsDetailsOpen(true);
  }, []);

  const onEdit = useCallback((booking: BookingDTO) => {
    setIsDetailsOpen(false);
    setDetailsBooking(null);
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const onDetailsOpenChange = useCallback(
    (open: boolean) => {
      setIsDetailsOpen(open);
      if (!open) {
        setDetailsBooking(null);
        if (focusBookingId) {
          clearFocusParam();
        }
      }
    },
    [clearFocusParam, focusBookingId],
  );

  const onEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
    }
  }, []);

  const resolveCancelTargetDate = useCallback(
    (booking: BookingDTO, timezone: string) => {
      if (booking.startIso) {
        const startDate = new Date(booking.startIso);
        if (!Number.isNaN(startDate.getTime())) {
          return getDateInTimezone(startDate, timezone);
        }
      }
      if (appliedDate) {
        return appliedDate;
      }
      return getTodayInTimezone(timezone);
    },
    [appliedDate],
  );

  const onCancelRequest = useCallback((booking: BookingDTO) => {
    setCancelBooking(booking);
    setIsCancelOpen(true);
  }, []);

  const onCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBooking(null);
    }
  }, []);

  const onConfirmCancel = useCallback(async () => {
    if (!cancelBooking) return;
    const restaurantId = cancelBooking.restaurantId ?? activeRestaurantId;
    if (!restaurantId) return;
    const timezone = cancelBooking.restaurantTimezone ?? restaurantTimezone ?? 'UTC';
    const targetDate = resolveCancelTargetDate(cancelBooking, timezone);

    try {
      await cancelBookingMutation.mutateAsync({
        bookingId: cancelBooking.id,
        restaurantId,
        targetDate,
      });
    } finally {
      onCancelOpenChange(false);
    }
  }, [
    activeRestaurantId,
    cancelBooking,
    cancelBookingMutation,
    onCancelOpenChange,
    resolveCancelTargetDate,
    restaurantTimezone,
  ]);

  return {
    detailsBooking,
    isDetailsOpen,
    onDetailsOpenChange,
    onDetails,
    editBooking,
    isEditOpen,
    onEditOpenChange,
    onEdit,
    cancelBooking,
    isCancelOpen,
    onCancelOpenChange,
    onCancelRequest,
    onConfirmCancel,
    isCancelling: cancelBookingMutation.isPending,
  } as const;
}
