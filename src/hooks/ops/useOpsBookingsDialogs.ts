'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { mapOpsBookingListItemToBookingDTO } from '@/utils/ops/mapOpsBookingListItemToBookingDTO';

import { useOpsBooking } from './useOpsBooking';
import { useOpsCancelBookingController } from './useOpsCancelBookingController';

import type { BookingDTO } from '@/hooks/useBookings';

export type UseOpsBookingsDialogsParams = {
  bookingById: Map<string, BookingDTO>;
  focusBookingId: string | null;
  activeRestaurantId: string | null;
  fallbackRestaurantSlug: string | null;
  clearFocusParam: () => void;
};

export function useOpsBookingsDialogs({
  bookingById,
  focusBookingId,
  activeRestaurantId,
  fallbackRestaurantSlug,
  clearFocusParam,
}: UseOpsBookingsDialogsParams) {
  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFocusAutoOpenReady, setIsFocusAutoOpenReady] = useState(false);

  const cancelController = useOpsCancelBookingController<BookingDTO>({
    fallbackRestaurantId: activeRestaurantId,
  });
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

  const onCancelRequest = useCallback(
    (booking: BookingDTO) => {
      cancelController.request(booking);
    },
    [cancelController],
  );

  return {
    detailsBooking,
    isDetailsOpen,
    onDetailsOpenChange,
    onDetails,
    editBooking,
    isEditOpen,
    onEditOpenChange,
    onEdit,
    cancelBooking: cancelController.booking,
    isCancelOpen: cancelController.isOpen,
    onCancelOpenChange: cancelController.onOpenChange,
    onCancelRequest,
    onConfirmCancel: cancelController.confirm,
    isCancelling: cancelController.isPending,
  } as const;
}
