import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  toTimeSlotDescriptor,
  type TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { formatDateForInput } from '@reserve/shared/formatting/booking';

import {
  DEFAULT_MINUTES_STEP,
  DEFAULT_TIMEZONE,
  extractDateParts,
  getAvailableScheduleSlots,
  resolveSelectedTimeValidationMessage,
  resolveScheduleAwareTimeChange,
  resolveUnavailableMessage,
  toIsoString,
  toStartOfDay,
} from './scheduleAwareTimestampPickerDomain';
import { useScheduleAvailabilityLoader } from './useScheduleAvailabilityLoader';

type UseScheduleAwareTimestampPickerOptions = {
  disabled: boolean;
  errorMessage?: string | null;
  minDate?: Date;
  onBlur?: () => void;
  onChange: (value: string | null) => void;
  onDateChange?: (dateIso: string | null) => void;
  restaurantSlug: string | null | undefined;
  restaurantTimezone?: string | null;
  targetService?: string | null;
  value: string | null;
};

export function useScheduleAwareTimestampPicker({
  disabled,
  errorMessage,
  minDate,
  onBlur,
  onChange,
  onDateChange,
  restaurantSlug,
  restaurantTimezone,
  targetService,
  value,
}: UseScheduleAwareTimestampPickerOptions) {
  const selectionModeRef = useRef<'initial' | 'user-change'>('initial');

  const fallbackMinDate = useMemo(() => toStartOfDay(minDate ?? new Date()), [minDate]);
  const normalizedMinDate = useMemo(() => toStartOfDay(fallbackMinDate), [fallbackMinDate]);
  const normalizedMinTimestamp = useMemo(() => normalizedMinDate.getTime(), [normalizedMinDate]);

  const initialTimezone = restaurantTimezone ?? DEFAULT_TIMEZONE;
  const initialParts = useMemo(
    () => extractDateParts(value, initialTimezone),
    [initialTimezone, value],
  );
  const initialDate = initialParts.date ?? formatDateForInput(fallbackMinDate);
  const initialTime = initialParts.time ?? '';

  const lastCommittedInitial =
    initialParts.date && initialParts.time
      ? `${initialParts.date}|${initialParts.time}`
      : initialParts.date
        ? `${initialParts.date}|null`
        : null;
  const lastCommittedRef = useRef<string | null>(lastCommittedInitial);
  const resetSignatureRef = useRef<{ slug: string | null; date: string | null }>({
    slug: restaurantSlug ?? null,
    date: initialDate,
  });

  const [activeDate, setActiveDate] = useState<string>(initialDate);
  const [draftTime, setDraftTime] = useState<string>(initialTime);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);

  const {
    activeRecordStatus,
    currentSchedule,
    getScheduleForDate,
    handleMonthPrefetch,
    loadingDates,
    resetScheduleAvailability,
    unavailableDates,
    unavailabilityReason,
  } = useScheduleAvailabilityLoader({
    activeDate,
    normalizedMinDate,
    normalizedMinTimestamp,
    restaurantSlug,
  });

  const isScheduleLoading = activeRecordStatus === 'loading';
  const scheduleTimezone = currentSchedule?.timezone ?? restaurantTimezone ?? DEFAULT_TIMEZONE;

  const commitChange = useCallback(
    (dateKey: string | null, timeValue: string | null) => {
      const commitKey = `${dateKey ?? 'null'}|${timeValue ?? 'null'}`;
      if (lastCommittedRef.current === commitKey) {
        return;
      }
      lastCommittedRef.current = commitKey;

      if (!dateKey || !timeValue) {
        onChange(null);
        return;
      }

      const schedule = dateKey ? getScheduleForDate(dateKey) : null;
      const timezone = schedule?.timezone ?? scheduleTimezone;
      const iso = toIsoString(dateKey, timeValue, timezone);
      onChange(iso);
    },
    [getScheduleForDate, onChange, scheduleTimezone],
  );

  useEffect(() => {
    if (selectionModeRef.current === 'user-change') {
      return;
    }

    const parts = extractDateParts(value, scheduleTimezone);
    if (parts.date) {
      setActiveDate((prev) => (prev === parts.date ? prev : parts.date!));
    }
    if (parts.time) {
      setDraftTime(parts.time);
      setSelectedTime(parts.time);
    }
    lastCommittedRef.current =
      parts.date && parts.time
        ? `${parts.date}|${parts.time}`
        : parts.date
          ? `${parts.date}|null`
          : null;
  }, [scheduleTimezone, value]);

  useEffect(() => {
    const slugKey = restaurantSlug ?? null;
    const dateKey = initialDate;
    const prev = resetSignatureRef.current;
    const hasSlugChanged = prev.slug !== slugKey;
    const hasDateChanged = prev.date !== dateKey;

    if (selectionModeRef.current === 'user-change' && !hasSlugChanged && !hasDateChanged) {
      return;
    }

    resetSignatureRef.current = { slug: slugKey, date: dateKey };

    if (!hasSlugChanged && !hasDateChanged) {
      return;
    }

    if (!hasSlugChanged && dateKey === activeDate) {
      lastCommittedRef.current = lastCommittedInitial;
      selectionModeRef.current = 'initial';
      return;
    }

    resetScheduleAvailability();
    setTimeValidationError(null);
    lastCommittedRef.current = lastCommittedInitial;
    selectionModeRef.current = 'initial';
    setActiveDate(dateKey);
    setDraftTime(initialTime);
    setSelectedTime(initialTime);
  }, [
    activeDate,
    initialDate,
    initialTime,
    lastCommittedInitial,
    resetScheduleAvailability,
    restaurantSlug,
  ]);

  const intervalMinutes = currentSchedule?.intervalMinutes ?? DEFAULT_MINUTES_STEP;
  const slots = useMemo<TimeSlotDescriptor[]>(() => {
    if (!currentSchedule) {
      return [];
    }
    return currentSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  }, [currentSchedule]);

  const availableSlots = useMemo(
    () => getAvailableScheduleSlots(slots, targetService),
    [slots, targetService],
  );

  useEffect(() => {
    if (!currentSchedule) {
      return;
    }

    if (selectedTime) {
      if (!activeDate) {
        return;
      }
      const message = resolveSelectedTimeValidationMessage({
        availableSlots,
        schedule: currentSchedule,
        selectedTime,
      });
      if (message) {
        setTimeValidationError((prev) => prev ?? message);
      } else {
        setTimeValidationError(null);
      }
      commitChange(activeDate, selectedTime);
      selectionModeRef.current = 'initial';
      return;
    }

    if (availableSlots.length === 0) {
      if (!activeDate) {
        return;
      }
      setDraftTime('');
      setSelectedTime('');
      setTimeValidationError(null);
      return;
    }

    const fallback = availableSlots[0]?.value ?? '';
    if (fallback) {
      setDraftTime(fallback);
      setSelectedTime(fallback);
      commitChange(activeDate, fallback);
      selectionModeRef.current = 'initial';
      setTimeValidationError(null);
    }
  }, [activeDate, availableSlots, commitChange, currentSchedule, selectedTime]);

  useEffect(() => {
    if (selectedTime && availableSlots.some((slot) => slot.value === selectedTime)) {
      setTimeValidationError(null);
    }
  }, [availableSlots, selectedTime]);

  const handleDateSelect = useCallback(
    (date: Date | undefined | null) => {
      if (!date) {
        selectionModeRef.current = 'user-change';
        setActiveDate('');
        setSelectedTime('');
        setDraftTime('');
        commitChange(null, null);
        setTimeValidationError(null);
        onDateChange?.(null);
        return;
      }
      const formatted = formatDateForInput(date);
      if (formatted !== activeDate) {
        selectionModeRef.current = 'user-change';
        onDateChange?.(formatted);
      }
      setActiveDate(formatted);
      setTimeValidationError(null);
    },
    [activeDate, commitChange, onDateChange],
  );

  const handleTimeChange = useCallback(
    (next: string, options?: { commit?: boolean }) => {
      const decision = resolveScheduleAwareTimeChange({
        availableSlots,
        currentSchedule,
        intervalMinutes,
        isScheduleLoading,
        next,
        selectedTime,
        shouldCommit: options?.commit !== false,
      });

      setDraftTime(decision.draftTime);
      setSelectedTime(decision.selectedTime);
      setTimeValidationError(decision.timeValidationError);

      if (decision.commitTime !== undefined) {
        commitChange(activeDate, decision.commitTime);
      }
      if (decision.shouldResetSelectionMode) {
        selectionModeRef.current = 'initial';
      }
      if (decision.shouldBlur) {
        onBlur?.();
      }
    },
    [
      activeDate,
      availableSlots,
      commitChange,
      currentSchedule,
      intervalMinutes,
      isScheduleLoading,
      onBlur,
      selectedTime,
    ],
  );

  const isDateDisabled = useCallback(
    (date: Date) => {
      const key = formatDateForInput(date);
      const reason = unavailableDates.get(key);
      return reason === 'closed';
    },
    [unavailableDates],
  );

  const resolvedUnavailableMessage = useMemo(
    () => resolveUnavailableMessage(unavailabilityReason),
    [unavailabilityReason],
  );

  const isTimeDisabled = disabled;
  const unavailableMessageForTime =
    resolvedUnavailableMessage ??
    (isTimeDisabled ? 'No available times for the selected date.' : undefined);
  const resolvedTimeErrorMessage = errorMessage ?? timeValidationError ?? undefined;

  return {
    activeDate,
    availableSlots,
    dateErrorMessage: errorMessage ?? undefined,
    draftTime,
    fallbackMinDate,
    handleDateSelect,
    handleMonthPrefetch,
    handleTimeChange,
    intervalMinutes,
    isDateDisabled,
    isScheduleLoading,
    isTimeDisabled,
    loadingDates,
    resolvedTimeErrorMessage,
    unavailableMessageForTime,
  };
}
