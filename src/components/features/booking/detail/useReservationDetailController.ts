'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildBookingDto,
  buildRebookPath,
  buildReservationDisplay,
  buildReservationSharePayload,
  buildReservationVenue,
  feedbackTone,
  isPastReservation as resolveIsPastReservation,
  resolvePastGraceMs,
  resolvePendingLockState,
  resolveReservationStatusConfig,
  shouldDisableReservationActions,
  type ReservationVenue,
} from '@/components/features/booking/detail/reservationDetailDomain';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { emit } from '@/lib/analytics/emit';
import {
  downloadCalendarEvent,
  shareReservationDetails,
  type ShareResult,
} from '@/lib/reservations/share';
import { useReservation } from '@features/reservations/wizard/api/useReservation';

export type UseReservationDetailControllerProps = {
  reservationId: string;
  restaurantName: string | null;
  initialNow: number;
  _structuredData?: string | null;
  venue?: ReservationVenue | null;
  canManage?: boolean;
};

export function useReservationDetailController({
  reservationId,
  restaurantName,
  initialNow,
  venue: providedVenue,
  canManage = false,
}: UseReservationDetailControllerProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const viewTrackedRef = useRef(false);
  const isOnline = useOnlineStatus();
  const [shareFeedback, setShareFeedback] = useState<ShareResult | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clockNow, setClockNow] = useState(initialNow);
  const pastGraceMs = useMemo(
    () => resolvePastGraceMs(process.env.NEXT_PUBLIC_BOOKING_PAST_TIME_GRACE_MINUTES),
    [],
  );

  const {
    data: reservation,
    error,
    isError,
    isLoading,
    refetch,
    isFetching,
  } = useReservation(reservationId);

  const venue = useMemo<ReservationVenue>(
    () => buildReservationVenue({ providedVenue, reservation, restaurantName }),
    [providedVenue, reservation, restaurantName],
  );

  const bookingDto = useMemo(
    () => buildBookingDto(reservation, restaurantName, venue),
    [reservation, restaurantName, venue],
  );

  const sharePayload = useMemo(
    () =>
      buildReservationSharePayload({
        reservation,
        reservationId,
        venue,
        manageUrl:
          typeof window === 'undefined'
            ? null
            : `${window.location.origin}/bookings/${reservationId}`,
      }),
    [reservation, reservationId, venue],
  );

  const isPastReservation = useMemo(
    () =>
      resolveIsPastReservation({
        reservation,
        venueTimezone: venue.timezone,
        clockNow,
        pastGraceMs,
      }),
    [clockNow, pastGraceMs, reservation, venue.timezone],
  );

  const pendingLock = useMemo(
    () => resolvePendingLockState({ reservation, clockNow }),
    [clockNow, reservation],
  );

  const reservationDisplay = useMemo(
    () => buildReservationDisplay(reservation?.startAt, venue.timezone),
    [reservation?.startAt, venue.timezone],
  );

  useEffect(() => {
    if (!shareFeedback) {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      return;
    }
    feedbackTimerRef.current = setTimeout(() => {
      setShareFeedback(null);
    }, 6000);
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [shareFeedback]);

  useEffect(() => {
    if (!reservation || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    void emit('reservation_detail_viewed', { reservationId, status: reservation.status });
  }, [reservation, reservationId]);

  useEffect(() => {
    if (!reservation || reservation.status !== 'pending' || pendingLock.locked) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [reservation, pendingLock.locked]);

  useEffect(() => {
    setClockNow(Date.now());
  }, []);

  const handleEdit = useCallback(() => {
    if (!reservation || pendingLock.locked || !canManage || isPastReservation) return;
    void emit('reservation_detail_edit_clicked', { reservationId });
    setIsEditOpen(true);
  }, [canManage, isPastReservation, pendingLock.locked, reservation, reservationId]);

  const handleCancel = useCallback(() => {
    if (!reservation || pendingLock.locked || !canManage || isPastReservation) return;
    void emit('reservation_detail_cancel_clicked', { reservationId });
    setIsCancelOpen(true);
  }, [canManage, isPastReservation, pendingLock.locked, reservation, reservationId]);

  const handleRebook = useCallback(() => {
    if (!reservation) return;
    void emit('reservation_detail_rebook_clicked', { reservationId, party: reservation.partySize });
    router.push(buildRebookPath({ reservation, venueSlug: venue.slug }));
  }, [reservation, reservationId, router, venue.slug]);

  const handleShare = useCallback(() => {
    if (!sharePayload) return;
    void emit('reservation_detail_share_clicked', { reservationId });
    void shareReservationDetails(sharePayload)
      .then((result) => setShareFeedback(result))
      .catch(() =>
        setShareFeedback({
          variant: 'error',
          message: "We couldn't share the reservation details. Please try again.",
        }),
      );
  }, [sharePayload, reservationId]);

  const handleDownload = useCallback(() => {
    if (!reservation) {
      setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/reservations/${reservation.id}/confirmation`;
    link.download = `reservation-${reservation.reference ?? reservation.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [reservation]);

  const handleAddToCalendar = useCallback(() => {
    if (!sharePayload) {
      setShareFeedback({ variant: 'warning', message: 'Reservation details not ready yet.' });
      return;
    }
    void emit('reservation_detail_add_calendar_clicked', { reservationId });
    const result = downloadCalendarEvent(sharePayload);
    setShareFeedback(result);
  }, [sharePayload, reservationId]);

  const closeEditDialog = useCallback((open: boolean) => setIsEditOpen(open), []);
  const closeCancelDialog = useCallback((open: boolean) => setIsCancelOpen(open), []);

  const actionDisabled = shouldDisableReservationActions({
    reservation,
    pendingLocked: pendingLock.locked,
    isPastReservation,
    canManage,
  });

  const statusConfig = reservation
    ? resolveReservationStatusConfig(reservation.status)
    : resolveReservationStatusConfig('default');

  return {
    actionDisabled,
    bookingDto,
    canManage,
    closeCancelDialog,
    closeEditDialog,
    errorDescription: error?.message ?? 'We encountered an error loading your reservation.',
    handleAddToCalendar,
    handleCancel,
    handleDownload,
    handleEdit,
    handleRebook,
    handleShare,
    isCancelOpen,
    isEditOpen,
    isFetching,
    isInitialError: isError && !reservation,
    isInitialLoading: isLoading && !reservation,
    isOnline,
    pendingLock,
    refetch,
    reservation,
    reservationDisplay,
    reservationId,
    restaurantName,
    shareFeedback,
    statusConfig,
    venue,
    shareFeedbackTone: shareFeedback ? feedbackTone(shareFeedback.variant) : null,
  };
}
