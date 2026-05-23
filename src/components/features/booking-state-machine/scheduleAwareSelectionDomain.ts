import {
  type ReservationSchedule,
  type TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { getLatestStartMinutes, hasCapacity } from '@reserve/shared/schedule/availability';
import { MINUTES_PER_DAY, normalizeTime, toMinutes } from '@reserve/shared/time';

import {
  CLOSED_COPY,
  DEFAULT_MINUTES_STEP,
  NO_SLOTS_COPY,
  OVERRIDE_SELECTION_COPY,
  UNAVAILABLE_SELECTION_COPY,
  UNKNOWN_COPY,
} from './scheduleAwareTimestampPickerConstants';

import type { UnavailabilityReason } from '@reserve/shared/schedule/availability';

export const snapTimeToInterval = (value: string, intervalMinutes: number): string | null => {
  const normalized = normalizeTime(value);
  if (!normalized || !Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return normalized;
  }

  const [hours, minutes] = normalized.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const snappedMinutes = Math.round(totalMinutes / intervalMinutes) * intervalMinutes;
  const safeMinutes = Math.min(Math.max(snappedMinutes, 0), MINUTES_PER_DAY - 1);

  const snappedHours = Math.floor(safeMinutes / 60) % 24;
  const snappedRemainder = safeMinutes % 60;

  return `${String(snappedHours).padStart(2, '0')}:${String(snappedRemainder).padStart(2, '0')}`;
};

/**
 * Allow manual time selection even when the schedule API omits specific slots.
 * Treat a time as eligible if it falls inside the configured schedule span.
 */
export const isWithinScheduleWindow = (
  timeValue: string,
  schedule: ReservationSchedule | null | undefined,
): boolean => {
  const normalized = normalizeTime(timeValue);
  if (!normalized || !schedule) {
    return false;
  }
  const opensAt = normalizeTime(schedule.window?.opensAt ?? null);
  const closesAt = normalizeTime(schedule.window?.closesAt ?? null);
  if (!opensAt || !closesAt) {
    return false;
  }

  const minutes = toMinutes(normalized);
  const openingMinutes = toMinutes(opensAt);
  const latestStartMinutes = getLatestStartMinutes(schedule);
  const closingMinutes = toMinutes(closesAt);
  const latestAllowed =
    typeof latestStartMinutes === 'number' ? latestStartMinutes : closingMinutes;

  return minutes >= openingMinutes && minutes <= latestAllowed;
};

export const getAvailableScheduleSlots = (
  slots: TimeSlotDescriptor[],
  targetService: string | null | undefined,
): TimeSlotDescriptor[] =>
  slots.filter((slot) => {
    if (slot.disabled) {
      return false;
    }
    if (targetService) {
      const services = slot.availability?.services ?? {};
      return services[targetService] !== 'disabled';
    }
    return hasCapacity(slot);
  });

export const resolveUnavailableMessage = (
  reason: UnavailabilityReason | null,
): string | undefined => {
  switch (reason) {
    case 'closed':
      return CLOSED_COPY;
    case 'no-slots':
      return NO_SLOTS_COPY;
    case 'unknown':
      return UNKNOWN_COPY;
    default:
      return undefined;
  }
};

export const resolveSelectedTimeValidationMessage = ({
  availableSlots,
  schedule,
  selectedTime,
}: {
  availableSlots: TimeSlotDescriptor[];
  schedule: ReservationSchedule | null;
  selectedTime: string;
}): string | null => {
  const hasSelected = availableSlots.some((slot) => slot.value === selectedTime);
  if (hasSelected) {
    return null;
  }

  if (isWithinScheduleWindow(selectedTime, schedule)) {
    return null;
  }

  return availableSlots.length > 0 ? UNAVAILABLE_SELECTION_COPY : OVERRIDE_SELECTION_COPY;
};

export type ScheduleAwareTimeChangeDecision = {
  commitTime?: string | null;
  draftTime: string;
  selectedTime: string;
  shouldBlur: boolean;
  shouldResetSelectionMode: boolean;
  timeValidationError: string | null;
};

export const resolveScheduleAwareTimeChange = ({
  availableSlots,
  currentSchedule,
  intervalMinutes,
  isScheduleLoading,
  next,
  selectedTime,
  shouldCommit = true,
}: {
  availableSlots: TimeSlotDescriptor[];
  currentSchedule: ReservationSchedule | null;
  intervalMinutes: number;
  isScheduleLoading: boolean;
  next: string;
  selectedTime: string;
  shouldCommit?: boolean;
}): ScheduleAwareTimeChangeDecision => {
  if (!shouldCommit) {
    return {
      draftTime: next,
      selectedTime,
      timeValidationError: null,
      shouldBlur: false,
      shouldResetSelectionMode: false,
    };
  }

  const normalized = normalizeTime(next);
  if (!normalized) {
    return {
      draftTime: selectedTime,
      selectedTime,
      timeValidationError: 'Enter a valid time.',
      commitTime: selectedTime ? undefined : null,
      shouldBlur: true,
      shouldResetSelectionMode: false,
    };
  }

  const snapped = snapTimeToInterval(normalized, intervalMinutes || DEFAULT_MINUTES_STEP);
  const candidate = snapped ?? normalized;

  if (isScheduleLoading || !currentSchedule) {
    return {
      draftTime: candidate,
      selectedTime: candidate,
      timeValidationError: null,
      commitTime: candidate,
      shouldBlur: true,
      shouldResetSelectionMode: true,
    };
  }

  const isAvailable = availableSlots.some((slot) => slot.value === candidate);
  const withinWindow = isWithinScheduleWindow(candidate, currentSchedule);
  if (!isAvailable && !withinWindow) {
    return {
      draftTime: selectedTime,
      selectedTime,
      timeValidationError: UNAVAILABLE_SELECTION_COPY,
      commitTime: selectedTime ? undefined : null,
      shouldBlur: true,
      shouldResetSelectionMode: false,
    };
  }

  return {
    draftTime: candidate,
    selectedTime: candidate,
    timeValidationError: null,
    commitTime: candidate,
    shouldBlur: true,
    shouldResetSelectionMode: true,
  };
};
