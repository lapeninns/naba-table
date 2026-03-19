'use client';

import { useCallback, useState } from 'react';

import type { BookingDTO } from '@/hooks/useBookings';

export function useOpsDashboardDialogs() {
  const [detailsBooking, setDetailsBooking] = useState<BookingDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<BookingDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [cancelBooking, setCancelBooking] = useState<BookingDTO | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const handleDetails = useCallback((booking: BookingDTO) => {
    setIsEditOpen(false);
    setEditBooking(null);
    setDetailsBooking(booking);
    setIsDetailsOpen(true);
  }, []);

  const handleEdit = useCallback((booking: BookingDTO) => {
    setIsDetailsOpen(false);
    setDetailsBooking(null);
    setEditBooking(booking);
    setIsEditOpen(true);
  }, []);

  const handleDetailsOpenChange = useCallback((open: boolean) => {
    setIsDetailsOpen(open);
    if (!open) {
      setDetailsBooking(null);
    }
  }, []);

  const handleEditOpenChange = useCallback((open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditBooking(null);
    }
  }, []);

  const handleCancelRequest = useCallback((booking: BookingDTO) => {
    setIsDetailsOpen(false);
    setDetailsBooking(null);
    setIsEditOpen(false);
    setEditBooking(null);
    setCancelBooking(booking);
    setIsCancelOpen(true);
  }, []);

  const handleCancelOpenChange = useCallback((open: boolean) => {
    setIsCancelOpen(open);
    if (!open) {
      setCancelBooking(null);
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
