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
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const detailsBooking = useMemo(
    () => resolveBookingById(detailsBookingId),
    [detailsBookingId, resolveBookingById],
  );
  const editBooking = useMemo(
    () => resolveBookingById(editBookingId),
    [editBookingId, resolveBookingById],
  );
  const cancelBooking = useMemo(
    () => resolveBookingById(cancelBookingId),
    [cancelBookingId, resolveBookingById],
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

  const handleCancelRequest = useCallback((bookingId: string) => {
    setIsDetailsOpen(false);
    setDetailsBookingId(null);
    setIsEditOpen(false);
    setEditBookingId(null);
    setCancelBookingId(bookingId);
    setIsCancelOpen(true);
  }, []);

  const handleCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBookingId(null);
    }
  }, []);

  return {
    detailsBooking,
    isDetailsOpen,
    editBooking,
    isEditOpen,
    cancelBooking,
    isCancelOpen,
    handleDetails,
    handleEdit,
    handleDetailsOpenChange,
    handleEditOpenChange,
    handleCancelRequest,
    handleCancelOpenChange,
  };
}
