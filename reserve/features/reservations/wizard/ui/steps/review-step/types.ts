import type { BookingWizardMode, State, StepAction } from '../../../model/reducer';
import type { WizardActions } from '../../../model/store';

export interface ReviewStepProps {
  state?: State;
  actions?: Partial<
    Pick<WizardActions, 'goToStep' | 'updateDetails' | 'setError' | 'setSubmissionError'>
  >;
  onConfirm: () => void | Promise<void>;
  onActionsChange: (actions: StepAction[]) => void;
  mode?: BookingWizardMode;
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
  submissionError: State['submissionError'];
  handleEdit: () => void;
  handleConfirm: () => void;
  handleAlternativeSelect: (time: string) => void;
};
