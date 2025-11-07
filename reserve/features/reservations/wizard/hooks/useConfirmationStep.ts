'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { downloadCalendarEvent, shareReservationDetails } from '@/lib/reservations/share';
import { reservationConfigResult } from '@reserve/shared/config/reservations';
import {
  formatReservationSummaryDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import { DEFAULT_VENUE } from '@shared/config/venue';

import { useWizardState } from '../context/WizardContext';
import { useWizardDependencies } from '../di';

import type { State } from '../model/reducer';
import type {
  ConfirmationFeedback,
  ConfirmationStatus,
  ConfirmationStepController,
  ConfirmationStepProps,
} from '../ui/steps/confirmation-step/types';
import type { Dispatch, SetStateAction } from 'react';

const buildReservationWindow = (state: State) => {
  const booking = state.lastConfirmed;
  const date = booking?.booking_date ?? state.details.date ?? '';

  if (!date) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[confirmation-step] Missing reservation date.');
    }
    return null;
  }

  const time = booking?.start_time ?? normalizeTime(state.details.time);
  const normalizedTime = normalizeTime(time);

  if (!normalizedTime) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[confirmation-step] Invalid reservation time.', { time });
    }
    return null;
  }

  const iso = `${date}T${normalizedTime}:00`;
  const start = new Date(iso);

  if (Number.isNaN(start.getTime())) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirmation-step] Unable to parse reservation start date.', { iso });
    }
    return null;
  }

  const durationMinutes = state.details.reservationDurationMinutes;
  const fallbackDuration = reservationConfigResult.config.defaultDurationMinutes;
  const safeDuration = durationMinutes > 0 ? durationMinutes : fallbackDuration;

  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirmation-step] Invalid reservation duration.', { safeDuration });
    }
    return null;
  }

  const end = new Date(start.getTime() + safeDuration * 60 * 1000);

  if (Number.isNaN(end.getTime())) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirmation-step] Unable to derive reservation end date.');
    }
    return null;
  }

  if (end <= start) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirmation-step] Reservation end precedes start.', { start, end });
    }
    return null;
  }

  return { start, end };
};

export function useConfirmationStep({
  state: providedState,
  onNewBooking,
  onClose,
  onActionsChange,
}: ConfirmationStepProps): ConfirmationStepController {
  const { errorReporter } = useWizardDependencies();
  const contextState = useWizardState();
  const state = providedState ?? contextState;
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const booking = state.lastConfirmed;
  const details = state.details;
  const isLoading = state.loading;

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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const safeSetState = useCallback(<T>(setter: Dispatch<SetStateAction<T>>) => {
    return (value: SetStateAction<T>) => {
      if (isMountedRef.current) {
        setter(value);
      }
    };
  }, []);

  const safeSetCalendarLoading = useMemo(() => safeSetState(setCalendarLoading), [safeSetState]);
  const safeSetWalletLoading = useMemo(() => safeSetState(setWalletLoading), [safeSetState]);
  const safeSetFeedback = useMemo(() => safeSetState(setFeedback), [safeSetState]);

  const dismissFeedback = useCallback(() => {
    safeSetFeedback(null);
  }, [safeSetFeedback]);

  const reference = booking?.reference ?? 'Pending';
  const guestName = booking?.customer_name ?? details.name;
  const summaryDate = details.date ? formatReservationSummaryDate(details.date) : 'TBC';
  const summaryTime = details.time ? formatReservationTime(details.time) : 'TBC';
  const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;

  const status: ConfirmationStatus = isLoading
    ? 'pending'
    : booking?.status === 'pending' || booking?.status === 'pending_allocation'
      ? 'pending'
      : state.lastAction === 'update'
        ? 'updated'
        : 'confirmed';

  const heading =
    status === 'pending'
      ? 'Booking pending'
      : status === 'updated'
        ? 'Booking updated'
        : 'Booking confirmed';

  const description =
    status === 'pending'
      ? `Your request has been received. You'll shortly get a confirmation email at ${details.email}.`
      : status === 'updated'
        ? `Your reservation was updated. A confirmation email has been sent to ${details.email}.`
        : `A confirmation email has been sent to ${details.email}.`;

  const reservationWindow = useMemo(() => buildReservationWindow(state), [state]);

  const showFeedback = useCallback(
    (variant: ConfirmationFeedback['variant'], message: string) => {
      safeSetFeedback({ variant, message });
    },
    [safeSetFeedback],
  );

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
    safeSetCalendarLoading(true);
    try {
      const result = downloadCalendarEvent(sharePayload);
      showFeedback(result.variant, result.message);
    } catch (error) {
      errorReporter.capture(error, {
        scope: 'confirmation.calendar',
        reservationId: state.lastConfirmed?.id,
      });
      showFeedback('error', 'Failed to download calendar event. Please try again.');
    } finally {
      safeSetCalendarLoading(false);
    }
  }, [errorReporter, sharePayload, showFeedback, state.lastConfirmed?.id, safeSetCalendarLoading]);

  const handleAddToWallet = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    safeSetWalletLoading(true);
    try {
      const result = await shareReservationDetails(sharePayload, {
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        showFeedback(result.variant, result.message);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      errorReporter.capture(error, {
        scope: 'confirmation.share',
        reservationId: state.lastConfirmed?.id,
      });
      showFeedback('error', "We couldn't share the reservation details. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        safeSetWalletLoading(false);
      }
      abortControllerRef.current = null;
    }
  }, [errorReporter, sharePayload, showFeedback, state.lastConfirmed?.id, safeSetWalletLoading]);

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
        disabled: isLoading,
        role: 'secondary',
      },
      {
        id: 'confirmation-calendar',
        label: 'Add reservation to calendar',
        ariaLabel: 'Add reservation to calendar',
        variant: 'outline',
        icon: 'Calendar',
        onClick: handleAddToCalendar,
        loading: calendarLoading,
        disabled: isLoading,
        role: 'support',
      },
      {
        id: 'confirmation-wallet',
        label: 'Add reservation to wallet',
        ariaLabel: 'Add reservation to wallet',
        variant: 'outline',
        icon: 'Wallet',
        onClick: handleAddToWallet,
        loading: walletLoading,
        disabled: isLoading,
        role: 'support',
      },
      {
        id: 'confirmation-new',
        label: 'Start a new booking',
        ariaLabel: 'Start a new booking',
        variant: 'default',
        icon: 'Plus',
        onClick: handleNewBooking,
        disabled: isLoading,
        role: 'primary',
      },
    ]);
  }, [
    calendarLoading,
    handleAddToCalendar,
    handleAddToWallet,
    handleClose,
    handleNewBooking,
    isLoading,
    onActionsChange,
    walletLoading,
  ]);

  return {
    booking,
    details,
    venue,
    status,
    isLoading,
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
