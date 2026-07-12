import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { useReviewStep } from '@features/reservations/wizard/hooks/useReviewStep';
import { getInitialState, type State, type StepAction } from '@features/reservations/wizard/model/reducer';

import type { WizardActions } from '@features/reservations/wizard/model/store';

function createActions(): WizardActions {
  return {
    goToStep: vi.fn(),
    updateDetails: vi.fn(),
    setSubmitting: vi.fn(),
    setLoading: vi.fn(),
    setError: vi.fn(),
    setSubmissionError: vi.fn(),
    clearError: vi.fn(),
    setBookings: vi.fn(),
    applyConfirmation: vi.fn(),
    startEdit: vi.fn(),
    resetForm: vi.fn(),
    hydrateContacts: vi.fn(),
    hydrateDetails: vi.fn(),
  };
}

function makeState(overrides: Partial<State> = {}): State {
  return {
    ...getInitialState({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
    }),
    step: 3,
    ...overrides,
  };
}

function renderReviewStep(state: State, actions: WizardActions, track = vi.fn()) {
  const onConfirm = vi.fn();
  const onActionsChange = vi.fn<(actions: StepAction[]) => void>();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WizardDependenciesProvider value={{ analytics: { track } }}>
      <WizardProvider state={state} actions={actions}>
        {children}
      </WizardProvider>
    </WizardDependenciesProvider>
  );
  const view = renderHook(() => useReviewStep({ onConfirm, onActionsChange }), { wrapper });
  return { ...view, onConfirm, onActionsChange, track };
}

describe('useReviewStep', () => {
  it('throws without a provider or explicit state @contract', () => {
    expect(() =>
      renderHook(() =>
        useReviewStep({ onConfirm: vi.fn(), onActionsChange: vi.fn() }),
      ),
    ).toThrow('useReviewStep requires an explicit state prop or a WizardProvider ancestor.');
  });

  it('summarizes the pending reservation @contract @smoke', () => {
    const { result } = renderReviewStep(makeState(), createActions());

    expect(result.current.summary).toEqual({
      summaryValue: '19:00 on Apr 14 2026',
      summaryDate: 'Apr 14 2026',
      summaryTime: '19:00',
      partyText: '4 guests',
    });
  });

  it('falls back to TBC placeholders when the plan is incomplete @contract', () => {
    const state = makeState();
    state.details.date = '';
    state.details.time = '';

    const { result } = renderReviewStep(state, createActions());

    expect(result.current.summary.summaryDate).toBe('TBC');
    expect(result.current.summary.summaryTime).toBe('TBC');
    expect(result.current.summary.summaryValue).toBe('4 guests');
  });

  it('tracks confirm_open with the plan payload @contract @observability', () => {
    const { track } = renderReviewStep(makeState(), createActions());

    expect(track).toHaveBeenCalledWith('confirm_open', {
      date: '2026-04-14',
      time: '19:00',
      party: 4,
    });
  });

  it('publishes edit and confirm actions, disabling confirm while submitting @contract', () => {
    const idle = renderReviewStep(makeState(), createActions());
    const idleActions = idle.onActionsChange.mock.lastCall?.[0] ?? [];
    expect(idleActions.map((action) => action.id)).toEqual(['review-edit', 'review-confirm']);
    expect(idleActions[1]?.label).toBe('Confirm booking');
    expect(idleActions[1]?.disabled).toBe(false);

    const submitting = renderReviewStep(makeState({ submitting: true }), createActions());
    const submittingActions = submitting.onActionsChange.mock.lastCall?.[0] ?? [];
    expect(submittingActions[1]?.label).toBe('Processing…');
    expect(submittingActions[1]?.disabled).toBe(true);
    expect(submittingActions[1]?.loading).toBe(true);
  });

  it('routes edit back to the plan step and confirm to onConfirm @contract', () => {
    const actions = createActions();
    const { result, onConfirm } = renderReviewStep(makeState(), actions);

    result.current.handleEdit();
    expect(actions.goToStep).toHaveBeenCalledWith(1);

    result.current.handleConfirm();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('switching to an alternative slot rewrites time, clears errors, and returns to plan @contract', () => {
    const actions = createActions();
    const { result } = renderReviewStep(makeState({ error: 'No capacity' }), actions);

    result.current.handleAlternativeSelect('18:30');

    expect(actions.updateDetails).toHaveBeenCalledWith('time', '18:30');
    expect(actions.setError).toHaveBeenCalledWith(null);
    expect(actions.setSubmissionError).toHaveBeenCalledWith(null);
    expect(actions.goToStep).toHaveBeenCalledWith(1);
  });
});
