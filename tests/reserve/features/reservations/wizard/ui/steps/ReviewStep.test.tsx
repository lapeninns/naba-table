import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import {
  getInitialState,
  type State,
  type StepAction,
} from '@features/reservations/wizard/model/reducer';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

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
      restaurantSlug: 'test-kitchen',
      restaurantName: 'Test Kitchen',
      date: '2026-04-14',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
      name: 'Taylor Test',
      email: 'taylor@example.test',
      phone: '07123456789',
      notes: 'A quiet table near the window, please.',
      whatsappOptIn: true,
      marketingOptIn: false,
    }),
    step: 3,
    ...overrides,
  };
}

function renderReviewStep(state = makeState()) {
  const actions = createActions();
  const published: { actions: StepAction[] } = { actions: [] };
  const onActionsChange = vi.fn((next: StepAction[]) => {
    published.actions = next;
  });

  render(
    <WizardDependenciesProvider value={{ analytics: { track: vi.fn() } }}>
      <WizardProvider state={state} actions={actions}>
        <ReviewStep onConfirm={vi.fn()} onActionsChange={onActionsChange} />
      </WizardProvider>
    </WizardDependenciesProvider>,
  );

  return { actions, published };
}

describe('ReviewStep', () => {
  it('renders the booking as two semantic, mobile-safe summary sections @contract', () => {
    renderReviewStep();

    const summary = screen.getByRole('article', { name: 'Booking summary' });
    expect(summary).toHaveAttribute('data-slot', 'review-summary');
    const visit = screen.getByRole('region', { name: 'Your visit' });
    expect(visit).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your details' })).toBeInTheDocument();
    expect(within(visit).getByText('19:00 on Apr 14 2026')).toBeVisible();
    expect(screen.getByText('Test Kitchen')).toBeVisible();
    expect(screen.getByText('4 guests')).toBeVisible();
    expect(screen.getByText('Dinner')).toBeVisible();
    expect(screen.getByText('Taylor Test')).toBeVisible();
    expect(screen.getByText('taylor@example.test')).toHaveClass('break-words');
    expect(screen.getByText('07123456789')).toBeVisible();
    expect(screen.getByText('Preferences')).toBeVisible();
    expect(screen.getByText('WhatsApp')).toBeVisible();
    expect(screen.getByText('Off')).toBeVisible();
    expect(
      screen.queryByText(
        'WhatsApp booking messages + one post-visit review request · SMS backup for booking messages',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/quiet table near the window/)).toHaveClass('break-words');
  });

  it('summarises messaging and marketing as short preference statuses @contract', () => {
    renderReviewStep(
      makeState({
        ...getInitialState({
          restaurantSlug: 'test-kitchen',
          restaurantName: 'Test Kitchen',
          date: '2026-04-14',
          time: '19:00',
          party: 2,
          bookingType: 'dinner',
          name: 'Alex Guest',
          email: 'alex@example.test',
          phone: '07999888777',
          whatsappOptIn: false,
          marketingOptIn: true,
        }),
        step: 3,
      }),
    );

    expect(screen.getByText('Preferences')).toBeVisible();
    expect(screen.getByText('SMS')).toBeVisible();
    expect(screen.getByText('On')).toBeVisible();
    expect(screen.queryByText('Subscribed')).not.toBeInTheDocument();
  });

  it('keeps both Edit controls at least 44px tall and routes them to the correct step @contract', async () => {
    const user = userEvent.setup();
    const { actions } = renderReviewStep();
    const editVisit = screen.getByRole('button', { name: 'Edit reservation details' });
    const editContact = screen.getByRole('button', { name: 'Edit guest details' });

    expect(editVisit).toHaveClass('min-h-11');
    expect(editContact).toHaveClass('min-h-11');

    await user.click(editVisit);
    await user.click(editContact);

    expect(actions.goToStep).toHaveBeenNthCalledWith(1, 1);
    expect(actions.goToStep).toHaveBeenNthCalledWith(2, 2);
  });

  it('publishes the unchanged pending confirmation semantics @contract', () => {
    const { published } = renderReviewStep(makeState({ submitting: true }));
    const confirm = published.actions.find((action) => action.id === 'review-confirm');

    expect(confirm).toMatchObject({
      label: 'Processing…',
      disabled: true,
      loading: true,
      role: 'primary',
    });
  });

  it('shows the mapped safe submission message instead of the underlying server detail @contract', () => {
    renderReviewStep(
      makeState({
        error: 'database connection string and internal stack detail',
        submissionError: {
          code: 'BOOKING_FAILED',
          message: 'We could not confirm this booking. Please try again.',
          alternatives: [],
          retryable: true,
          retryAfter: 30,
        },
      }),
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We could not confirm this booking. Please try again.');
    expect(alert).toHaveTextContent('Suggested retry window: 30 seconds.');
    expect(alert).not.toHaveTextContent('database connection string');
  });

  it('wraps 44px capacity alternatives and returns selection to Plan @contract', async () => {
    const user = userEvent.setup();
    const { actions } = renderReviewStep(
      makeState({
        error: 'No capacity available.',
        submissionError: {
          code: 'CAPACITY_EXCEEDED',
          message: 'That time is no longer available.',
          alternatives: [
            { time: '18:30', available: true, utilizationPercent: 72 },
            { time: '20:00', available: true, utilizationPercent: 61 },
          ],
          retryable: false,
          retryAfter: null,
        },
      }),
    );
    const alternatives = screen.getByRole('group', { name: 'Nearby availability' });
    const earlierSlot = screen.getByRole('button', { name: '18:30' });

    expect(alternatives).toHaveClass('flex-wrap');
    expect(earlierSlot).toHaveClass('min-h-11');
    await user.click(earlierSlot);

    expect(actions.updateDetails).toHaveBeenCalledWith('time', '18:30');
    expect(actions.setError).toHaveBeenCalledWith(null);
    expect(actions.setSubmissionError).toHaveBeenCalledWith(null);
    expect(actions.goToStep).toHaveBeenCalledWith(1);
  });
});
