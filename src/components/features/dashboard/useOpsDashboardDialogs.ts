'use client';

import { useCallback, useMemo, useState } from 'react';

import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsDashboardDialogs(params: {
  resolveBookingById: (bookingId: string | null) => BookingDTO | null;
}) {
  const { resolveBookingById } = params;
  const [detailsBookingId, setDetailsBookingId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const detailsBooking = useMemo(
    () => resolveBookingById(detailsBookingId),
    [detailsBookingId, resolveBookingById],
  );
  const editBooking = useMemo(
    () => resolveBookingById(editBookingId),
    [editBookingId, resolveBookingById],
  );

  const handleDetails = useCallback((bookingId: string) => {
    setIsEditOpen(false);
    setEditBookingId(null);
    setDetailsBookingId(bookingId);
    setIsDetailsOpen(true);
  }, []);

  const handleEdit = useCallback((bookingId: string) => {
    setIsDetailsOpen(false);
    setDetailsBookingId(null);
    setEditBookingId(bookingId);
    setIsEditOpen(true);
  }, []);

  const handleDetailsOpenChange = useCallback((open: boolean) => {
    setIsDetailsOpen(open);
    if (!open) {
      setDetailsBookingId(null);
    }
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBookingId(null);
    }
  }, []);

  /** Closes details and edit, e.g. before the cancel confirmation opens. */
  const closeOtherDialogs = useCallback(() => {
    setIsDetailsOpen(false);
    setDetailsBookingId(null);
    setIsEditOpen(false);
    setEditBookingId(null);
  }, []);

  return {
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    closeOtherDialogs,
  };
}
