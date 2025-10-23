import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useEffect, useMemo, useState } from 'react';

import { PlanStepForm } from './PlanStepForm';
import { getInitialState } from '../../../model/reducer';

import type { PlanStepFormProps } from './PlanStepForm';
import type { State, StepAction } from '../../../model/reducer';
import type { WizardActions } from '../../../model/store';
import type { Meta, StoryObj } from '@storybook/react';

const DEFAULT_MIN_DATE = new Date('2025-05-01T00:00:00');

const createSampleState = (): State => {
  const state = getInitialState();
  state.details.date = '2025-05-08';
  state.details.time = '';
  state.details.party = 2;
  state.details.bookingType = 'dinner';
  return state;
};

const cloneState = (state: State): State => ({
  ...state,
  bookings: [...state.bookings],
  details: { ...state.details },
  lastConfirmed: state.lastConfirmed ? { ...state.lastConfirmed } : null,
});

type StoryArgs = {
  initialState?: State;
} & Pick<PlanStepFormProps, 'minDate' | 'onTrack'>;

const PlanStepFormPreview: React.FC<StoryArgs> = ({ initialState, minDate, onTrack }) => {
  const [state, setState] = useState<State>(() => cloneState(initialState ?? createSampleState()));

  useEffect(() => {
    setState(cloneState(initialState ?? createSampleState()));
  }, [initialState]);

  const actions = useMemo<WizardActions>(() => {
    const updateDetails: WizardActions['updateDetails'] = (key, value) => {
      setState((prev) => ({
        ...prev,
        details: {
          ...prev.details,
          [key]: value,
        },
      }));
    };
    const goToStepMock = fn();
    const setSubmittingMock = fn();
    const setLoadingMock = fn();
    const setErrorMock = fn();
    const clearErrorMock = fn();
    const setBookingsMock = fn();
    const applyConfirmationMock = fn();
    const startEditMock = fn();
    const resetFormMock = fn();
    const hydrateContactsMock = fn();
    const hydrateDetailsMock = fn();
    return {
      goToStep: (step) => goToStepMock(step),
      updateDetails,
      setSubmitting: setSubmittingMock,
      setLoading: setLoadingMock,
      setError: setErrorMock,
      clearError: clearErrorMock,
      setBookings: setBookingsMock,
      applyConfirmation: applyConfirmationMock,
      startEdit: startEditMock,
      resetForm: resetFormMock,
      hydrateContacts: hydrateContactsMock,
      hydrateDetails: hydrateDetailsMock,
    } satisfies WizardActions;
  }, []);

  const actionsChange = useMemo(() => fn<(actions: StepAction[]) => void>(), []);

  return (
    <PlanStepForm
      state={state}
      actions={actions}
      minDate={minDate ?? DEFAULT_MIN_DATE}
      onTrack={onTrack ?? fn()}
      onActionsChange={actionsChange}
    />
  );
};

const meta = {
  title: 'Reserve/Wizard/PlanStep/PlanStepForm',
  component: PlanStepForm,
  parameters: {
    layout: 'centered',
  },
  render: (args: StoryArgs) => <PlanStepFormPreview {...args} />,
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  args: {
    initialState: createSampleState(),
    minDate: DEFAULT_MIN_DATE,
    onTrack: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const timeButton = await canvas.findByRole('button', { name: /12:00/i });
    await userEvent.click(timeButton);
    expect(args.onTrack).toHaveBeenCalled();
  },
};
