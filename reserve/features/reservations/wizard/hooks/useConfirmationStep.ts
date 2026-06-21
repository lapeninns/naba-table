'use client';

import { DateTime } from 'luxon';
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

import type { State, StepAction } from '../model/reducer';
import type {
  ConfirmationFeedback,
  ConfirmationStatus,
  ConfirmationStepController,
  ConfirmationStepProps,
} from '../ui/steps/confirmation-step/types';
import type { Dispatch, SetStateAction } from 'react';

export const buildReservationWindow = (state: State) => {
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

  const timezone =
    state.details.restaurantTimezone?.trim() ||
    reservationConfigResult.config.timezone ||
    DEFAULT_VENUE.timezone ||
    'UTC';
  const startDateTime = DateTime.fromISO(`${date}T${normalizedTime}:00`, {
    zone: timezone,
  });

  if (!startDateTime.isValid) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirmation-step] Unable to parse reservation start date.', {
        date,
        normalizedTime,
        timezone,
      });
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

  const endDateTime = startDateTime.plus({ minutes: safeDuration });
  const start = startDateTime.toUTC().toJSDate();
  const end = endDateTime.toUTC().toJSDate();

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
  mode = 'customer',
  onNewBooking,
  onClose,
  onActionsChange,
}: ConfirmationStepProps): ConfirmationStepController {
  const { errorReporter } = useWizardDependencies();
  const contextState = useWizardState();
  const state = providedState ?? contextState;
  if (!state) {
    throw new Error(
      'useConfirmationStep requires an explicit state prop or a WizardProvider ancestor.',
    );
  }
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

  const description = (() => {
    const emailText = details.email?.trim();
    const fallback = 'We will keep this page updated with the latest status.';
    if (status === 'pending') {
      return emailText
        ? `Your request has been received. We will email ${emailText} when it is confirmed.`
        : 'Your request has been received. We will confirm shortly.';
    }
    if (status === 'updated') {
      return emailText
        ? `Your reservation was updated. A confirmation email has been sent to ${emailText}.`
        : 'Your reservation was updated.';
    }
    return emailText ? `A confirmation email has been sent to ${emailText}.` : fallback;
  })();

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
    const actions: StepAction[] =
      mode === 'ops'
        ? [
            {
              id: 'confirmation-return',
              label: 'Back to bookings',
              ariaLabel: 'Back to bookings',
              variant: 'default',
              icon: 'ChevronLeft',
              onClick: handleClose,
              disabled: isLoading,
              role: 'primary',
            },
            {
              id: 'confirmation-new',
              label: 'Start a new booking',
              ariaLabel: 'Start a new booking',
              variant: 'outline',
              icon: 'Plus',
              onClick: handleNewBooking,
              disabled: isLoading,
              role: 'secondary',
            },
          ]
        : [
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
          ];

    onActionsChange(actions);
  }, [handleClose, handleNewBooking, isLoading, mode, onActionsChange]);

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
