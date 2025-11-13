import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

import type { WizardActions } from '@features/reservations/wizard/model/store';

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

describe('<ReviewStep /> analytics', () => {
  it('tracks confirm_open with dependency-provided analytics', () => {
    const track = vi.fn();
    const state = wizardStateFixture({
      date: '2025-05-10',
      time: '19:30',
      party: 3,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '07123456789',
    });
    state.step = 3;
    const actions = createWizardActions();

    render(
      <WizardDependenciesProvider value={{ analytics: { track } }}>
        <WizardProvider state={state} actions={actions}>
          <ReviewStep
            state={state}
            actions={{ goToStep: actions.goToStep }}
            onConfirm={vi.fn()}
            onActionsChange={vi.fn()}
          />
        </WizardProvider>
      </WizardDependenciesProvider>,
    );

    expect(track).toHaveBeenCalledWith(
      'confirm_open',
      expect.objectContaining({
        date: '2025-05-10',
        time: '19:30',
        party: 3,
      }),
    );
  });
});
