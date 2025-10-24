"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { Calendar24Field, TimeSlotGrid } from '@reserve/features/reservations/wizard/ui/steps/plan-step/components';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';
import {
  getDisabledDays as buildDisabledDayMap,
  getLatestStartMinutes,
  hasCapacity,
  isDateUnavailable as resolveDateUnavailability,
  isPastOrClosing,
  type UnavailabilityReason,
} from '@reserve/shared/schedule/availability';
import { fetchReservationSchedule, scheduleQueryKey } from '@reserve/features/reservations/wizard/services/schedule';
import { toTimeSlotDescriptor, type ReservationSchedule, type TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services/timeSlots';
import { closedDaysQueryKey, fetchClosedDaysForRange } from '@reserve/features/reservations/wizard/services/closedDays';
import { cn } from '@/lib/utils';

type DisabledReasonState = Map<string, UnavailabilityReason>;

type DateParts = {
  date: string | null;
  time: string | null;
};

export type ScheduleAwareTimestampPickerProps = {
  restaurantSlug: string | null | undefined;
  restaurantTimezone?: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  label?: string;
  description?: string;
  errorMessage?: string | null;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
};

const DEFAULT_MINUTES_STEP = 15;
const DEFAULT_TIMEZONE = 'UTC';

const CLOSED_COPY =
  'We’re closed on this date. Please choose a different day.';
const NO_SLOTS_COPY =
  'All reservation times are taken on this date. Please choose a different day.';
const UNKNOWN_COPY = 'Schedule not loaded yet—scroll to load month.';
const UNAVAILABLE_SELECTION_COPY =
  'Selected time is no longer available. Please choose another slot.';

const toStartOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const extractDateParts = (iso: string | null | undefined, targetTimezone: string): DateParts => {
  if (!iso) {
    return { date: null, time: null };
  }
  const parsed = DateTime.fromISO(iso, { zone: 'utc' });
  if (!parsed.isValid) {
    return { date: null, time: null };
  }
  const zoned = parsed.setZone(targetTimezone, { keepLocalTime: false });
  return {
    date: zoned.toISODate(),
    time: zoned.toFormat('HH:mm'),
  };
};

const toIsoString = (date: string, time: string, timezone: string): string | null => {
  const normalized = normalizeTime(time);
  if (!normalized) {
    return null;
  }
  const combined = DateTime.fromISO(`${date}T${normalized}`, { zone: timezone });
  if (!combined.isValid) {
    return null;
  }
  return combined.toUTC().toISO();
};

export function ScheduleAwareTimestampPicker({
  restaurantSlug,
  restaurantTimezone,
  value,
  onChange,
  onBlur,
  label,
  description,
  errorMessage,
  disabled = false,
  minDate,
  className,
}: ScheduleAwareTimestampPickerProps) {
  const queryClient = useQueryClient();

  const scheduleCacheRef = useRef<Map<string, ReservationSchedule | null>>(new Map());
  const closedDaysRef = useRef<Set<string>>(new Set());
  const [disabledDays, setDisabledDays] = useState<DisabledReasonState>(new Map());

  const fallbackMinDate = useMemo(() => toStartOfDay(minDate ?? new Date()), [minDate]);

  const [activeDate, setActiveDate] = useState<string>(() => formatDateForInput(fallbackMinDate));
  const [draftTime, setDraftTime] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [currentSchedule, setCurrentSchedule] = useState<ReservationSchedule | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeValidationError, setTimeValidationError] = useState<string | null>(null);

  const scheduleTimezone = currentSchedule?.timezone ?? restaurantTimezone ?? DEFAULT_TIMEZONE;

  const commitChange = useCallback(
    (dateKey: string | null, timeValue: string | null) => {
      if (!dateKey || !timeValue) {
        onChange(null);
        return;
      }

      const schedule = scheduleCacheRef.current.get(dateKey);
      const timezone = schedule?.timezone ?? scheduleTimezone;
      const iso = toIsoString(dateKey, timeValue, timezone);
      onChange(iso);
    },
    [onChange, scheduleTimezone],
  );

  useEffect(() => {
    const parts = extractDateParts(value, scheduleTimezone);
    if (parts.date) {
      setActiveDate((prev) => (prev === parts.date ? prev : parts.date!));
    }
    if (parts.time) {
      setDraftTime(parts.time);
      setSelectedTime(parts.time);
    }
  }, [scheduleTimezone, value]);

  useEffect(() => {
    scheduleCacheRef.current.clear();
    closedDaysRef.current.clear();
    setDisabledDays(new Map());
    setCurrentSchedule(null);
    setLoadError(null);
    setTimeValidationError(null);
  }, [restaurantSlug]);

  const updateDisabledDays = useCallback(() => {
    const next = buildDisabledDayMap(scheduleCacheRef.current);
    // Merge in pre-fetched closed days so they appear instantly
    closedDaysRef.current.forEach((dateKey) => next.set(dateKey, 'closed'));
    setDisabledDays(next);
  }, []);

  const fetchSchedule = useCallback(
    async (dateKey: string, opts?: { force?: boolean }) => {
      if (!restaurantSlug) {
        return null;
      }
      if (!opts?.force && scheduleCacheRef.current.has(dateKey)) {
        return scheduleCacheRef.current.get(dateKey) ?? null;
      }
      try {
        const schedule = await queryClient.fetchQuery({
          queryKey: scheduleQueryKey(restaurantSlug, dateKey),
          queryFn: ({ signal }) => fetchReservationSchedule(restaurantSlug, dateKey, signal),
          staleTime: 60_000,
        });
        scheduleCacheRef.current.set(dateKey, schedule);
        updateDisabledDays();
        return schedule;
      } catch (error) {
        console.error('[schedule-picker] failed to load schedule', error);
        scheduleCacheRef.current.set(dateKey, null);
        updateDisabledDays();
        return null;
      }
    },
    [queryClient, restaurantSlug, updateDisabledDays],
  );

  const ensureScheduleForDate = useCallback(
    async (dateKey: string) => {
      setIsLoading(true);
      setLoadError(null);
      const schedule = await fetchSchedule(dateKey);
      if (!schedule) {
        setLoadError('Unable to load availability for this date.');
        setCurrentSchedule(null);
        setIsLoading(false);
        return null;
      }
      setCurrentSchedule(schedule);
      setIsLoading(false);
      return schedule;
    },
    [fetchSchedule],
  );

  useEffect(() => {
    void ensureScheduleForDate(activeDate);
  }, [activeDate, ensureScheduleForDate]);

  const unavailabilityReason = useMemo<UnavailabilityReason | null>(() => {
    if (!activeDate) {
      return null;
    }
    if (closedDaysRef.current.has(activeDate)) {
      return 'closed';
    }
    return resolveDateUnavailability(activeDate, scheduleCacheRef.current);
  }, [activeDate]);

  const intervalMinutes = currentSchedule?.intervalMinutes ?? DEFAULT_MINUTES_STEP;
  const slots = useMemo<TimeSlotDescriptor[]>(() => {
    if (!currentSchedule) {
      return [];
    }
    return currentSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  }, [currentSchedule]);

  const enabledSlots = useMemo(() => slots.filter((slot) => !slot.disabled && hasCapacity(slot)), [slots]);

  useEffect(() => {
    if (!currentSchedule) {
      return;
    }
    if (selectedTime && enabledSlots.some((slot) => slot.value === selectedTime)) {
      return;
    }
    if (enabledSlots.length === 0) {
      setSelectedTime('');
      setDraftTime('');
      commitChange(activeDate, null);
      setTimeValidationError(null);
      return;
    }
    const fallback = enabledSlots[0]?.value ?? '';
    if (fallback) {
      setSelectedTime(fallback);
      setDraftTime(fallback);
      commitChange(activeDate, fallback);
      setTimeValidationError(null);
    }
  }, [activeDate, enabledSlots, commitChange, currentSchedule, selectedTime]);

  useEffect(() => {
    if (selectedTime && enabledSlots.some((slot) => slot.value === selectedTime)) {
      setTimeValidationError(null);
    }
  }, [enabledSlots, selectedTime]);

  const handleDateSelect = useCallback(
    (date: Date | undefined | null) => {
      if (!date) {
        setActiveDate('');
        setSelectedTime('');
        setDraftTime('');
        commitChange(null, null);
        setTimeValidationError(null);
        return;
      }
      const formatted = formatDateForInput(date);
      setActiveDate(formatted);
      setTimeValidationError(null);
    },
    [commitChange],
  );

  const handleTimeChange = useCallback(
    (next: string, options?: { commit?: boolean }) => {
      if (options?.commit === false) {
        setDraftTime(next);
        setTimeValidationError(null);
        return;
      }

      const normalized = normalizeTime(next);
      if (!normalized) {
        setDraftTime(selectedTime);
        setTimeValidationError('Enter a valid time.');
        onBlur?.();
        if (!selectedTime) {
          commitChange(activeDate, null);
        }
        return;
      }

      const isAvailable = enabledSlots.some((slot) => slot.value === normalized);
      if (!isAvailable) {
        setDraftTime(selectedTime);
        setTimeValidationError(UNAVAILABLE_SELECTION_COPY);
        onBlur?.();
        if (!selectedTime) {
          commitChange(activeDate, null);
        }
        return;
      }

      setTimeValidationError(null);
      setDraftTime(normalized);
      setSelectedTime(normalized);
      commitChange(activeDate, normalized);
      onBlur?.();
    },
    [activeDate, commitChange, enabledSlots, onBlur, selectedTime],
  );

  const handleSlotSelect = useCallback(
    (value: string) => {
      setDraftTime(value);
      setSelectedTime(value);
      setTimeValidationError(null);
      commitChange(activeDate, value);
      onBlur?.();
    },
    [activeDate, commitChange, onBlur],
  );

  const handleMonthPrefetch = useCallback(
    (month: Date) => {
      // Compute full grid (Sunday -> Saturday) for visible month
      const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const startDow = firstOfMonth.getDay(); // 0=Sun
      const endDow = lastOfMonth.getDay();
      const gridStart = new Date(firstOfMonth);
      gridStart.setDate(gridStart.getDate() - startDow);
      const gridEnd = new Date(lastOfMonth);
      gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

      const formatted = formatDateForInput(firstOfMonth);
      // Prefetch schedule for the first day (retains existing behavior)
      void fetchSchedule(formatted, { force: false });
      // Prefetch closed days for the grid so disabled days are instant, with query caching
      if (restaurantSlug) {
        const key = closedDaysQueryKey(restaurantSlug, gridStart, gridEnd);
        void queryClient
          .fetchQuery({
            queryKey: key,
            queryFn: ({ signal }) => fetchClosedDaysForRange(restaurantSlug, gridStart, gridEnd, signal),
            staleTime: 5 * 60_000,
          })
          .then((closed) => {
            const merged = new Set(closedDaysRef.current);
            closed.forEach((d) => merged.add(d));
            closedDaysRef.current = merged;
            updateDisabledDays();
          })
          .catch((error) => {
            console.warn('[schedule-picker] closed-days prefetch failed', error);
          });
      }
    },
    [fetchSchedule, restaurantSlug, updateDisabledDays, queryClient],
  );

  const isDateDisabled = useCallback(
    (date: Date) => {
      const key = formatDateForInput(date);
      return disabledDays.has(key) || Boolean(resolveDateUnavailability(key, scheduleCacheRef.current));
    },
    [disabledDays],
  );

  const resolvedUnavailableMessage = useMemo(() => {
    switch (unavailabilityReason) {
      case 'closed':
        return CLOSED_COPY;
      case 'no-slots':
        return NO_SLOTS_COPY;
      case 'unknown':
        return UNKNOWN_COPY;
      default:
        return undefined;
    }
  }, [unavailabilityReason]);

  const isTimeDisabled = disabled || Boolean(unavailabilityReason) || enabledSlots.length === 0;

  const latestStartMinutes = useMemo(
    () => getLatestStartMinutes(currentSchedule),
    [currentSchedule],
  );

  useEffect(() => {
    if (isTimeDisabled) {
      setTimeValidationError(null);
    }
  }, [isTimeDisabled]);

  const inlineWarning = loadError ?? null;
  const resolvedTimeErrorMessage = errorMessage ?? timeValidationError ?? undefined;

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-3">
        {label ? <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span> : null}
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        <Calendar24Field
          date={{
            value: activeDate,
            minDate: fallbackMinDate,
            onSelect: handleDateSelect,
            onBlur,
            error: errorMessage ?? undefined,
          }}
          time={{
            value: draftTime,
            onChange: handleTimeChange,
            onBlur,
            error: resolvedTimeErrorMessage,
          }}
          suggestions={enabledSlots}
          intervalMinutes={intervalMinutes}
          isDateUnavailable={isDateDisabled}
          isTimeDisabled={isTimeDisabled}
          unavailableMessage={resolvedUnavailableMessage}
          onMonthChange={handleMonthPrefetch}
        />
      </div>

      {inlineWarning ? (
        <p className="text-sm text-destructive">{inlineWarning}</p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading availability…
        </p>
      ) : null}

      {!isTimeDisabled ? (
        <TimeSlotGrid slots={enabledSlots} value={selectedTime} onSelect={handleSlotSelect} />
      ) : null}

      {currentSchedule && selectedTime && latestStartMinutes !== null ? (
        isPastOrClosing({
          date: activeDate,
          time: selectedTime,
          schedule: currentSchedule,
        }) ? (
          <p className="text-sm text-warning">
            Selected time is no longer available. Please choose an earlier slot.
          </p>
        ) : null
      ) : null}
    </div>
  );
}
