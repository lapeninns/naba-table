import type { State, StepAction } from '../../../model/reducer';
import type { PlanFormValues } from '../../../model/schemas';
import type { WizardActions } from '../../../model/store';
import type {
  ReservationSchedule,
  ServiceAvailability,
  TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services';
import type { AnalyticsEvent } from '@shared/lib/analytics';
import type { UseFormReturn } from 'react-hook-form';

export interface PlanStepFormProps {
  state: State;
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
  minDate: Date;
}

export type PlanStepFormHandlers = {
  selectDate: (value: Date | undefined | null) => void;
  selectTime: (value: string, options?: { commit?: boolean }) => void;
  changeParty: (direction: 'decrement' | 'increment') => void;
  changeOccasion: (value: PlanFormValues['bookingType']) => void;
  changeNotes: (value: string) => void;
  prefetchMonth: (month: Date) => void;
};

export type PlanStepUnavailableReason = 'closed' | 'no-slots';

export type PlanStepFormState = {
  form: UseFormReturn<PlanFormValues>;
  slots: TimeSlotDescriptor[];
  availability: ServiceAvailability;
  handlers: PlanStepFormHandlers;
  minDate: Date;
  intervalMinutes: number;
  unavailableDates: Map<string, PlanStepUnavailableReason>;
  hasAvailableSlots: boolean;
  isScheduleLoading: boolean;
  schedule: ReservationSchedule | null;
  currentUnavailabilityReason: PlanStepUnavailableReason | null;
  isSubmitting: boolean;
  isValid: boolean;
  submitForm: (values: PlanFormValues) => void;
  handleError: (errors: Record<string, unknown>) => void;
};
