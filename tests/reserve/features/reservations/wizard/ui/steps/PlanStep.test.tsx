import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { getTimeoutContactGuidance } from '@features/reservations/wizard/hooks/useReservationWizard';
import { getInitialState, type State } from '@features/reservations/wizard/model/reducer';
import { PlanStep } from '@features/reservations/wizard/ui/steps/PlanStep';

import type { WizardActions } from '@features/reservations/wizard/model/store';
import type { PlanStepFormProps } from '@features/reservations/wizard/ui/steps/plan-step/types';

// PlanStepForm has its own suite (react-query + schedule fetching); PlanStep's
// job is the timezone-aware minimum date, the alert channel, and the shell.
const planStepFormSpy = vi.hoisted(() => vi.fn());
vi.mock('@features/reservations/wizard/ui/steps/plan-step/PlanStepForm', () => ({
  PlanStepForm: (props: PlanStepFormProps) => {
    planStepFormSpy(props);
    return <p>plan-step-form-stub</p>;
  },
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

function makeState(overrides: Partial<State> = {}, timezone = 'Europe/London'): State {
  return {
    ...getInitialState({
      restaurantSlug: 'the-old-crown',
      restaurantTimezone: timezone,
      date: '2026-04-14',
      time: '19:00',
      party: 2,
      bookingType: 'dinner',
    }),
    ...overrides,
  };
}

function renderPlanStep(state: State, props: Partial<React.ComponentProps<typeof PlanStep>> = {}) {
  return render(
    <WizardProvider state={state} actions={createActions()}>
      <PlanStep onActionsChange={vi.fn()} {...props} />
    </WizardProvider>,
  );
}

beforeEach(() => {
  planStepFormSpy.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-04-10T23:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PlanStep', () => {
  it('renders the plan heading and the form @smoke', () => {
    renderPlanStep(makeState());

    expect(screen.getByRole('heading', { name: 'Plan your table' })).toBeInTheDocument();
    expect(screen.getByText('plan-step-form-stub')).toBeInTheDocument();
  });

  it("derives the minimum selectable date from the venue's timezone @contract", () => {
    // 2026-04-10T23:30Z is already 11 April in Kiritimati (UTC+14). The guest
    // must not be offered "today" in their own timezone but the venue's.
    renderPlanStep(makeState({}, 'Pacific/Kiritimati'));

    const props = planStepFormSpy.mock.calls[0]?.[0] as PlanStepFormProps;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Kiritimati',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const expected = formatter.format(new Date());
    const received = `${props.minDate.getFullYear()}-${String(props.minDate.getMonth() + 1).padStart(2, '0')}-${String(props.minDate.getDate()).padStart(2, '0')}`;
    expect(received).toBe(expected);
    expect(props.minDate.getHours()).toBe(0);
  });

  it('falls back to local midnight without a venue timezone @contract', () => {
    renderPlanStep(makeState({}, ''));

    const props = planStepFormSpy.mock.calls[0]?.[0] as PlanStepFormProps;
    const now = new Date();
    expect(props.minDate.getFullYear()).toBe(now.getFullYear());
    expect(props.minDate.getDate()).toBe(now.getDate());
    expect(props.minDate.getHours()).toBe(0);
  });

  it('shows the plan alert with priority over wizard errors @contract', () => {
    renderPlanStep(makeState({ error: 'wizard error' }), {
      planAlert: 'Reconnect to confirm; edits are saved locally.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Reconnect to confirm; edits are saved locally.',
    );
    expect(screen.queryByText('wizard error')).not.toBeInTheDocument();
  });

  it('falls back to the wizard error when no plan alert exists @contract', () => {
    renderPlanStep(makeState({ error: 'No capacity available for 19:00.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No capacity available for 19:00.');
  });

  it('renders no alert when the state is clean @contract', () => {
    renderPlanStep(makeState());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PlanStep timeout guidance', () => {
  it('renders the find-booking guidance as a real link scoped to the venue', () => {
    const guidance = getTimeoutContactGuidance({ email: 'guest@example.com' });
    expect(guidance.alert).not.toContain('/bookings/find');

    renderPlanStep(makeState(), { planAlert: guidance.alert });

    expect(screen.getByRole('link', { name: 'Request your booking link' })).toHaveAttribute(
      'href',
      '/bookings/find?restaurant=the-old-crown',
    );
  });

  it('keeps plain alerts as text', () => {
    renderPlanStep(makeState(), { planAlert: 'Draft expired—let’s refresh availability.' });
    expect(screen.getByText('Draft expired—let’s refresh availability.')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Request your booking link' }),
    ).not.toBeInTheDocument();
  });
});
