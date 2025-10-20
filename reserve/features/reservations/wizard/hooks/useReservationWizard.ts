'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BOOKING_IN_PAST_CUSTOMER_MESSAGE } from '@/lib/bookings/messages';
import { mapErrorToMessage } from '@reserve/shared/error';
import { useStickyProgress } from '@reserve/shared/hooks/useStickyProgress';
import { runtime } from '@shared/config/runtime';

import { useRememberedContacts } from './useRememberedContacts';
import { useCreateOpsReservation } from '../api/useCreateOpsReservation';
import { useCreateReservation } from '../api/useCreateReservation';
import { useWizardDependencies } from '../di';
import { createSelectionSummary } from '../model/selectors';
import { useWizardStore } from '../model/store';
import { buildReservationDraft, reservationToApiBooking } from '../model/transformers';

import type { BookingDetails, BookingWizardMode, StepAction } from '../model/reducer';

const EMPTY_ACTIONS: StepAction[] = [];

type BookingError = { code?: string | number | null | undefined };

function isBookingInPastError(error: unknown): error is BookingError {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as BookingError).code;
  return code === 'BOOKING_IN_PAST';
}

export function useReservationWizard(
  initialDetails?: Partial<BookingDetails>,
  mode: BookingWizardMode = 'customer',
) {
  const { state, actions } = useWizardStore(initialDetails);
  const [planAlert, setPlanAlert] = useState<string | null>(null);
  const heroRef = useRef<HTMLSpanElement | null>(null);
  const [stickyActions, setStickyActions] = useState<StepAction[]>(EMPTY_ACTIONS);
  const [stickyHeight, setStickyHeight] = useState(0);
  const { analytics, haptics, navigator, errorReporter } = useWizardDependencies();

  useRememberedContacts({ details: state.details, actions, enabled: mode === 'customer' });

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
            action.ariaLabel === next.ariaLabel &&
            action.onClick === next.onClick
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

  const customerMutation = useCreateReservation();
  const opsMutation = useCreateOpsReservation();
  const mutation = mode === 'ops' ? opsMutation : customerMutation;
  const submitting = state.submitting || mutation.isPending;

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
      });
    } catch (error) {
      errorReporter.capture(error, {
        scope: 'wizard.submitReservation',
        bookingId: state.editingId ?? undefined,
      });
      const fallbackMessage = mapErrorToMessage(error, 'Unable to process booking');
      const isPastBooking = isBookingInPastError(error);
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
