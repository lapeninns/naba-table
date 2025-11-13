import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { DetailsStep } from '@features/reservations/wizard/ui/steps/DetailsStep';

import type { WizardActions } from '@features/reservations/wizard/model/store';

const createState = () => {
  const state = wizardStateFixture({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '07123456789',
    rememberDetails: true,
    marketingOptIn: true,
    agree: true,
  });
  state.step = 2;
  return state;
};

const createWizardActions = (overrides: Partial<WizardActions> = {}): WizardActions => ({
  goToStep: vi.fn(),
  updateDetails: vi.fn(),
  setSubmitting: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  setBookings: vi.fn(),
  applyConfirmation: vi.fn(),
  startEdit: vi.fn(),
  resetForm: vi.fn(),
  hydrateContacts: vi.fn(),
  hydrateDetails: vi.fn(),
  ...overrides,
});

describe('<DetailsStep /> analytics', () => {
  it('uses dependency-provided analytics tracker on submit', async () => {
    const track = vi.fn();
    const state = createState();
    const wizardActions = createWizardActions();
    const onActionsChange = vi.fn();

    render(
      <WizardDependenciesProvider value={{ analytics: { track } }}>
        <WizardProvider state={state} actions={wizardActions}>
          <DetailsStep
            state={state}
            actions={{
              updateDetails: wizardActions.updateDetails,
              goToStep: wizardActions.goToStep,
            }}
            onActionsChange={onActionsChange}
          />
        </WizardProvider>
      </WizardDependenciesProvider>,
    );

    const recordedActions = onActionsChange.mock.calls.at(-1)?.[0] ?? [];
    const reviewAction = recordedActions.find(
      (action: { id: string }) => action.id === 'details-review',
    );
    expect(reviewAction).toBeDefined();

    await act(async () => {
      await reviewAction?.onClick?.();
    });

    expect(track).toHaveBeenCalledWith(
      'details_submit',
      expect.objectContaining({ marketing_opt_in: 1, terms_checked: 1 }),
    );
  });
});
