'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { mapErrorToMessage } from '@reserve/shared/error';
import { useStickyProgress } from '@reserve/shared/hooks/useStickyProgress';
import { runtime } from '@shared/config/runtime';

import { useCreateReservation } from '../api/useCreateReservation';
import { useWizardDependencies } from '../di';
import { useRememberedContacts } from './useRememberedContacts';
import { createSelectionSummary } from '../model/selectors';
import { useWizardStore } from '../model/store';
import { buildReservationDraft, reservationToApiBooking } from '../model/transformers';

import type { StepAction } from '../model/reducer';

const EMPTY_ACTIONS: StepAction[] = [];

export function useReservationWizard() {
  const { state, actions } = useWizardStore();
  const heroRef = useRef<HTMLSpanElement | null>(null);
  const [stickyActions, setStickyActions] = useState<StepAction[]>(EMPTY_ACTIONS);
  const [stickyHeight, setStickyHeight] = useState(0);
  const { analytics, haptics, navigator, errorReporter } = useWizardDependencies();

  useRememberedContacts({ details: state.details, actions });

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
      if (
        prev.length === actions.length &&
        prev.every((action, index) => {
          const next = actions[index];
          return (
            action.id === next.id &&
            action.label === next.label &&
            action.variant === next.variant &&
            action.disabled === next.disabled &&
            action.loading === next.loading
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

  const mutation = useCreateReservation();
  const submitting = state.submitting || mutation.isPending;

  const handleConfirm = useCallback(async () => {
    const result = buildReservationDraft(state.details);
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

    actions.clearError();
    actions.setSubmitting(true);

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
        lastAction: submission.booking ? (state.editingId ? 'update' : 'create') : 'waitlist',
        waitlisted: submission.waitlisted,
        allocationPending: submission.allocationPending,
      });

      analytics.track('booking_created', {
        waitlisted: submission.waitlisted ? 1 : 0,
        allocation_pending: submission.allocationPending ? 1 : 0,
        party: draft.party,
        start_time: draft.time,
        reference: submission.booking?.reference ?? 'pending',
      });
    } catch (error) {
      errorReporter.capture(error, {
        scope: 'wizard.submitReservation',
        bookingId: state.editingId ?? undefined,
      });
      const message = mapErrorToMessage(error, 'Unable to process booking');
      actions.setError(message);
      actions.setSubmitting(false);
    }
  }, [actions, analytics, errorReporter, mutation, state.details, state.editingId]);

  const handleNewBooking = useCallback(() => {
    actions.clearError();
    actions.resetForm();
  }, [actions]);

  const handleClose = useCallback(() => {
    navigator.push('/thank-you');
  }, [navigator]);

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
  };
}
