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
  it('keeps only contact details inline for guests @contract', () => {
    renderDetailsStep(makeState(), createActions());

    const form = document.querySelector('[data-slot="details-form"]');
    const contact = screen.getByRole('region', { name: 'Contact details' });

    expect(form).toHaveClass('mx-auto', 'w-full', 'max-w-2xl');
    expect(form?.querySelectorAll('[data-slot="wizard-panel"]')).toHaveLength(1);
    expect(contact).toHaveClass('min-w-0');
    expect(screen.queryByRole('region', { name: 'Booking consent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preferences' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('replaces the characterized booking-only WhatsApp consent copy @contract', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.queryByText('Use WhatsApp for my booking updates')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'You confirm this number uses WhatsApp and agree to receive booking messages from Nabatable on behalf of The Old Crown. If WhatsApp is unavailable, we’ll send an SMS instead.',
      ),
    ).not.toBeInTheDocument();
  });

  it('summarises WhatsApp without exposing the detailed lifecycle copy by default @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ agree: false }), createActions());

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();

    expect(await screen.findByText('Booking messages')).toBeVisible();
    expect(screen.getByText(/WhatsApp when available/)).toBeVisible();
    expect(screen.queryByText('Booking confirmation and updates')).not.toBeInTheDocument();
    expect(screen.queryByText('Guest or venue cancellations')).not.toBeInTheDocument();
    expect(screen.queryByText('One post-visit review request')).not.toBeInTheDocument();
  });

  it('defaults WhatsApp and marketing on for staff-created bookings without a consent checkbox @contract', async () => {
    const actions = createActions();
    const { captured } = renderDetailsStep(
      makeState({
        marketingOptIn: false,
        whatsappOptIn: false,
        agree: false,
      }),
      actions,
      { mode: 'ops' },
    );

    expect(
      screen.queryByRole('checkbox', {
        name: /Guest agreed to WhatsApp booking messages and one review request/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /the guest agrees to receive these messages from Nabatable on behalf of The Old Crown/,
      ),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();

    await waitFor(() => expect(actions.goToStep).toHaveBeenCalledWith(3));
    expect(actions.updateDetails).toHaveBeenCalledWith('marketingOptIn', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('whatsappOptIn', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('agree', true);
  });

  it('renders the contact form prefilled from the wizard state @smoke', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.getByRole('heading', { name: 'Tell us how to reach you' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Alex Guest');
    expect(screen.getByLabelText(/Email address/)).toHaveValue('alex@example.com');
    expect(screen.getByLabelText(/UK phone number/)).toHaveValue('07123456789');
  });

  it('keeps individual consent controls hidden until preferences are expanded @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ agree: false }), createActions());

    expect(
      screen.queryByRole('checkbox', { name: /I agree to the terms and privacy notice/ }),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();

    expect(
      await screen.findByRole('button', { name: 'Accept all & review booking' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: /I agree to the terms and privacy notice/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose preferences' }));
    expect(screen.getByRole('checkbox', { name: /Terms & privacy/ })).toBeVisible();
  });

  it('accepts every eligible preference and advances in one click @contract', async () => {
    const actions = createActions();
    const { captured } = renderDetailsStep(
      makeState({
        agree: false,
        rememberDetails: false,
        marketingOptIn: false,
        whatsappOptIn: false,
      }),
      actions,
    );

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Accept all & review booking' }),
    );

    await waitFor(() => expect(actions.goToStep).toHaveBeenCalledWith(3));
    expect(actions.updateDetails).toHaveBeenCalledWith('agree', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('whatsappOptIn', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('rememberDetails', true);
    expect(actions.updateDetails).toHaveBeenCalledWith('marketingOptIn', true);
  });

  it('keeps the overlay open and reports terms validation on confirm @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ agree: false }), createActions());

    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();
    await userEvent.click(await screen.findByRole('button', { name: 'Choose preferences' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue with my choices' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please accept the terms to continue.',
    );
    expect(screen.getByRole('heading', { name: 'One last step' })).toBeVisible();
  });

  it('places the concise usage caption with the contact fields instead of a separate card @contract', () => {
    renderDetailsStep(makeState(), createActions());

    expect(screen.queryByText('Confirmation details')).not.toBeInTheDocument();
    const caption = screen.getByText(/We only use these details for this reservation/);
    const name = screen.getByLabelText(/Full name/);
    expect(caption.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens consent and advances only after overlay confirmation @contract', async () => {
    const actions = createActions();
    const { captured, track } = renderDetailsStep(makeState(), actions);

    await waitFor(() => {
      const review = captured.actions.find((action) => action.id === 'details-review');
      expect(review?.disabled).toBe(false);
    });

    const review = captured.actions.find((action) => action.id === 'details-review');
    review?.onClick();

    expect(await screen.findByRole('heading', { name: 'One last step' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Accept all & review booking' }));

    await waitFor(() => expect(actions.goToStep).toHaveBeenCalledWith(3));
    expect(actions.updateDetails).toHaveBeenCalledWith('name', 'Alex Guest');
    expect(track).toHaveBeenCalledWith('details_submit', {
      marketing_opt_in: 1,
      terms_checked: 1,
    });
  });

  it.each([
    ['email only', { email: 'alex@example.com', phone: '' }],
    ['phone only', { email: '', phone: '07123456789' }],
  ])('keeps Review available with %s @contract', async (_scenario, details) => {
    const { captured } = renderDetailsStep(
      makeState({ ...details, agree: false }),
      createActions(),
    );

    await waitFor(() => {
      expect(captured.actions.find((action) => action.id === 'details-review')?.disabled).toBe(
        false,
      );
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

  it('disables the overlay WhatsApp opt-in until a phone number exists @contract', async () => {
    const { captured } = renderDetailsStep(makeState({ phone: '', agree: false }), createActions());
    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();
    await userEvent.click(await screen.findByRole('button', { name: 'Choose preferences' }));
    expect(await screen.findByRole('checkbox', { name: /Booking messages/ })).toBeDisabled();
    expect(screen.getByText('Add a UK phone number to use WhatsApp')).toBeVisible();
  });

  it('keeps Review disabled while a populated phone number is invalid @contract', async () => {
    const { captured } = renderDetailsStep(
      makeState({ email: 'alex@example.com', phone: '12345', whatsappOptIn: false, agree: false }),
      createActions(),
    );

    await waitFor(() =>
      expect(captured.actions.find((action) => action.id === 'details-review')?.disabled).toBe(
        true,
      ),
    );
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('clears consent state when the phone number changes @contract', async () => {
    const user = userEvent.setup();
    const actions = createActions();
    renderDetailsStep(makeState({ whatsappOptIn: true }), actions);

    await user.type(screen.getByLabelText(/UK phone number/), '0');

    expect(actions.updateDetails).toHaveBeenCalledWith('whatsappOptIn', false);
  });

  it('explains contact requirements without mentioning terms before the overlay @contract', async () => {
    const { captured } = renderDetailsStep(
      makeState({ name: '', email: '', phone: '', agree: false }),
      createActions(),
    );

    expect(screen.getByText('Required fields are marked *')).toBeVisible();
    expect(screen.getByText('Add at least one: email address or UK phone number.')).toBeVisible();
    expect(screen.getByLabelText(/Full name/)).toBeRequired();
    expect(
      screen.getByText('Complete the required contact fields to review your booking.'),
    ).toBeVisible();
    await waitFor(() =>
      expect(captured.actions.find((action) => action.id === 'details-review')?.disabled).toBe(
        true,
      ),
    );
  });

  it('uses Details-scoped minimum 44px interaction targets @contract', async () => {
    const { captured } = renderDetailsStep(makeState(), createActions());

    expect(screen.getByLabelText(/Full name/)).toHaveClass('h-11');
    expect(screen.getByLabelText(/Email address/)).toHaveClass('h-11');
    expect(screen.getByLabelText(/UK phone number/)).toHaveClass('h-11');
    await waitFor(() => expect(captured.actions).not.toHaveLength(0));
    captured.actions.find((action) => action.id === 'details-review')?.onClick();
    await screen.findByRole('heading', { name: 'One last step' });
    await userEvent.click(screen.getByRole('button', { name: 'Choose preferences' }));
    expect(screen.getByRole('checkbox', { name: /Terms & privacy/ }).closest('label')).toHaveClass(
      'min-h-11',
    );
    expect(screen.getByRole('checkbox', { name: /Booking messages/ }).closest('label')).toHaveClass(
      'min-h-11',
    );
    expect(screen.getByRole('link', { name: 'privacy notice' })).toHaveClass('min-h-11');
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
