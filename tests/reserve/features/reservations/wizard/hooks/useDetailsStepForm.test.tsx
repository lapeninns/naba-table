import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { useDetailsStepForm } from '@features/reservations/wizard/hooks/useDetailsStepForm';
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

function makeState(overrides: Partial<State['details']> = {}): State {
  return {
    ...getInitialState({
      restaurantSlug: 'the-fox',
      date: '2026-04-14',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
      agree: true,
      ...overrides,
    }),
    step: 2,
  };
}

function renderDetailsForm(state: State, actions: WizardActions, onTrack = vi.fn()) {
  const onActionsChange = vi.fn<(actions: StepAction[]) => void>();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WizardProvider state={state} actions={actions}>
      {children}
    </WizardProvider>
  );
  const view = renderHook(() => useDetailsStepForm({ onActionsChange, onTrack }), { wrapper });
  return { ...view, onActionsChange, onTrack };
}

describe('useDetailsStepForm', () => {
  it('throws without a provider or explicit state/actions @contract', () => {
    expect(() =>
      renderHook(() => useDetailsStepForm({ onActionsChange: vi.fn(), onTrack: vi.fn() })),
    ).toThrow('useDetailsStepForm requires explicit state/actions props or a WizardProvider ancestor.');
  });

  it('seeds the form from the wizard state @contract @smoke', () => {
    const { result } = renderDetailsForm(makeState(), createActions());

    expect(result.current.form.getValues()).toMatchObject({
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
      agree: true,
    });
  });

  it('submitting valid details trims fields, tracks, and advances to review @contract', async () => {
    const actions = createActions();
    const { result, onTrack } = renderDetailsForm(makeState(), actions);

    await act(async () => {
      result.current.handleSubmit({
        name: '  Alex Guest  ',
        email: ' alex@example.com ',
        phone: ' +447123456789 ',
        rememberDetails: true,
        marketingOptIn: true,
        whatsappOptIn: false,
        agree: true,
      });
    });

    expect(actions.updateDetails).toHaveBeenCalledWith('name', 'Alex Guest');
    expect(actions.updateDetails).toHaveBeenCalledWith('email', 'alex@example.com');
    expect(actions.updateDetails).toHaveBeenCalledWith('phone', '+447123456789');
    expect(actions.updateDetails).toHaveBeenCalledWith('marketingOptIn', true);
    expect(onTrack).toHaveBeenCalledWith('details_submit', {
      marketing_opt_in: 1,
      terms_checked: 1,
    });
    expect(actions.goToStep).toHaveBeenCalledWith(3);
  });

  it('handleBack returns to the plan step @contract', () => {
    const actions = createActions();
    const { result } = renderDetailsForm(makeState(), actions);

    act(() => {
      result.current.handleBack();
    });

    expect(actions.goToStep).toHaveBeenCalledWith(1);
  });

  it('publishes back and review actions through onActionsChange @contract', () => {
    const { onActionsChange } = renderDetailsForm(makeState(), createActions());

    const published = onActionsChange.mock.lastCall?.[0] ?? [];
    expect(published.map((action) => action.id)).toEqual(['details-back', 'details-review']);
    expect(published[0]?.role).toBe('secondary');
    expect(published[1]?.role).toBe('primary');
  });

  it('changing the phone number revokes a granted WhatsApp opt-in @contract', async () => {
    const actions = createActions();
    const { result } = renderDetailsForm(makeState({ whatsappOptIn: true }), actions);

    await waitFor(() => expect(result.current.form.getValues('whatsappOptIn')).toBe(true));

    act(() => {
      result.current.handlers.changePhone('+447999999999');
    });

    expect(actions.updateDetails).toHaveBeenCalledWith('whatsappOptIn', false);
    expect(actions.updateDetails).toHaveBeenCalledWith('phone', '+447999999999');
    expect(result.current.form.getValues('whatsappOptIn')).toBe(false);
  });

  it('keeps the WhatsApp opt-in when the phone value is unchanged @contract', () => {
    const actions = createActions();
    const { result } = renderDetailsForm(makeState({ whatsappOptIn: true }), actions);

    act(() => {
      result.current.handlers.changePhone('+447123456789');
    });

    expect(actions.updateDetails).not.toHaveBeenCalledWith('whatsappOptIn', false);
    expect(actions.updateDetails).toHaveBeenCalledWith('phone', '+447123456789');
  });

  it('field handlers write through to the wizard state @contract', () => {
    const actions = createActions();
    const { result } = renderDetailsForm(makeState(), actions);

    act(() => {
      result.current.handlers.changeName('Sam');
      result.current.handlers.changeEmail('sam@example.com');
      result.current.handlers.toggleRemember(true);
      result.current.handlers.toggleMarketing(true);
      result.current.handlers.toggleAgree(false);
    });

    expect(actions.updateDetails).toHaveBeenCalledWith('name', 'Sam');
    expect(actions.updateDetails).toHaveBeenCalledWith('email', 'sam@example.com');
    expect(actions.updateDetails).toHaveBeenCalledWith('rememberDetails', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('marketingOptIn', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('agree', false);
  });
});
