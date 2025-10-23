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
  const [disabledDays, setDisabledDays] = useState<DisabledReasonState>(new Map());

  const fallbackMinDate = useMemo(() => toStartOfDay(minDate ?? new Date()), [minDate]);

  const [activeDate, setActiveDate] = useState<string>(() => formatDateForInput(fallbackMinDate));
  const [draftTime, setDraftTime] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [currentSchedule, setCurrentSchedule] = useState<ReservationSchedule | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    setDisabledDays(new Map());
    setCurrentSchedule(null);
    setLoadError(null);
  }, [restaurantSlug]);

  const updateDisabledDays = useCallback(() => {
    const next = buildDisabledDayMap(scheduleCacheRef.current);
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
      return;
    }
    const fallback = enabledSlots[0]?.value ?? '';
    if (fallback) {
      setSelectedTime(fallback);
      setDraftTime(fallback);
      commitChange(activeDate, fallback);
    }
  }, [activeDate, enabledSlots, commitChange, currentSchedule, selectedTime]);

  const handleDateSelect = useCallback(
    (date: Date | undefined | null) => {
      if (!date) {
        setActiveDate('');
        setSelectedTime('');
        setDraftTime('');
        commitChange(null, null);
        return;
      }
      const formatted = formatDateForInput(date);
      setActiveDate(formatted);
    },
    [commitChange],
  );

  const handleTimeChange = useCallback(
    (next: string, options?: { commit?: boolean }) => {
      setDraftTime(next);
      if (options?.commit === false) {
        return;
      }
      setSelectedTime(next);
      commitChange(activeDate, next);
      onBlur?.();
    },
    [activeDate, commitChange, onBlur],
  );

  const handleSlotSelect = useCallback(
    (value: string) => {
      setDraftTime(value);
      setSelectedTime(value);
      commitChange(activeDate, value);
      onBlur?.();
    },
    [activeDate, commitChange, onBlur],
  );

  const handleMonthPrefetch = useCallback(
    (month: Date) => {
      const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
      const formatted = formatDateForInput(firstDay);
      void fetchSchedule(formatted, { force: false });
    },
    [fetchSchedule],
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

  const inlineWarning = loadError ?? null;

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
            error: errorMessage ?? undefined,
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
