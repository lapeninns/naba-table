import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import {
  getInitialState,
  type State,
  type StepAction,
} from '@features/reservations/wizard/model/reducer';
import { DetailsStep } from '@features/reservations/wizard/ui/steps/DetailsStep';

import type { WizardActions } from '@features/reservations/wizard/model/store';
import type { DetailsStepProps } from '@features/reservations/wizard/ui/steps/details-step/types';

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

function makeState(details: Partial<State['details']> = {}): State {
  const state = {
    ...getInitialState({
      restaurantSlug: 'the-old-crown',
      restaurantName: 'The Old Crown',
      date: '2026-04-14',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '07123456789',
      agree: true,
      ...details,
    }),
    step: 2,
  } satisfies State;
  return {
    ...state,
    details: { ...state.details, agree: true, ...details },
  };
}

function renderDetailsStep(
  state: State,
  actions: WizardActions,
  props: Partial<DetailsStepProps> = {},
) {
  const captured: { actions: StepAction[] } = { actions: [] };
  const onActionsChange = vi.fn((next: StepAction[]) => {
    captured.actions = next;
  });
  const track = vi.fn();
  render(
    <WizardDependenciesProvider value={{ analytics: { track } }}>
      <WizardProvider state={state} actions={actions}>
        <DetailsStep onActionsChange={onActionsChange} {...props} />
      </WizardProvider>
    </WizardDependenciesProvider>,
  );
  return { captured, onActionsChange, track };
}

describe('DetailsStep', () => {
  it('renders the contact form prefilled from the wizard state @smoke', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.getByRole('heading', { name: 'Tell us how to reach you' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Alex Guest');
    expect(screen.getByLabelText(/Email address/)).toHaveValue('alex@example.com');
    expect(screen.getByLabelText(/UK phone number/)).toHaveValue('07123456789');
  });

  it('keeps fresh legal acceptance visible outside collapsed optional preferences @contract', () => {
    renderDetailsStep(makeState({ agree: false }), createActions());

    expect(
      screen.getByRole('checkbox', { name: /I agree to the terms and privacy notice/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: /I agree to the terms and privacy notice/ }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Preferences/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Save contact details for next time')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /I agree/ }).closest('label')).not.toHaveClass(
      'border-destructive/40',
    );
    expect(screen.getByRole('checkbox', { name: /I agree/ }).closest('label')).toHaveTextContent(
      /privacy notice Required to confirm/,
    );
  });

  it('uses destructive consent styling only after validation reports an error @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ agree: false }), createActions());

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /I agree/ }).closest('label')).toHaveClass(
        'border-destructive/40',
      ),
    );
  });

  it('places the concise usage caption with the contact fields instead of a separate card @contract', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.queryByText('Confirmation details')).not.toBeInTheDocument();
    const caption = screen.getByText(/We only use these details for this reservation/);
    const name = screen.getByLabelText(/Full name/);
    expect(caption.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('enables Review once the prefilled details validate, then advances @contract', async () => {
    const actions = createActions();
    const { captured, track } = renderDetailsStep(makeState(), actions);

    await waitFor(() => {
      const review = captured.actions.find((action) => action.id === 'details-review');
      expect(review?.disabled).toBe(false);
    });

    const review = captured.actions.find((action) => action.id === 'details-review');
    review?.onClick();

    await waitFor(() => expect(actions.goToStep).toHaveBeenCalledWith(3));
    expect(actions.updateDetails).toHaveBeenCalledWith('name', 'Alex Guest');
    expect(track).toHaveBeenCalledWith('details_submit', {
      marketing_opt_in: 0,
      terms_checked: 1,
    });
  });

  it('keeps Review disabled while the email is invalid @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ email: 'not-an-email' }), createActions());

    await waitFor(() => {
      const review = captured.actions.find((action) => action.id === 'details-review');
      expect(review?.disabled).toBe(true);
    });
  });

  it('surfaces the validation message when the guest types an invalid email @contract', async () => {
    const user = userEvent.setup();
    renderDetailsStep(makeState(), createActions());

    const email = screen.getByLabelText(/Email address/);
    await user.clear(email);
    await user.type(email, 'broken@');

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('routes the Back action to the plan step @contract', async () => {
    const actions = createActions();
    const { captured } = renderDetailsStep(makeState(), actions);

    await waitFor(() => expect(captured.actions.length).toBeGreaterThan(0));
    captured.actions.find((action) => action.id === 'details-back')?.onClick();

    expect(actions.goToStep).toHaveBeenCalledWith(1);
  });

  it('disables the WhatsApp opt-in until a phone number exists @contract', () => {
    renderDetailsStep(makeState({ phone: '' }), createActions());
    expect(screen.getByRole('checkbox', { name: /WhatsApp/ })).toBeDisabled();
    expect(
      screen.getByText('Add a valid UK phone number to enable WhatsApp updates.'),
    ).toBeVisible();
  });

  it('keeps WhatsApp disabled while a populated phone number is invalid @contract', () => {
    renderDetailsStep(makeState({ phone: '12345', whatsappOptIn: false }), createActions());

    expect(screen.getByRole('checkbox', { name: /WhatsApp/ })).toBeDisabled();
    expect(
      screen.getByText('Add a valid UK phone number to enable WhatsApp updates.'),
    ).toBeVisible();
  });

  it('explains customer requirements and why Review is unavailable @contract', async () => {
    const { captured } = renderDetailsStep(
      makeState({ name: '', email: '', phone: '', agree: false }),
      createActions(),
    );

    expect(screen.getByText('Required fields are marked *')).toBeVisible();
    expect(screen.getByText('Add at least one: email address or UK phone number.')).toBeVisible();
    expect(screen.getByLabelText(/Full name/)).toBeRequired();
    expect(screen.getByRole('checkbox', { name: /I agree/ })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(
      screen.getByText('Complete the required fields and accept the terms to review your booking.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(captured.actions.find((action) => action.id === 'details-review')?.disabled).toBe(
        true,
      ),
    );
  });

  it('uses Details-scoped minimum 44px interaction targets @contract', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.getByLabelText(/Full name/)).toHaveClass('h-11');
    expect(screen.getByLabelText(/Email address/)).toHaveClass('h-11');
    expect(screen.getByLabelText(/UK phone number/)).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: /Preferences/ })).toHaveClass('min-h-11');
    expect(screen.getByRole('checkbox', { name: /I agree/ }).closest('label')).toHaveClass(
      'min-h-11',
    );
  });

  it('locks contact fields the account already owns @contract', () => {
    renderDetailsStep(makeState(), createActions(), {
      contactLocks: { name: true, email: true },
    });

    expect(screen.getByLabelText(/Full name/)).toBeDisabled();
    expect(screen.getByLabelText(/Email address/)).toBeDisabled();
    expect(screen.getByLabelText(/UK phone number/)).toBeEnabled();
    expect(
      screen.getByText(
        'Email is linked to your account. Update it from your profile to change it.',
      ),
    ).toBeInTheDocument();
  });

  it('marks contacts optional and hides guest preferences in ops mode @contract', () => {
    renderDetailsStep(makeState({ email: '', phone: '07123456789' }), createActions(), {
      mode: 'ops',
    });

    expect(screen.getByText(/Email address \(optional\)/)).toBeInTheDocument();
    expect(
      screen.getByText('At least one contact method (email or phone) is required.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Preferences')).not.toBeInTheDocument();
  });
});
