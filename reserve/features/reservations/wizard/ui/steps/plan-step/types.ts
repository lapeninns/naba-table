import type { State, StepAction } from '../../../model/reducer';
import type { PlanFormValues } from '../../../model/schemas';
import type { WizardActions } from '../../../model/store';
import type {
  ReservationSchedule,
  TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services';
import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';
import type { AnalyticsEvent } from '@shared/lib/analytics';
import type { UseFormReturn } from 'react-hook-form';

export interface PlanStepFormProps {
  /**
   * Legacy hooks/tests can provide explicit state/actions. Wizard context is used when omitted.
   */
  state?: State;
  actions?: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
  onTrack?: (event: AnalyticsEvent, payload?: Record<string, unknown>) => void;
  minDate: Date;
  initialCalendarMask?: CalendarMask | null;
}

export type PlanStepFormHandlers = {
  selectDate: (value: Date | undefined | null) => void;
  selectTime: (value: string, options?: { commit?: boolean }) => void;
  changeParty: (direction: 'decrement' | 'increment') => void;
  commitNotes: (value: string) => void;
  prefetchMonth: (month: Date) => void;
};

export type PlanStepUnavailableReason = 'closed' | 'no-slots' | 'unknown';

export type PlanStepFormState = {
  form: UseFormReturn<PlanFormValues>;
  slots: TimeSlotDescriptor[];
  handlers: PlanStepFormHandlers;
  minDate: Date;
  intervalMinutes: number | null;
  unavailableDates: Map<string, PlanStepUnavailableReason>;
  loadingDates: Set<string>;
  hasAvailableSlots: boolean;
  isScheduleLoading: boolean;
  isScheduleFetching: boolean;
  schedule: ReservationSchedule | null;
  currentUnavailabilityReason: PlanStepUnavailableReason | null;
  isSubmitting: boolean;
  isValid: boolean;
  submitForm: (values: PlanFormValues) => void;
  handleError: (errors: Record<string, unknown>) => void;
};
