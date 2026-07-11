import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanStepForm } from '@features/reservations/wizard/ui/steps/plan-step/PlanStepForm';

import type {
  PlanStepFormState,
  PlanStepUnavailableReason,
} from '@features/reservations/wizard/ui/steps/plan-step/types';

// usePlanStepForm owns schedule fetching and validation and is covered by the
// existing plan-step suites; here it is mocked so the form's rendering
// contract (fields, unavailability copy, advisories) can be pinned directly.
const harness = vi.hoisted(() => ({
  overrides: {} as Partial<PlanStepFormState>,
  handlers: {
    selectDate: vi.fn(),
    selectTime: vi.fn(),
    changeParty: vi.fn(),
    commitNotes: vi.fn(),
    prefetchMonth: vi.fn(),
  },
}));

vi.mock('@features/reservations/wizard/hooks/usePlanStepForm', async () => {
  const { useForm } = await import('react-hook-form');
  return {
    usePlanStepForm: (props: { minDate: Date }) => {
      const form = useForm({
        defaultValues: {
          date: '2026-04-14',
          time: '19:00',
          party: 2,
          bookingType: 'dinner',
          notes: '',
        },
      });
      const state: PlanStepFormState = {
        form: form as unknown as PlanStepFormState['form'],
        slots: [],
        handlers: harness.handlers,
        minDate: props.minDate,
        intervalMinutes: 30,
        unavailableDates: new Map<string, PlanStepUnavailableReason>(),
        loadingDates: new Set<string>(),
        hasAvailableSlots: true,
        isScheduleLoading: false,
        isScheduleFetching: false,
        schedule: null,
        currentUnavailabilityReason: null,
        advisoryMessage: null,
        isSubmitting: false,
        isValid: true,
        submitForm: vi.fn(),
        handleError: vi.fn(),
        ...harness.overrides,
      };
      return state;
    },
  };
});

const minDate = new Date(2026, 3, 10);

function renderForm() {
  return render(<PlanStepForm onActionsChange={vi.fn()} minDate={minDate} />);
}

beforeEach(() => {
  harness.overrides = {};
});

describe('PlanStepForm', () => {
  it('renders the party, date, time, and notes fields @smoke', () => {
    renderForm();

    expect(screen.getByText('Party size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Date/ })).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Add dietary, access, or occasion notes')).toBeInTheDocument();
  });

  it('routes party stepper interaction to the plan handlers @contract', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Increase guests' }));
    expect(harness.handlers.changeParty).toHaveBeenCalledWith('increment');
  });

  it('explains closed dates and disables the time field @contract', () => {
    harness.overrides = { currentUnavailabilityReason: 'closed' };
    renderForm();

    expect(
      screen.getAllByText('We are closed on this date. Please choose a different day.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Time')).toBeDisabled();
  });

  it('explains fully booked dates @contract', () => {
    harness.overrides = { currentUnavailabilityReason: 'no-slots' };
    renderForm();

    expect(
      screen.getAllByText(
        'All reservation times are taken on this date. Please choose a different day.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('shows the loading-availability fallback for unknown states @contract', () => {
    harness.overrides = { currentUnavailabilityReason: 'unknown' };
    renderForm();

    expect(
      screen.getAllByText(
        'Availability is still loading. Please try another date or retry in a moment.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('surfaces advisory messages from the schedule @contract', () => {
    harness.overrides = { advisoryMessage: 'Kitchen closes early on Sundays.' };
    renderForm();

    expect(screen.getByText('Kitchen closes early on Sundays.')).toBeInTheDocument();
  });
});
