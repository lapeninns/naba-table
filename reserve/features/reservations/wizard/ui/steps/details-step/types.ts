import type { State, StepAction } from '../../../model/reducer';
import type { DetailsFormInputValues, DetailsFormValues } from '../../../model/schemas';
import type { WizardActions } from '../../../model/store';
import type { UseFormReturn } from 'react-hook-form';

export interface DetailsStepProps {
  state: State;
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: string, payload?: Record<string, unknown>) => void;
}

export type DetailsStepController = {
  form: UseFormReturn<DetailsFormInputValues, unknown, DetailsFormValues>;
  handleBack: () => void;
  handleSubmit: (values: DetailsFormValues) => void;
  handleError: (errors: Record<string, unknown>) => void;
  isSubmitting: boolean;
  isValid: boolean;
  handlers: {
    changeName: (value: string) => void;
    changeEmail: (value: string) => void;
    changePhone: (value: string) => void;
    toggleRemember: (value: boolean) => void;
    toggleMarketing: (value: boolean) => void;
    toggleAgree: (value: boolean) => void;
  };
};
