'use client';

import { useRouter } from 'next/navigation';

import {
  ConfirmationStep as FeatureConfirmationStep,
  type ConfirmationStepProps as FeatureConfirmationStepProps,
} from '@features/reservations/wizard/ui/steps/ConfirmationStep';

import type { State, StepAction } from '@features/reservations/wizard/model/reducer';

type LegacyConfirmationProps = {
  state: State;
  onNewBooking: () => void;
  onActionsChange: (actions: StepAction[]) => void;
};

export function ConfirmationStep(props: LegacyConfirmationProps) {
  const router = useRouter();

  const handleClose = () => {
    router.push('/thank-you');
  };

  return (
    <FeatureConfirmationStep
      state={props.state}
      onNewBooking={props.onNewBooking}
      onClose={handleClose}
      onActionsChange={props.onActionsChange}
    />
  );
}

export type ConfirmationStepProps = FeatureConfirmationStepProps;
