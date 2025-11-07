import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { WizardProvider } from '@features/reservations/wizard/context/WizardContext';
import { PlanStepForm } from '@features/reservations/wizard/ui/steps/plan-step/PlanStepForm';

import type { WizardActions } from '@features/reservations/wizard/model/store';

const MIN_DATE = new Date('2025-05-01T00:00:00Z');

const getMock = vi.fn();

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}));

const scheduleFixture = {
  restaurantId: 'rest-1',
  date: '2025-05-15',
  timezone: 'Europe/London',
  intervalMinutes: 15,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 120,
  window: { opensAt: '12:00', closesAt: '22:00' },
  isClosed: false,
  availableBookingOptions: ['lunch', 'dinner', 'drinks'],
  occasionCatalog: [
    {
      key: 'lunch',
      label: 'Lunch',
      shortLabel: 'Lunch',
      description: null,
      availability: [],
      defaultDurationMinutes: 90,
      displayOrder: 10,
      isActive: true,
    },
    {
      key: 'dinner',
      label: 'Dinner',
      shortLabel: 'Dinner',
      description: null,
      availability: [],
      defaultDurationMinutes: 120,
      displayOrder: 20,
      isActive: true,
    },
    {
      key: 'drinks',
      label: 'Drinks & Cocktails',
      shortLabel: 'Drinks',
      description: 'Signature cocktails and bar snacks.',
      availability: [],
      defaultDurationMinutes: 75,
      displayOrder: 30,
      isActive: true,
    },
  ],
  slots: [
    {
      value: '12:00',
      display: '12:00',
      periodId: 'sp-lunch',
      periodName: 'Lunch',
      bookingOption: 'lunch',
      defaultBookingOption: 'lunch',
      availability: {
        services: { lunch: 'enabled', dinner: 'disabled', drinks: 'disabled' },
        labels: {
          happyHour: false,
          drinksOnly: false,
          kitchenClosed: false,
          lunchWindow: true,
          dinnerWindow: false,
        },
      },
      disabled: false,
    },
    {
      value: '20:00',
      display: '20:00',
      periodId: 'sp-dinner-late',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled', drinks: 'disabled' },
        labels: {
          happyHour: false,
          drinksOnly: false,
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    },
    {
      value: '18:00',
      display: '18:00',
      periodId: 'sp-dinner',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled', drinks: 'enabled' },
        labels: {
          happyHour: false,
          drinksOnly: false,
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    },
    {
      value: '21:00',
      display: '21:00',
      periodId: 'sp-drinks',
      periodName: 'Late drinks',
      bookingOption: 'drinks',
      defaultBookingOption: 'drinks',
      availability: {
        services: { lunch: 'disabled', dinner: 'disabled', drinks: 'enabled' },
        labels: {
          happyHour: false,
          drinksOnly: true,
          kitchenClosed: true,
          lunchWindow: false,
          dinnerWindow: false,
        },
      },
      disabled: false,
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue(scheduleFixture);
});

describe('<PlanStepForm />', () => {
  const setup = () => {
    const initialState = wizardStateFixture({
      date: '2025-05-15',
      time: '18:00',
      bookingType: 'lunch',
      party: 2,
    });

    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();
    const onTrack = vi.fn();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const ProviderWrapper = ({ children }: { children: React.ReactNode }) => {
      const [wizardState, setWizardState] = React.useState(initialState);

      const actions = React.useMemo<WizardActions>(() => {
        const noop = () => undefined;
        return {
          goToStep: (step) => {
            goToStep(step);
            setWizardState((prev) => ({ ...prev, step }));
          },
          updateDetails: (key, value) => {
            updateDetails(key, value);
            setWizardState((prev) => ({
              ...prev,
              details: {
                ...prev.details,
                [key]: value,
              },
            }));
          },
          setSubmitting: noop,
          setLoading: noop,
          setError: noop,
          clearError: noop,
          setBookings: noop,
          applyConfirmation: noop,
          startEdit: noop,
          resetForm: noop,
          hydrateContacts: noop,
          hydrateDetails: noop,
        } satisfies WizardActions;
      }, []);

      return (
        <WizardProvider state={wizardState} actions={actions}>
          {children}
        </WizardProvider>
      );
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ProviderWrapper>{children}</ProviderWrapper>
      </QueryClientProvider>
    );

    render(
      <PlanStepForm onActionsChange={onActionsChange} onTrack={onTrack} minDate={MIN_DATE} />,
      { wrapper },
    );

    return { updateDetails, goToStep, onActionsChange, onTrack };
  };

  it('updates party size and occasion via handlers', async () => {
    const { updateDetails, onTrack } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Increase guests' }));
    expect(updateDetails).toHaveBeenCalledWith('party', 3);

    await user.click(screen.getByRole('button', { name: /Time, occasion & notes/i }));
    await user.click(screen.getByRole('button', { name: /18:00, Dinner/i }));
    // The button click updates bookingType based on the time slot selected
    expect(updateDetails).toHaveBeenCalledWith('bookingType', 'dinner');

    const drinksButton = await screen.findByText('Drinks');
    await user.click(drinksButton);

    expect(updateDetails).toHaveBeenCalledWith('bookingType', 'drinks');
    expect(onTrack).toHaveBeenCalledWith(
      'select_time',
      expect.objectContaining({ booking_type: 'drinks' }),
    );

    const timeInput = screen.getByLabelText('Time');
    await user.clear(timeInput);
    await user.type(timeInput, '18:05');
    await user.tab();
    expect(timeInput).toHaveValue('18:00');
    // Time input updates the local state but doesn't trigger updateDetails
    // The update happens when clicking time slot buttons or submitting the form
  });

  it('normalizes manual times beyond the last seating buffer', async () => {
    setup();
    const user = userEvent.setup();
    const timeInput = screen.getByLabelText('Time');
    await waitFor(() => {
      const currentListId = timeInput.getAttribute('list');
      expect(currentListId).toBeTruthy();
      const dataList = document.getElementById(currentListId!);
      expect(dataList?.querySelector('option[value="20:00"]')).not.toBeNull();
    });

    await user.clear(timeInput);
    await user.type(timeInput, '21:30');
    await user.tab();

    expect(timeInput).toHaveValue('20:00');
  });

  it('submits and advances to the review step when continue action is invoked', async () => {
    const { onActionsChange, goToStep } = setup();

    let continueAction: { onClick?: () => void } | undefined;
    await waitFor(() => {
      const callWithEnabled = onActionsChange.mock.calls.find(([actions]) =>
        actions.some(
          (action: { id: string; disabled?: boolean }) =>
            action.id === 'plan-continue' && action.disabled === false,
        ),
      );
      expect(callWithEnabled).toBeTruthy();
      continueAction = callWithEnabled?.[0].find(
        (action: { id: string; disabled?: boolean }) =>
          action.id === 'plan-continue' && action.disabled === false,
      );
      expect(continueAction).toBeDefined();
    });

    await act(async () => {
      continueAction?.onClick?.();
    });

    await waitFor(() => {
      expect(goToStep).toHaveBeenCalledWith(2);
    });
  });

  it('disables time selection and surfaces an alert when the schedule is closed', async () => {
    getMock.mockReset();
    getMock.mockImplementation((path: string) => {
      if (path.includes('date=2025-05-11')) {
        return Promise.resolve({
          ...scheduleFixture,
          date: '2025-05-11',
          isClosed: true,
          availableBookingOptions: [],
          occasionCatalog: [],
          slots: [],
        });
      }
      return Promise.resolve(scheduleFixture);
    });

    const state = wizardStateFixture({
      date: '2025-05-11',
      time: '18:00',
    });
    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();
    const wrapper = createWrapper();

    render(
      <PlanStepForm
        state={state}
        actions={{ updateDetails, goToStep }}
        onActionsChange={onActionsChange}
        minDate={MIN_DATE}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(updateDetails).toHaveBeenCalledWith('time', '');
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/We’re closed on this date/i);

    await waitFor(() => {
      const timeInput = screen.getByLabelText('Time');
      expect(timeInput).toBeDisabled();
    });

    await waitFor(() => {
      const latestActions =
        onActionsChange.mock.calls[onActionsChange.mock.calls.length - 1]?.[0] ?? [];
      const continueAction = latestActions.find(
        (action: { id: string }) => action.id === 'plan-continue',
      );
      expect(continueAction?.disabled).toBe(true);
    });

    expect(updateDetails).toHaveBeenCalledWith('time', '');
  });

  it('disables time selection when all returned slots are unavailable', async () => {
    getMock.mockReset();
    getMock.mockImplementation((path: string) => {
      if (path.includes('date=2025-05-12')) {
        return Promise.resolve({
          ...scheduleFixture,
          date: '2025-05-12',
          isClosed: false,
          slots: scheduleFixture.slots.map((slot) => ({ ...slot, disabled: true })),
        });
      }
      return Promise.resolve(scheduleFixture);
    });

    const state = wizardStateFixture({
      date: '2025-05-12',
      time: '12:00',
    });
    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();
    const wrapper = createWrapper();

    render(
      <PlanStepForm
        state={state}
        actions={{ updateDetails, goToStep }}
        onActionsChange={onActionsChange}
        minDate={MIN_DATE}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(updateDetails).toHaveBeenCalledWith('time', '');
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/All reservation times are taken/i);

    expect(screen.getByLabelText('Time')).toBeDisabled();
    expect(updateDetails).toHaveBeenCalledWith('time', '');
  });

  it('does not re-emit sticky actions when props stay the same', async () => {
    const state = wizardStateFixture({
      date: '2025-05-15',
      time: '18:00',
      bookingType: 'lunch',
      party: 2,
    });
    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();
    const wrapper = createWrapper();

    const props = {
      state,
      actions: { updateDetails, goToStep },
      onActionsChange,
      minDate: MIN_DATE,
    };

    const { rerender } = render(<PlanStepForm {...props} />, { wrapper });

    await act(async () => {});
    const initialCalls = onActionsChange.mock.calls.length;

    rerender(<PlanStepForm {...props} />);
    await act(async () => {});

    expect(onActionsChange.mock.calls.length).toBe(initialCalls);
  });
});
