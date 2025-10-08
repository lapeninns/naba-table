import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { wizardStateFixture } from '@/tests/fixtures/wizard';
import { PlanStepForm } from '@features/reservations/wizard/ui/steps/plan-step/PlanStepForm';

const MIN_DATE = new Date('2025-05-01T00:00:00Z');

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

    render(
      <PlanStepForm
        state={state}
        actions={{ updateDetails, goToStep }}
        onActionsChange={onActionsChange}
        onTrack={onTrack}
        minDate={MIN_DATE}
      />,
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
});
