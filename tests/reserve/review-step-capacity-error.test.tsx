import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { getInitialState, type State } from '@features/reservations/wizard/model/reducer';
import type { WizardActions } from '@features/reservations/wizard/model/store';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

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

function renderReviewStep(state: State, actions: WizardActions) {
  return render(
    <WizardDependenciesProvider
      value={{
        analytics: { track: vi.fn() },
        haptics: { trigger: vi.fn() },
        navigator: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
        errorReporter: { capture: vi.fn() },
      }}
    >
      <WizardProvider state={state} actions={actions}>
        <ReviewStep onConfirm={() => {}} onActionsChange={() => {}} />
      </WizardProvider>
    </WizardDependenciesProvider>,
  );
}

describe('ReviewStep capacity failures', () => {
  it('renders alternative slots and lets the guest switch to a suggested time', async () => {
    const user = userEvent.setup();
    const actions = createActions();
    const state: State = {
      ...getInitialState({
        restaurantName: 'The Old Crown',
        restaurantSlug: 'the-old-crown-girton',
        restaurantTimezone: 'Europe/London',
        restaurantAddress: '1 High Street',
        date: '2026-04-14',
        time: '19:00',
        party: 4,
        bookingType: 'dinner',
        name: 'Alex Guest',
        email: 'alex@example.com',
        phone: '07123456789',
      }),
      step: 3,
      error: 'No capacity available for 19:00.',
      submissionError: {
        code: 'CAPACITY_EXCEEDED',
        message: 'No capacity available for 19:00.',
        alternatives: [
          { time: '18:30', available: true, utilizationPercent: 72 },
          { time: '20:00', available: true, utilizationPercent: 61 },
        ],
        retryable: false,
        retryAfter: null,
      },
    };

    renderReviewStep(state, actions);

    expect(screen.getByText('Nearby availability')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '18:30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20:00' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '18:30' }));

    expect(actions.updateDetails).toHaveBeenCalledWith('time', '18:30');
    expect(actions.setError).toHaveBeenCalledWith(null);
    expect(actions.setSubmissionError).toHaveBeenCalledWith(null);
    expect(actions.goToStep).toHaveBeenCalledWith(1);
  });
});
