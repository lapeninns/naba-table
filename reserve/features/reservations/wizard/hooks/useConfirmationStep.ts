'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { downloadCalendarEvent, shareReservationDetails } from '@/lib/reservations/share';
import { reservationConfigResult } from '@reserve/shared/config/reservations';
import {
  formatReservationSummaryDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { useWizardDependencies } from '../di';

import type {
  ConfirmationFeedback,
  ConfirmationStatus,
  ConfirmationStepController,
  ConfirmationStepProps,
} from '../ui/steps/confirmation-step/types';

const EVENT_DURATION_MINUTES = reservationConfigResult.config.defaultDurationMinutes;

const buildReservationWindow = (state: ConfirmationStepProps['state']) => {
  const booking = state.lastConfirmed;
  const date = booking?.booking_date ?? state.details.date ?? '';
  if (!date) return null;
  const time = booking?.start_time ?? normalizeTime(state.details.time);
  const normalizedTime = normalizeTime(time);
  const iso = normalizedTime ? `${date}T${normalizedTime}:00` : `${date}T00:00:00`;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + EVENT_DURATION_MINUTES * 60 * 1000);
  return { start, end };
};

export function useConfirmationStep({
  state,
  onNewBooking,
  onClose,
  onActionsChange,
}: ConfirmationStepProps): ConfirmationStepController {
  const { errorReporter } = useWizardDependencies();
  const booking = state.lastConfirmed;
  const details = state.details;

  const venue = useMemo(
    () => ({
      ...DEFAULT_VENUE,
      id: details.restaurantId || DEFAULT_VENUE.id,
      name: details.restaurantName || DEFAULT_VENUE.name,
      address: details.restaurantAddress || DEFAULT_VENUE.address,
      timezone: details.restaurantTimezone || DEFAULT_VENUE.timezone,
    }),
    [
      details.restaurantAddress,
      details.restaurantId,
      details.restaurantName,
      details.restaurantTimezone,
    ],
  );

  const [calendarLoading, setCalendarLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [feedback, setFeedback] = useState<ConfirmationFeedback | null>(null);

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  const reference = booking?.reference ?? 'Pending';
  const guestName = booking?.customer_name ?? details.name;
  const summaryDate = details.date ? formatReservationSummaryDate(details.date) : 'TBC';
  const summaryTime = details.time ? formatReservationTime(details.time) : 'TBC';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;

  const status: ConfirmationStatus = state.lastAction === 'update' ? 'updated' : 'confirmed';

  const heading = status === 'updated' ? 'Booking updated' : 'Booking confirmed';

  const description =
    status === 'updated'
      ? `Your reservation was updated. A confirmation email has been sent to ${details.email}.`
      : `A confirmation email has been sent to ${details.email}.`;

  const reservationWindow = useMemo(() => buildReservationWindow(state), [state]);

  const showFeedback = useCallback((variant: ConfirmationFeedback['variant'], message: string) => {
    setFeedback({ variant, message });
  }, []);

  const sharePayload = useMemo(
    () => ({
      reservationId: booking?.id ?? state.details.bookingId ?? 'reservation',
      reference: booking?.reference ?? null,
      guestName,
      partySize: booking?.party_size ?? details.party,
      startAt: reservationWindow?.start.toISOString() ?? null,
      endAt: reservationWindow?.end.toISOString() ?? null,
      venueName: venue.name,
      venueAddress: venue.address,
      venueTimezone: venue.timezone,
    }),
    [
      booking?.id,
      booking?.reference,
      booking?.party_size,
      details.party,
      state.details.bookingId,
      guestName,
      reservationWindow?.start,
      reservationWindow?.end,
      venue.name,
      venue.address,
      venue.timezone,
    ],
  );

  const handleAddToCalendar = useCallback(() => {
    setCalendarLoading(true);
    try {
      const result = downloadCalendarEvent(sharePayload);
      showFeedback(result.variant, result.message);
    } finally {
      setCalendarLoading(false);
    }
  }, [sharePayload, showFeedback]);

  const handleAddToWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const result = await shareReservationDetails(sharePayload);
      showFeedback(result.variant, result.message);
    } catch (error) {
      errorReporter.capture(error, {
        scope: 'confirmation.share',
        reservationId: state.lastConfirmed?.id,
      });
      showFeedback('error', "We couldn't share the reservation details. Please try again.");
    } finally {
      setWalletLoading(false);
    }
  }, [errorReporter, sharePayload, showFeedback, state.lastConfirmed?.id]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleNewBooking = useCallback(() => {
    onNewBooking();
  }, [onNewBooking]);

  useEffect(() => {
    onActionsChange([
      {
        id: 'confirmation-close',
        label: 'Close confirmation',
        ariaLabel: 'Close confirmation',
        variant: 'ghost',
        icon: 'X',
        onClick: handleClose,
      },
      {
        id: 'confirmation-calendar',
        label: 'Add reservation to calendar',
        ariaLabel: 'Add reservation to calendar',
        variant: 'outline',
        icon: 'Calendar',
        onClick: handleAddToCalendar,
        loading: calendarLoading,
      },
      {
        id: 'confirmation-wallet',
        label: 'Add reservation to wallet',
        ariaLabel: 'Add reservation to wallet',
        variant: 'outline',
        icon: 'Wallet',
        onClick: handleAddToWallet,
        loading: walletLoading,
      },
      {
        id: 'confirmation-new',
        label: 'Start a new booking',
        ariaLabel: 'Start a new booking',
        variant: 'default',
        icon: 'Plus',
        onClick: handleNewBooking,
      },
    ]);
  }, [
    calendarLoading,
    handleAddToCalendar,
    handleAddToWallet,
    handleClose,
    handleNewBooking,
    onActionsChange,
    walletLoading,
  ]);

  return {
    booking,
    details,
    venue,
    status,
    heading,
    description,
    reference,
    guestName,
    summaryDate,
    summaryTime,
    partyText,
    reservationWindow,
    calendarLoading,
    walletLoading,
    feedback,
    dismissFeedback,
    handleAddToCalendar,
    handleAddToWallet,
    handleClose,
    handleNewBooking,
  };
}
