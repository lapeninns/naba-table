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
  const actions = providedActions ?? contextActions;
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
        ? `${details.party} at ${formatReservationTime(details.time)} on ${formatReservationSummaryDate(details.date)}`
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
    handleEdit,
    handleConfirm,
  };
}
