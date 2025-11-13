'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emit } from '@/lib/analytics/emit';
import { BOOKING_IN_PAST_CUSTOMER_MESSAGE } from '@/lib/bookings/messages';
import { mapErrorToMessage } from '@reserve/shared/error';
import { useStickyProgress } from '@reserve/shared/hooks/useStickyProgress';
import { BOOKING_TYPES_UI, SEATING_PREFERENCES_UI } from '@shared/config/booking';
import { runtime } from '@shared/config/runtime';
import { DEFAULT_RESTAURANT_SLUG } from '@shared/config/venue';

import { useRememberedContacts } from './useRememberedContacts';
import { clearWizardDraft, loadWizardDraft, saveWizardDraft } from './useWizardDraftStorage';
import { fetchBookingsByContact } from '../api/fetchBookingsByContact';
import { useCreateOpsReservation } from '../api/useCreateOpsReservation';
import { useCreateReservation } from '../api/useCreateReservation';
import { useWizardDependencies } from '../di';
import { createSelectionSummary } from '../model/selectors';
import { useWizardStore } from '../model/store';
import { buildReservationDraft, reservationToApiBooking } from '../model/transformers';
import { recoverBookingAfterTimeout, type TimeoutRecoveryResult } from '../utils/timeoutRecovery';

import type { AnalyticsTracker } from '../di/types';
import type {
  BookingDetails,
  BookingWizardMode,
  ReservationDraft,
  StepAction,
} from '../model/reducer';

const EMPTY_ACTIONS: StepAction[] = [];

const DEFAULT_BOOKING_OPTION = BOOKING_TYPES_UI[0];
const DEFAULT_SEATING_OPTION = SEATING_PREFERENCES_UI[0];

const hasMeaningfulDraft = (details: BookingDetails): boolean => {
  return (
    Boolean(details.time?.trim()?.length) ||
    Boolean(details.notes?.trim()?.length) ||
    details.party > 1 ||
    details.bookingType !== DEFAULT_BOOKING_OPTION ||
    details.seating !== DEFAULT_SEATING_OPTION ||
    Boolean(details.name.trim().length) ||
    Boolean(details.email.trim().length) ||
    Boolean(details.phone.trim().length)
  );
};

const OFFLINE_QUEUE_MESSAGE = 'You’re offline. We’ll submit this booking as soon as you reconnect.';

type BookingError = { code?: string | number | null | undefined };

function isBookingInPastError(error: unknown): error is BookingError {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as BookingError).code;
  return code === 'BOOKING_IN_PAST';
}

const isRequestAbortedError = (error: unknown): error is { code?: string | number | null } => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: string | number | null | undefined }).code;
  return code === 'REQUEST_ABORTED';
};

const isTimeoutError = (error: unknown): error is { code?: string | number | null } => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: string | number | null | undefined }).code;
  return code === 'TIMEOUT';
};

const TIMEOUT_RECOVERY_ATTEMPTS = 3;
const TIMEOUT_RECOVERY_DELAY_MS = 2_000;

export function useReservationWizard(
  initialDetails?: Partial<BookingDetails>,
  mode: BookingWizardMode = 'customer',
) {
  const { state, actions } = useWizardStore(initialDetails);
  const draftHydratedRef = useRef(false);
  const offlineEventRef = useRef(false);
  const [planAlert, setPlanAlert] = useState<string | null>(null);
  const heroRef = useRef<HTMLSpanElement | null>(null);
  const [stickyActions, setStickyActions] = useState<StepAction[]>(EMPTY_ACTIONS);
  const [stickyHeight, setStickyHeight] = useState(0);
  const { analytics, haptics, navigator, errorReporter } = useWizardDependencies();

  useRememberedContacts({ details: state.details, actions, enabled: mode === 'customer' });

  const wizardRestaurantSlug = useMemo(
    () => initialDetails?.restaurantSlug ?? DEFAULT_RESTAURANT_SLUG ?? null,
    [initialDetails?.restaurantSlug],
  );

  useEffect(() => {
    if (draftHydratedRef.current || mode !== 'customer') {
      return;
    }
    if (initialDetails?.bookingId) {
      draftHydratedRef.current = true;
      return;
    }
    const stored = loadWizardDraft(wizardRestaurantSlug);
    draftHydratedRef.current = true;
    if (!stored) {
      return;
    }
    if (!hasMeaningfulDraft(stored.details)) {
      clearWizardDraft(wizardRestaurantSlug);
      return;
    }
    if (stored.slugMismatch) {
      clearWizardDraft(wizardRestaurantSlug);
      setPlanAlert('Switched restaurants—let’s refresh availability.');
      emit('wizard.reset.triggered', {
        reason: 'slug-mismatch',
        fromSlug: stored.slugMismatch.stored ?? null,
        toSlug: stored.slugMismatch.expected ?? wizardRestaurantSlug ?? null,
      });
      actions.resetForm();
      return;
    }
    if (stored.expired) {
      clearWizardDraft(wizardRestaurantSlug);
      setPlanAlert('Draft expired—let’s refresh availability.');
      emit('wizard.reset.triggered', { reason: 'draft-expired' });
      actions.resetForm();
      return;
    }
    actions.hydrateDetails(stored.details);
  }, [actions, initialDetails?.bookingId, mode, wizardRestaurantSlug]);

  const stepsMeta = useMemo(
    () => [
      { id: 1, label: 'Plan', helper: 'Pick date, time, and party' },
      { id: 2, label: 'Details', helper: 'Share contact information' },
      { id: 3, label: 'Review', helper: 'Double-check and confirm' },
      { id: 4, label: 'Confirmation', helper: 'Your reservation status' },
    ],
    [],
  );

  const { shouldShow: stickyVisible } = useStickyProgress(heroRef);

  const handleStickyHeightChange = useCallback((height: number) => {
    setStickyHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  }, []);

  const previousStepRef = useRef(state.step);
  useEffect(() => {
    if (previousStepRef.current !== state.step) {
      haptics.trigger();
      previousStepRef.current = state.step;
    }
  }, [haptics, state.step]);

  const previousVisibilityRef = useRef(stickyVisible);
  useEffect(() => {
    if (stickyVisible && !previousVisibilityRef.current) {
      haptics.trigger(5);
    }
    previousVisibilityRef.current = stickyVisible;
  }, [haptics, stickyVisible]);

  const handleActionsChange = useCallback((actions: StepAction[]) => {
    setStickyActions((prev) => {
      const isSameLength = prev.length === actions.length;
      if (
        isSameLength &&
        prev.every((action, index) => {
          const next = actions[index];
          if (!next) {
            return false;
          }
          return (
            action.id === next.id &&
            action.label === next.label &&
            action.variant === next.variant &&
            action.disabled === next.disabled &&
            action.loading === next.loading &&
            action.icon === next.icon &&
            action.ariaLabel === next.ariaLabel
            // `onClick` handlers are intentionally excluded because they are often
            // recreated between renders and would cause unnecessary state churn.
          );
        })
      ) {
        return prev;
      }
      if (runtime.isDev) {
        console.log('[reserve][sticky-actions] updating', { prev, next: actions });
      }
      return actions;
    });
  }, []);

  useEffect(() => {
    setStickyActions(EMPTY_ACTIONS);
  }, [state.step]);

  const selectionSummary = useMemo(() => createSelectionSummary(state.details), [state.details]);

  // effects depending on mutation are registered after mutation creation

  const customerMutation = useCreateReservation();
  const opsMutation = useCreateOpsReservation();
  const mutation = mode === 'ops' ? opsMutation : customerMutation;
  const submitting = state.submitting || mutation.isPending || mutation.isPaused;

  useEffect(() => {
    if (mode !== 'customer') {
      return;
    }
    if (mutation.isSuccess) {
      clearWizardDraft(state.details.restaurantSlug ?? wizardRestaurantSlug);
      return;
    }
    if (!hasMeaningfulDraft(state.details)) {
      clearWizardDraft(state.details.restaurantSlug ?? wizardRestaurantSlug);
      return;
    }
    saveWizardDraft(state.details);
  }, [mode, mutation.isSuccess, state.details, wizardRestaurantSlug]);

  useEffect(() => {
    if (mode !== 'customer') {
      return;
    }
    if (mutation.isPaused) {
      if (!offlineEventRef.current) {
        emit('mutation.retry.offline', {
          bookingId: state.details.bookingId,
        });
        offlineEventRef.current = true;
      }
      setPlanAlert((prev) => prev ?? OFFLINE_QUEUE_MESSAGE);
    } else {
      offlineEventRef.current = false;
      setPlanAlert((prev) => (prev === OFFLINE_QUEUE_MESSAGE ? null : prev));
    }
  }, [mode, mutation.isPaused, state.details.bookingId]);

  const handleConfirm = useCallback(async () => {
    if (submitting || state.loading) {
      return;
    }

    const result = buildReservationDraft(state.details, mode);
    if (!result.ok) {
      if ('error' in result) {
        errorReporter.capture(result.error, { scope: 'wizard.buildReservationDraft' });
      }
      const message = mapErrorToMessage(
        'error' in result ? result.error : null,
        'Unable to process booking',
      );
      actions.setError(message);
      return;
    }

    const draft = result.draft;
    const originStep = state.step;

    actions.clearError();
    setPlanAlert(null);
    actions.setLoading(true);
    actions.setSubmitting(true);
    actions.goToStep(4);

    try {
      const submission = await mutation.mutateAsync({
        draft,
        bookingId: state.editingId ?? undefined,
      });

      const bookings = submission.bookings.map(reservationToApiBooking);
      const booking = submission.booking ? reservationToApiBooking(submission.booking) : null;

      actions.applyConfirmation({
        bookings,
        booking,
        lastAction: submission.booking ? (state.editingId ? 'update' : 'create') : 'create',
      });

      analytics.track('booking_created', {
        party: draft.party,
        start_time: draft.time,
        reference: submission.booking?.reference ?? 'pending',
        context: mode,
        recovered: false,
      });
    } catch (error) {
      if (isRequestAbortedError(error)) {
        actions.setLoading(false);
        actions.setSubmitting(false);
        actions.goToStep(originStep);
        setPlanAlert(null);
        return;
      }
      if (isTimeoutError(error)) {
        emit('wizard.submit.timeout', {
          bookingId: state.editingId ?? null,
          context: mode,
        });
        setPlanAlert('Finalizing your booking… please keep this tab open while we complete it.');
        try {
          const recovery = await recoverBookingAfterTimeout({
            draft,
            fetchBookings: fetchBookingsByContact,
            attempts: TIMEOUT_RECOVERY_ATTEMPTS,
            delayMs: TIMEOUT_RECOVERY_DELAY_MS,
            logger: (lookupError) => {
              errorReporter.capture(lookupError, { scope: 'wizard.timeoutRecovery' });
            },
          });
          if (recovery) {
            hydrateRecoveredBooking({
              recovery,
              draft,
              applyConfirmation: actions.applyConfirmation,
              analytics,
              mode,
              lastAction: state.editingId ? 'update' : 'create',
            });
            actions.setLoading(false);
            actions.setSubmitting(false);
            setPlanAlert(null);
            emit('wizard.timeout.recovered', {
              bookingId: recovery.booking.id,
              context: mode,
            });
            return;
          }
        } catch (recoveryError) {
          errorReporter.capture(recoveryError, { scope: 'wizard.timeoutRecovery.unexpected' });
        }

        actions.setLoading(false);
        actions.setSubmitting(false);
        actions.goToStep(originStep);
        actions.setError(
          'We could not confirm the booking in time. Please check your email before trying again.',
        );
        setPlanAlert('If you received a confirmation email you are all set—otherwise retry now.');
        analytics.track('booking_timeout_unrecovered', {
          context: mode,
          party: draft.party,
          start_time: draft.time,
        });
        emit('wizard.timeout.unrecovered', {
          bookingId: state.editingId ?? null,
          context: mode,
        });
        return;
      }
      const isPastBooking = isBookingInPastError(error);
      if (!isPastBooking) {
        errorReporter.capture(error, {
          scope: 'wizard.submitReservation',
          bookingId: state.editingId ?? undefined,
        });
      }
      const fallbackMessage = mapErrorToMessage(error, 'Unable to process booking');
      const message = isPastBooking ? BOOKING_IN_PAST_CUSTOMER_MESSAGE : fallbackMessage;
      actions.setLoading(false);
      actions.setSubmitting(false);
      if (isPastBooking) {
        actions.goToStep(1);
        setPlanAlert(message);
        actions.setError(null);
      } else {
        actions.goToStep(originStep);
        actions.setError(message);
        setPlanAlert(null);
      }
    }
  }, [
    actions,
    analytics,
    errorReporter,
    mode,
    mutation,
    state.details,
    state.editingId,
    state.loading,
    state.step,
    submitting,
  ]);

  useEffect(() => {
    if (state.step !== 1 && planAlert) {
      setPlanAlert(null);
    }
  }, [planAlert, state.step]);

  const handleNewBooking = useCallback(() => {
    actions.clearError();
    actions.resetForm();
    setPlanAlert(null);
  }, [actions]);

  const handleClose = useCallback(() => {
    if (mode === 'ops') {
      navigator.push('/ops');
      return;
    }
    navigator.push('/thank-you');
    setPlanAlert(null);
  }, [mode, navigator]);

  return {
    state,
    actions,
    heroRef,
    stepsMeta,
    stickyVisible,
    stickyActions,
    stickyHeight,
    handleStickyHeightChange,
    handleActionsChange,
    selectionSummary,
    handleConfirm,
    handleNewBooking,
    handleClose,
    isSubmitting: submitting,
    mode,
    planAlert,
  };
}

type HydrateRecoveredBookingParams = {
  recovery: TimeoutRecoveryResult;
  draft: ReservationDraft;
  applyConfirmation: ReturnType<typeof useWizardStore>['actions']['applyConfirmation'];
  analytics: AnalyticsTracker;
  mode: BookingWizardMode;
  lastAction: 'create' | 'update';
};

function hydrateRecoveredBooking(params: HydrateRecoveredBookingParams) {
  const { recovery, draft, applyConfirmation, analytics, mode, lastAction } = params;
  const normalizedBookings = recovery.bookings.map(reservationToApiBooking);
  const normalizedBooking = reservationToApiBooking(recovery.booking);

  applyConfirmation({
    bookings: normalizedBookings,
    booking: normalizedBooking,
    lastAction,
  });

  analytics.track('booking_created', {
    party: draft.party,
    start_time: draft.time,
    reference: recovery.booking.reference ?? 'pending',
    context: mode,
    recovered: true,
  });
}
