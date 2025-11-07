import type { State, StepAction } from '../../../model/reducer';

export interface ConfirmationStepProps {
  state?: State;
  onNewBooking: () => void;
  onClose: () => void;
  onActionsChange: (actions: StepAction[]) => void;
}

export type ConfirmationStatus = 'pending' | 'confirmed' | 'updated';

export type ConfirmationFeedback = {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

export type ConfirmationStepController = {
  booking: State['lastConfirmed'];
  details: State['details'];
  venue: {
    id: string;
    name: string;
    address: string;
    timezone: string;
  };
  status: ConfirmationStatus;
  isLoading: boolean;
  heading: string;
  description: string;
  reference: string;
  guestName: string;
  summaryDate: string;
  summaryTime: string;
  partyText: string;
  reservationWindow: { start: Date; end: Date } | null;
  calendarLoading: boolean;
  walletLoading: boolean;
  feedback: ConfirmationFeedback | null;
  dismissFeedback: () => void;
  handleAddToCalendar: () => void;
  handleAddToWallet: () => Promise<void> | void;
  handleClose: () => void;
  handleNewBooking: () => void;
};
