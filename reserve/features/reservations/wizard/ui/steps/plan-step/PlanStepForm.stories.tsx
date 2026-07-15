import { expect, fn, userEvent, within } from '@storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';

import { PlanStepForm } from './PlanStepForm';
import { WizardProvider } from '../../../context/WizardContext';
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
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    [],
  );

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
    const setSubmissionErrorMock = fn();
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
      setSubmissionError: setSubmissionErrorMock,
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
    <QueryClientProvider client={queryClient}>
      <WizardProvider state={state} actions={actions}>
        <PlanStepForm
          minDate={minDate ?? DEFAULT_MIN_DATE}
          onTrack={onTrack ?? fn()}
          onActionsChange={actionsChange}
        />
      </WizardProvider>
    </QueryClientProvider>
  );
};

const meta = {
  title: 'Reserve/Wizard/PlanStep/PlanStepForm',
  component: PlanStepFormPreview,
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
    const increasePartyButton = await canvas.findByRole('button', { name: /increase guests/i });
    await userEvent.click(increasePartyButton);
    expect(args.onTrack).toHaveBeenCalled();
  },
};
