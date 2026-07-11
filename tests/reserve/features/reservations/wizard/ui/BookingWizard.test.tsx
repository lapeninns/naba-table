import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getInitialState, type State, type StepAction } from '@features/reservations/wizard/model/reducer';
import { BookingWizard } from '@features/reservations/wizard/ui/BookingWizard';

import type { WizardActions } from '@features/reservations/wizard/model/store';

// The orchestration hook and the step bodies have dedicated suites; this suite
// pins BookingWizard's routing: step switching, skeletons, and offline mode.
const harness = vi.hoisted(() => ({
  wizard: null as null | (() => Record<string, unknown>),
  online: true,
  planProps: vi.fn(),
  reviewProps: vi.fn(),
}));

vi.mock('@features/reservations/wizard/hooks/useReservationWizard', () => ({
  useReservationWizard: () => harness.wizard?.(),
}));
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => harness.online,
}));
vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => ({ user: null, session: null, status: 'unauthenticated' }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ data: undefined }),
}));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

vi.mock('@features/reservations/wizard/ui/steps/PlanStep', () => ({
  PlanStep: (props: Record<string, unknown>) => {
    harness.planProps(props);
    return <p>plan-step-stub</p>;
  },
}));
vi.mock('@features/reservations/wizard/ui/steps/DetailsStep', () => ({
  DetailsStep: () => <p>details-step-stub</p>,
}));
vi.mock('@features/reservations/wizard/ui/steps/ReviewStep', () => ({
  ReviewStep: (props: Record<string, unknown>) => {
    harness.reviewProps(props);
    return <p>review-step-stub</p>;
  },
}));
vi.mock('@features/reservations/wizard/ui/steps/ConfirmationStep', () => ({
  ConfirmationStep: () => <p>confirmation-step-stub</p>,
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

function makeState(overrides: Partial<State> = {}): State {
  return {
    ...getInitialState({
      restaurantName: 'The Old Crown',
      restaurantSlug: 'the-old-crown',
      date: '2026-04-14',
      time: '19:00',
      party: 4,
      bookingType: 'dinner',
    }),
    ...overrides,
  };
}

const stickyActions: StepAction[] = [
  { id: 'primary-cta', label: 'Continue', onClick: () => {}, role: 'primary' },
  { id: 'secondary-cta', label: 'Back', onClick: () => {}, role: 'secondary' },
];

function installWizard(state: State) {
  const handleConfirm = vi.fn();
  harness.wizard = () => ({
    state,
    actions: createActions(),
    heroRef: { current: null },
    stepsMeta: [
      { id: 1, label: 'Plan' },
      { id: 2, label: 'Details' },
      { id: 3, label: 'Review' },
      { id: 4, label: 'Done' },
    ],
    stickyVisible: true,
    stickyActions,
    stickyHeight: 64,
    handleStickyHeightChange: vi.fn(),
    handleActionsChange: vi.fn(),
    selectionSummary: { primary: 'Dinner', details: ['4 guests', '19:00'] },
    handleConfirm,
    handleNewBooking: vi.fn(),
    handleClose: vi.fn(),
    planAlert: null,
  });
  return { handleConfirm };
}

beforeEach(() => {
  harness.online = true;
  harness.wizard = null;
  harness.planProps.mockClear();
  harness.reviewProps.mockClear();
  // WizardNavigation reads matchMedia; the setup-file mock is emptied by
  // mockReset between tests, so install a plain stub.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('BookingWizard step routing', () => {
  it('renders the plan step for step 1 with the venue header @contract @smoke', async () => {
    installWizard(makeState({ step: 1 }));
    render(<BookingWizard />);

    expect(await screen.findByText('plan-step-stub')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'The Old Crown' })).toBeInTheDocument();
  });

  it('renders details, review, and confirmation for their steps @contract', async () => {
    installWizard(makeState({ step: 2 }));
    const second = render(<BookingWizard />);
    expect(await second.findByText('details-step-stub')).toBeInTheDocument();
    second.unmount();

    const { handleConfirm } = installWizard(makeState({ step: 3 }));
    const third = render(<BookingWizard />);
    expect(await third.findByText('review-step-stub')).toBeInTheDocument();
    const reviewProps = harness.reviewProps.mock.calls[0]?.[0] as { onConfirm: () => void };
    reviewProps.onConfirm();
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    third.unmount();

    installWizard(makeState({ step: 4 }));
    render(<BookingWizard />);
    expect(await screen.findByText('confirmation-step-stub')).toBeInTheDocument();
  });

  it('swaps the step for a skeleton while loading @contract', () => {
    installWizard(makeState({ step: 1, loading: true }));
    const { container } = render(<BookingWizard />);

    expect(screen.queryByText('plan-step-stub')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe('BookingWizard offline handling', () => {
  it('shows the offline banner and disables primary actions @contract', async () => {
    harness.online = false;
    installWizard(makeState({ step: 1 }));
    render(<BookingWizard />);

    expect(await screen.findByRole('status')).toHaveTextContent('You’re offline');
    expect(
      screen.getByText('You’re offline. You can edit details, but confirming requires a connection.'),
    ).toBeInTheDocument();

    const primary = await screen.findByRole('button', { name: /Continue/ });
    expect(primary).toBeDisabled();
    const secondary = screen.getByRole('button', { name: /Back/ });
    expect(secondary).toBeEnabled();
  });

  it('passes an offline plan alert into the plan step @contract', async () => {
    harness.online = false;
    installWizard(makeState({ step: 1 }));
    render(<BookingWizard />);

    await screen.findByText('plan-step-stub');
    const planProps = harness.planProps.mock.calls[0]?.[0] as { planAlert: string | null };
    expect(planProps.planAlert).toBe('Reconnect to confirm; edits are saved locally.');
  });

  it('keeps actions enabled and hides the banner while online @contract', async () => {
    installWizard(makeState({ step: 1 }));
    render(<BookingWizard />);

    await screen.findByText('plan-step-stub');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue/ })).toBeEnabled();

    const planProps = harness.planProps.mock.calls[0]?.[0] as { planAlert: string | null };
    expect(planProps.planAlert).toBeNull();
  });
});
