import type { State, StepAction } from '../../../model/reducer';
import type { WizardActions } from '../../../model/store';

export interface ReviewStepProps {
  state?: State;
  actions?: Pick<WizardActions, 'goToStep'>;
  onConfirm: () => void | Promise<void>;
  onActionsChange: (actions: StepAction[]) => void;
}

export type ReviewSummary = {
  summaryValue: string;
  summaryDate: string;
  summaryTime: string;
  partyText: string;
};

export type ReviewStepController = {
  details: State['details'];
  summary: ReviewSummary;
  isSubmitting: boolean;
  error: State['error'];
  handleEdit: () => void;
  handleConfirm: () => void;
};
