'use client';

import { useCallback, useEffect, useMemo } from 'react';

import {
  formatReservationSummaryDate,
  formatReservationTime,
} from '@reserve/shared/formatting/booking';

import { useWizardActions, useWizardState } from '../context/WizardContext';
import { useWizardDependencies } from '../di';

import type {
  ReviewStepProps,
  ReviewStepController,
  ReviewSummary,
} from '../ui/steps/review-step/types';

export function useReviewStep({
  state: providedState,
  actions: providedActions,
  onConfirm,
  onActionsChange,
}: ReviewStepProps): ReviewStepController {
  const contextState = useWizardState();
  const contextActions = useWizardActions();
  const state = providedState ?? contextState;
  if (!state) {
    throw new Error('useReviewStep requires an explicit state prop or a WizardProvider ancestor.');
  }
  const actions = useMemo(
    () => ({
      ...(contextActions ?? {}),
      ...(providedActions ?? {}),
    }),
    [contextActions, providedActions],
  );
  const details = state.details;
  const { analytics } = useWizardDependencies();

  useEffect(() => {
    if (details.date && details.time) {
      analytics.track('confirm_open', {
        date: details.date,
        time: details.time,
        party: details.party,
      });
    } else {
      analytics.track('confirm_open');
    }
  }, [analytics, details.date, details.party, details.time]);

  const summary: ReviewSummary = useMemo(() => {
    const summaryDate = details.date ? formatReservationSummaryDate(details.date) : 'TBC';
    const summaryTime = details.time ? formatReservationTime(details.time) : 'TBC';
    const partyText = `${details.party} ${details.party === 1 ? 'guest' : 'guests'}`;
    const summaryValue =
      details.date && details.time
        ? `${formatReservationTime(details.time)} on ${formatReservationSummaryDate(details.date)}`
        : partyText;

    return {
      summaryValue,
      summaryDate,
      summaryTime,
      partyText,
    };
  }, [details.date, details.party, details.time]);

  const handleEdit = useCallback(() => {
    actions.goToStep(1);
  }, [actions]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const handleAlternativeSelect = useCallback(
    (time: string) => {
      actions.updateDetails('time', time);
      actions.setError(null);
      actions.setSubmissionError(null);
      actions.goToStep(1);
    },
    [actions],
  );

  useEffect(() => {
    onActionsChange([
      {
        id: 'review-edit',
        label: 'Edit details',
        icon: 'Pencil',
        variant: 'outline',
        onClick: handleEdit,
        role: 'secondary',
      },
      {
        id: 'review-confirm',
        label: state.submitting ? 'Processing…' : 'Confirm booking',
        icon: state.submitting ? undefined : 'Check',
        variant: 'default',
        disabled: state.submitting,
        loading: state.submitting,
        onClick: handleConfirm,
        role: 'primary',
      },
    ]);
  }, [handleConfirm, handleEdit, onActionsChange, state.submitting]);

  return {
    details,
    summary,
    isSubmitting: state.submitting,
    error: state.error,
    submissionError: state.submissionError,
    handleEdit,
    handleConfirm,
    handleAlternativeSelect,
  };
}
