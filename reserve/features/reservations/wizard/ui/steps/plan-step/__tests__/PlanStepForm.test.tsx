import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { PlanStepForm } from '@features/reservations/wizard/ui/steps/plan-step/PlanStepForm';

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
  window: { opensAt: '12:00', closesAt: '22:00' },
  isClosed: false,
  slots: [
    {
      value: '12:00',
      display: '12:00',
      periodId: 'sp-lunch',
      periodName: 'Lunch',
      bookingOption: 'lunch',
      defaultBookingOption: 'lunch',
      availability: {
        services: { lunch: 'enabled', dinner: 'disabled', drinks: 'enabled' },
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
    const state = wizardStateFixture({
      date: '2025-05-15',
      time: '18:00',
      bookingType: 'lunch',
      party: 2,
    });

    const updateDetails = vi.fn();
    const goToStep = vi.fn();
    const onActionsChange = vi.fn();
    const onTrack = vi.fn();

    const wrapper = createWrapper();

    render(
      <PlanStepForm
        state={state}
        actions={{ updateDetails, goToStep }}
        onActionsChange={onActionsChange}
        onTrack={onTrack}
        minDate={MIN_DATE}
      />,
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
    expect(updateDetails).toHaveBeenCalledWith('time', '18:00');

    const drinksButton = await screen.findByText('Drinks & cocktails');
    await user.click(drinksButton);

    expect(updateDetails).toHaveBeenCalledWith('bookingType', 'drinks');
    expect(onTrack).toHaveBeenCalledWith(
      'select_time',
      expect.objectContaining({ booking_type: 'drinks' }),
    );

    const timeInput = screen.getByLabelText('Time');
    const callsBeforeManualTime = updateDetails.mock.calls.length;
    await user.clear(timeInput);
    await user.type(timeInput, '18:05');
    await user.tab();
    expect(timeInput).toHaveValue('18:00');
    expect(updateDetails.mock.calls.slice(callsBeforeManualTime)).toContainEqual(['time', '18:00']);
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
    getMock.mockResolvedValueOnce({
      ...scheduleFixture,
      date: '2025-05-11',
      isClosed: true,
      slots: [],
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
    getMock.mockResolvedValueOnce({
      ...scheduleFixture,
      date: '2025-05-12',
      isClosed: false,
      slots: scheduleFixture.slots.map((slot) => ({ ...slot, disabled: true })),
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
});
