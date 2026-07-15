import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import {
  getInitialState,
  type ApiBooking,
  type State,
} from '@features/reservations/wizard/model/reducer';
import { ConfirmationStep } from '@features/reservations/wizard/ui/steps/ConfirmationStep';

import type { WizardActions } from '@features/reservations/wizard/model/store';

// The share module performs real anchor-click downloads; stub it. A warning
// result is used because success feedback is intentionally suppressed on the
// confirmed screen.
vi.mock('@/lib/reservations/share', () => ({
  downloadCalendarEvent: vi.fn(() => ({
    variant: 'warning' as const,
    message: 'Calendar file downloaded, but your browser may hide it.',
  })),
  shareReservationDetails: vi.fn(async () => ({
    variant: 'success' as const,
    message: 'Shared.',
  })),
}));

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

function makeBooking(overrides: Partial<ApiBooking> = {}): ApiBooking {
  return {
    id: 'booking-1',
    restaurant_id: 'rest-1',
    customer_id: 'cust-1',
    booking_date: '2026-04-14',
    start_time: '19:00:00',
    end_time: '20:30:00',
    reference: 'REF-4XK2',
    party_size: 4,
    booking_type: 'dinner',
    status: 'confirmed',
    customer_name: 'Alex Guest',
    customer_email: 'alex@example.com',
    customer_phone: '+447123456789',
    notes: null,
    source: 'api',
    marketing_opt_in: false,
    whatsapp_opt_in: false,
    loyalty_points_awarded: 0,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<State> = {}): State {
  const booking = overrides.lastConfirmed ?? makeBooking();
  return {
    ...getInitialState({
      restaurantName: 'The Old Crown',
      restaurantAddress: '1 High Street',
      restaurantTimezone: 'Europe/London',
      date: '2026-04-14',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
    }),
    step: 4,
    lastAction: 'create',
    lastConfirmed: booking,
    ...overrides,
  };
}

function renderConfirmation(state: State, mode: 'customer' | 'ops' = 'customer') {
  const onNewBooking = vi.fn();
  const onClose = vi.fn();
  const onActionsChange = vi.fn();
  render(
    <WizardDependenciesProvider value={{ analytics: { track: vi.fn() } }}>
      <WizardProvider state={state} actions={createActions()}>
        <ConfirmationStep
          mode={mode}
          onNewBooking={onNewBooking}
          onClose={onClose}
          onActionsChange={onActionsChange}
        />
      </WizardProvider>
    </WizardDependenciesProvider>,
  );
  return { onNewBooking, onClose, onActionsChange };
}

describe('ConfirmationStep', () => {
  it('confirms the booking with reference, guest, and schedule details @contract @smoke', () => {
    renderConfirmation(makeState());

    expect(screen.getByRole('heading', { name: 'Booking confirmed' })).toBeInTheDocument();
    expect(
      screen.getByText('A confirmation email has been sent to alex@example.com.'),
    ).toBeInTheDocument();
    expect(screen.getByText('REF-4XK2')).toBeInTheDocument();
    expect(screen.getByText('Alex Guest')).toBeInTheDocument();
    expect(screen.getByText('Apr 14 2026 · 19:00')).toBeInTheDocument();
    expect(screen.getByText('4 guests')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking reference' })).toHaveClass(
      'text-foreground',
    );
    expect(screen.getByRole('region', { name: 'Booking reference' })).toHaveAttribute(
      'data-confirmation-status',
      'confirmed',
    );
    // Confirmed bookings expose calendar/directions actions.
    expect(screen.getByRole('button', { name: /Add to Calendar/ })).toBeInTheDocument();
  });

  it('places the booking reference before visit actions @contract', () => {
    renderConfirmation(makeState());

    const reference = screen.getByRole('region', { name: 'Booking reference' });
    const actions = screen.getByRole('region', { name: 'Booking actions' });

    expect(reference.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps the final management note clear of the fixed action rail @contract', () => {
    renderConfirmation(makeState());

    expect(screen.getByText(/Need to make changes/)).toHaveClass('scroll-mb-48', 'sm:scroll-mb-32');
  });

  it('reports a pending booking without confirmation actions @contract', () => {
    renderConfirmation(makeState({ lastConfirmed: makeBooking({ status: 'pending' }) }));

    expect(screen.getByRole('heading', { name: 'Booking pending' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your request has been received. We will email alex@example.com when it is confirmed.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Booking reference' })).toHaveAttribute(
      'data-confirmation-status',
      'pending',
    );
    expect(screen.queryByRole('button', { name: /Add to Calendar/ })).not.toBeInTheDocument();
  });

  it('describes an updated booking after an edit @contract', () => {
    renderConfirmation(makeState({ lastAction: 'update' }));

    expect(screen.getByRole('heading', { name: 'Booking updated' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your reservation was updated. A confirmation email has been sent to alex@example.com.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Booking reference' })).toHaveAttribute(
      'data-confirmation-status',
      'updated',
    );
  });

  it('publishes a new-booking primary action for guests @contract', () => {
    const { onActionsChange, onNewBooking } = renderConfirmation(makeState());

    const actions = onActionsChange.mock.lastCall?.[0] ?? [];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.id).toBe('confirmation-new');
    expect(actions[0]?.role).toBe('primary');

    actions[0]?.onClick();
    expect(onNewBooking).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/thank-you/i)).not.toBeInTheDocument();
  });

  it('publishes return-to-bookings first for ops users @contract', () => {
    const { onActionsChange, onClose } = renderConfirmation(makeState(), 'ops');

    const actions = onActionsChange.mock.lastCall?.[0] ?? [];
    expect(actions.map((action: { id: string }) => action.id)).toEqual([
      'confirmation-return',
      'confirmation-new',
    ]);

    actions[0]?.onClick();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('surfaces dismissible feedback from the calendar download @contract', async () => {
    const user = userEvent.setup();
    renderConfirmation(makeState());

    await user.click(screen.getByRole('button', { name: /Add to Calendar/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Download .ICS File/ }));

    expect(
      await screen.findByText('Calendar file downloaded, but your browser may hide it.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(
      screen.queryByText('Calendar file downloaded, but your browser may hide it.'),
    ).not.toBeInTheDocument();
  });
});
