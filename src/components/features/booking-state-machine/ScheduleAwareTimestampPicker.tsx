"use client";

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';

import { cn } from '@/lib/utils';
import {
  calendarMaskQueryKey,
  fetchCalendarMask,
  fetchReservationSchedule,
  scheduleQueryKey,
  type CalendarMask,
} from '@reserve/features/reservations/wizard/services/schedule';
import { toTimeSlotDescriptor, type ReservationSchedule, type TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services/timeSlots';
import { Calendar24Date, Calendar24Time, TimeSlotGrid } from '@reserve/features/reservations/wizard/ui/steps/plan-step/components';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { getLatestStartMinutes, hasCapacity, isPastOrClosing, type UnavailabilityReason } from '@reserve/shared/schedule/availability';
import { MINUTES_PER_DAY, normalizeTime } from '@reserve/shared/time';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';



type DateParts = {
  date: string | null;
  time: string | null;
};

type ScheduleRecord = {
  status: 'idle' | 'loading' | 'success' | 'error';
  schedule: ReservationSchedule | null;
  error?: string | null;
};

export type ScheduleAwareTimestampPickerProps = {
  restaurantSlug: string | null | undefined;
  restaurantTimezone?: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
  onDateChange?: (dateIso: string | null) => void;
  onBlur?: () => void;
  label?: string;
  description?: string;
  errorMessage?: string | null;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
  timeAccordion?: boolean;
  timeScrollArea?: boolean;
  variant?: 'default' | 'plan';
  children?: React.ReactNode;
};

const DEFAULT_MINUTES_STEP = 15;
const DEFAULT_TIMEZONE = 'UTC';

const CLOSED_COPY =
  'We’re closed on this date. Please choose a different day.';
const NO_SLOTS_COPY =
  'All reservation times are taken on this date. Please choose a different day.';
const UNKNOWN_COPY = 'We couldn’t load availability right now. Please try again or choose another date.';
const UNAVAILABLE_SELECTION_COPY =
  'Selected time is no longer available. Please choose another slot.';

const snapTimeToInterval = (value: string, intervalMinutes: number): string | null => {
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

const MONTH_KEY_FORMATTER = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const toStartOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const buildMonthDateKeys = (monthStart: Date, minDate: Date): string[] => {
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const keys: string[] = [];
  const normalizedMin = toStartOfDay(minDate).getTime();

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getTime() < normalizedMin) {
      continue;
    }
    keys.push(formatDateForInput(new Date(cursor)));
  }

  return keys;
};

const toMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const buildMonthPrefetchTargets = (monthStart: Date, normalizedMinTimestamp: number): Date[] => {
  const targets: Date[] = [];
  const base = toMonthStart(monthStart);
  targets.push(base);

  const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  if (previous.getTime() >= normalizedMinTimestamp) {
    targets.push(previous);
  }

  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  targets.push(next);

  return targets;
};

const deriveMaskAvailability = (
  mask: CalendarMask,
  normalizedMinTimestamp: number,
): Map<string, UnavailabilityReason | null> => {
  const results = new Map<string, UnavailabilityReason | null>();
  const zone = mask.timezone?.trim() || 'UTC';
  const start = DateTime.fromISO(mask.from, { zone }).startOf('day');
  const end = DateTime.fromISO(mask.to, { zone }).startOf('day');
  if (!start.isValid || !end.isValid) {
    return results;
  }

  const closedDateSet = new Set(mask.closedDates ?? []);
  const closedDaySet = new Set((mask.closedDaysOfWeek ?? []).map((value) => ((value % 7) + 7) % 7));

  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const isoKey = cursor.toISODate();
    if (!isoKey) {
      continue;
    }
    const timestamp = new Date(cursor.year, cursor.month - 1, cursor.day).getTime();
    if (timestamp < normalizedMinTimestamp) {
      continue;
    }

    const weekday = cursor.weekday % 7;
    if (closedDateSet.has(isoKey) || closedDaySet.has(weekday)) {
      results.set(isoKey, 'closed');
    } else {
      results.set(isoKey, null);
    }
  }

  return results;
};

const deriveScheduleUnavailability = (schedule: ReservationSchedule | null): UnavailabilityReason | null => {
  if (!schedule) {
    return 'unknown';
  }
  if (schedule.isClosed) {
    return 'closed';
  }
  const hasEnabledSlot = schedule.slots.some((slot) => hasCapacity(toTimeSlotDescriptor(slot)));
  return hasEnabledSlot ? null : 'no-slots';
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
  onDateChange,
  onBlur,
  label,
  description,
  errorMessage,
  disabled = false,
  minDate,
  className,
  timeAccordion = false,
  timeScrollArea = false,
  variant = 'default',
  children,
}: ScheduleAwareTimestampPickerProps) {
  const timeRegionLabelId = useId();
  const timeAccordionHeadingId = useId();
  const timeAccordionSummaryId = useId();
  const isPlanVariant = variant === 'plan';
  const shouldUseAccordion = isPlanVariant ? true : timeAccordion;
  const shouldUseScrollArea = shouldUseAccordion ? false : timeScrollArea;
  const queryClient = useQueryClient();

  const [scheduleStateByDate, setScheduleStateByDate] = useState<Map<string, ScheduleRecord>>(() => new Map());
  const scheduleStateRef = useRef(scheduleStateByDate);
  const selectionModeRef = useRef<'initial' | 'user-change'>('initial');
  const maskPrefetchedMonthsRef = useRef<Set<string>>(new Set());
  const [unavailableDates, setUnavailableDates] = useState<Map<string, UnavailabilityReason>>(() => new Map());
  const [loadingDates, setLoadingDates] = useState<Set<string>>(() => new Set());

  const fallbackMinDate = useMemo(() => toStartOfDay(minDate ?? new Date()), [minDate]);
  const normalizedMinDate = useMemo(() => toStartOfDay(fallbackMinDate), [fallbackMinDate]);
  const normalizedMinTimestamp = useMemo(() => normalizedMinDate.getTime(), [normalizedMinDate]);

  const updateUnavailableDate = useCallback((dateKey: string, reason: UnavailabilityReason | null) => {
    setUnavailableDates((prev) => {
      const existing = prev.get(dateKey) ?? null;
      if (existing === reason) {
        return prev;
      }
      const next = new Map(prev);
      if (reason) {
        next.set(dateKey, reason);
      } else {
        next.delete(dateKey);
      }
      return next;
    });
  }, []);

  const initialTimezone = restaurantTimezone ?? DEFAULT_TIMEZONE;
  const initialParts = useMemo(() => extractDateParts(value, initialTimezone), [initialTimezone, value]);
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

  useEffect(() => {
    scheduleStateRef.current = scheduleStateByDate;
  }, [scheduleStateByDate]);


  const applyCalendarMask = useCallback(
    (mask: CalendarMask) => {
      const derived = deriveMaskAvailability(mask, normalizedMinTimestamp);
      if (derived.size === 0) {
        return;
      }
      setUnavailableDates((prev) => {
        const next = new Map(prev);
        derived.forEach((reason, key) => {
          if (reason) {
            next.set(key, reason);
          } else {
            next.delete(key);
          }
        });
        return next;
      });
    },
    [normalizedMinTimestamp],
  );

  const prefetchCalendarMask = useCallback(
    (monthStart: Date) => {
      const slug = restaurantSlug?.trim();
      if (!slug) {
        return;
      }
      const monthKey = MONTH_KEY_FORMATTER(monthStart);
      if (maskPrefetchedMonthsRef.current.has(monthKey)) {
        return;
      }
      maskPrefetchedMonthsRef.current.add(monthKey);

      const rangeStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      const rangeEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const fromKey = formatDateForInput(rangeStart);
      const toKey = formatDateForInput(rangeEnd);
      const monthDateKeys = buildMonthDateKeys(monthStart, normalizedMinDate);

      setLoadingDates((prev) => {
        const next = new Set(prev);
        monthDateKeys.forEach((key) => next.add(key));
        return next;
      });

      void queryClient
        .fetchQuery({
          queryKey: calendarMaskQueryKey(slug, fromKey, toKey),
          queryFn: ({ signal }) => fetchCalendarMask(slug, fromKey, toKey, signal),
          staleTime: 5 * 60_000,
          meta: { persist: false },
        })
        .then((mask) => {
          applyCalendarMask(mask);
        })
        .catch((error) => {
          maskPrefetchedMonthsRef.current.delete(monthKey);
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[schedule-picker] failed to fetch calendar mask', {
              restaurantSlug: slug,
              from: fromKey,
              to: toKey,
              error,
            });
          }
        })
        .finally(() => {
          setLoadingDates((prev) => {
            const next = new Set(prev);
            monthDateKeys.forEach((key) => next.delete(key));
            return next;
          });
        });
    },
    [applyCalendarMask, normalizedMinDate, queryClient, restaurantSlug],
  );

  const prefetchVisibleMonths = useCallback(
    (month: Date) => {
      buildMonthPrefetchTargets(month, normalizedMinTimestamp).forEach(prefetchCalendarMask);
    },
    [normalizedMinTimestamp, prefetchCalendarMask],
  );

  const activeRecord = activeDate ? scheduleStateByDate.get(activeDate) ?? null : null;
  const activeRecordStatus = activeRecord?.status ?? 'idle';
  const currentSchedule = activeRecord?.schedule ?? null;
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

      const record = dateKey ? scheduleStateRef.current.get(dateKey) ?? null : null;
      const schedule = record?.schedule ?? null;
      const timezone = schedule?.timezone ?? scheduleTimezone;
      const iso = toIsoString(dateKey, timeValue, timezone);
      onChange(iso);
    },
    [onChange, scheduleTimezone],
  );

  useEffect(() => {
    selectionModeRef.current = 'initial';
    const parts = extractDateParts(value, scheduleTimezone);
    if (parts.date) {
      setActiveDate((prev) => (prev === parts.date ? prev : parts.date!));
    }
    if (parts.time) {
      setDraftTime(parts.time);
      setSelectedTime(parts.time);
    }
    lastCommittedRef.current =
      parts.date && parts.time ? `${parts.date}|${parts.time}` : parts.date ? `${parts.date}|null` : null;
  }, [scheduleTimezone, value]);

  useEffect(() => {
    const slugKey = restaurantSlug ?? null;
    const dateKey = initialDate;
    const prev = resetSignatureRef.current;
    const hasSlugChanged = prev.slug !== slugKey;
    const hasDateChanged = prev.date !== dateKey;
    resetSignatureRef.current = { slug: slugKey, date: dateKey };

    if (!hasSlugChanged && !hasDateChanged) {
      return;
    }

    const emptyState = new Map<string, ScheduleRecord>();
    scheduleStateRef.current = emptyState;
    setScheduleStateByDate(emptyState);
    setTimeValidationError(null);
    maskPrefetchedMonthsRef.current.clear();
    setUnavailableDates(new Map());
    setLoadingDates(new Set());
    lastCommittedRef.current = lastCommittedInitial;
    selectionModeRef.current = 'initial';
    setActiveDate(dateKey);
    setDraftTime(initialTime);
    setSelectedTime(initialTime);
  }, [initialDate, initialTime, lastCommittedInitial, restaurantSlug]);

  const loadSchedule = useCallback(
    async (dateKey: string, opts?: { prefetched?: boolean }) => {
      const slug = restaurantSlug?.trim();
      if (!slug || !dateKey) {
        return null;
      }

      const existing = scheduleStateRef.current.get(dateKey);
      if (!opts?.prefetched && existing?.status === 'loading') {
        return existing.schedule;
      }
      if (!opts?.prefetched && existing?.status === 'success') {
        return existing.schedule;
      }

      if (!opts?.prefetched) {
        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          const current = next.get(dateKey);
          next.set(dateKey, {
            status: 'loading',
            schedule: current?.schedule ?? null,
            error: null,
          });
          return next;
        });
      }

      try {
        const schedule = await queryClient.fetchQuery({
          queryKey: scheduleQueryKey(slug, dateKey),
          queryFn: ({ signal }) => fetchReservationSchedule(slug, dateKey, signal),
          staleTime: 60_000,
          meta: { persist: false },
        });

        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          next.set(dateKey, {
            status: 'success',
            schedule,
            error: null,
          });
          return next;
        });
        const derivedReason = deriveScheduleUnavailability(schedule);
        updateUnavailableDate(dateKey, derivedReason);
        return schedule;
      } catch (error) {
        console.error('[schedule-picker] failed to load schedule', error);
        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          next.set(dateKey, {
            status: 'error',
            schedule: null,
            error: 'Unable to load availability for this date. Please try again.',
          });
          return next;
        });
        updateUnavailableDate(dateKey, 'unknown');
        return null;
      }
    },
    [queryClient, restaurantSlug, updateUnavailableDate],
  );

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    void loadSchedule(activeDate);
  }, [activeDate, loadSchedule]);

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    const parsed = DateTime.fromISO(activeDate, { zone: 'utc' });
    if (parsed.isValid) {
      const monthStart = new Date(parsed.year, parsed.month - 1, 1);
      prefetchVisibleMonths(monthStart);
    }
  }, [activeDate, prefetchVisibleMonths]);

  const loadError = activeRecordStatus === 'error' ? activeRecord?.error ?? 'Unable to load availability for this date. Please try again.' : null;
  const isLoading = activeRecordStatus === 'loading';
  const activeDateLoaded = activeRecordStatus === 'success';

  const unavailabilityReason = useMemo<UnavailabilityReason | null>(() => {
    if (!activeDate) {
      return null;
    }
    const reasonFromMask = unavailableDates.get(activeDate);
    if (reasonFromMask) {
      return reasonFromMask;
    }
    if (activeRecordStatus === 'success') {
      return deriveScheduleUnavailability(currentSchedule);
    }
    return null;
  }, [activeDate, activeRecordStatus, currentSchedule, unavailableDates]);

  const intervalMinutes = currentSchedule?.intervalMinutes ?? DEFAULT_MINUTES_STEP;
  const slots = useMemo<TimeSlotDescriptor[]>(() => {
    if (!currentSchedule) {
      return [];
    }
    return currentSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  }, [currentSchedule]);

  const availableSlots = useMemo(
    () => slots.filter((slot) => !slot.disabled && hasCapacity(slot)),
    [slots],
  );
  const availableSlotValues = useMemo(
    () => new Set(availableSlots.map((slot) => slot.value)),
    [availableSlots],
  );

  useEffect(() => {
    if (!currentSchedule) {
      return;
    }

    if (selectedTime) {
      const hasSelected = availableSlots.some((slot) => slot.value === selectedTime);
      if (!hasSelected) {
        setTimeValidationError((prev) => prev ?? UNAVAILABLE_SELECTION_COPY);
        return;
      }
      selectionModeRef.current = 'initial';
      return;
    }

    if (availableSlots.length === 0) {
      setDraftTime('');
      setSelectedTime('');
      commitChange(activeDate, null);
      setTimeValidationError(null);
      return;
    }

    if (selectionModeRef.current === 'user-change') {
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
        setSelectedTime('');
        setDraftTime('');
        commitChange(formatted, null);
        onDateChange?.(formatted);
      }
      setActiveDate(formatted);
      setTimeValidationError(null);
    },
    [activeDate, commitChange, onDateChange],
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

      const snapped = snapTimeToInterval(normalized, intervalMinutes);
      const candidate = snapped ?? normalized;

      const isAvailable = availableSlots.some((slot) => slot.value === candidate);
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
      setDraftTime(candidate);
      setSelectedTime(candidate);
      commitChange(activeDate, candidate);
      selectionModeRef.current = 'initial';
      onBlur?.();
    },
    [activeDate, availableSlots, commitChange, intervalMinutes, onBlur, selectedTime],
  );

  const handleSlotSelect = useCallback(
    (value: string) => {
      setDraftTime(value);
      setSelectedTime(value);
      setTimeValidationError(null);
      commitChange(activeDate, value);
      selectionModeRef.current = 'initial';
      onBlur?.();
    },
    [activeDate, commitChange, onBlur],
  );

  const handleMonthPrefetch = useCallback(
    (month: Date) => {
      const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
      prefetchVisibleMonths(firstDay);
    },
    [prefetchVisibleMonths],
  );

  const isDateDisabled = useCallback(
    (date: Date) => {
      const key = formatDateForInput(date);
      const reason = unavailableDates.get(key);
      return reason === 'closed';
    },
    [unavailableDates],
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

  const isTimeDisabled = disabled || isLoading || !activeDateLoaded || availableSlots.length === 0;
  const availableCount = availableSlots.length;
  const selectedSlotDescriptor = useMemo(() => {
    if (!selectedTime) {
      return null;
    }
    return slots.find((slot) => slot.value === selectedTime) ?? null;
  }, [slots, selectedTime]);

  const visibleSlots = useMemo(() => {
    if (slots.length === 0) {
      return [];
    }
    return slots.map((slot) => {
      const isAvailable = availableSlotValues.has(slot.value);
      if (isAvailable) {
        return slot;
      }
      if (selectedSlotDescriptor && slot.value === selectedSlotDescriptor.value) {
        return {
          ...slot,
          disabled: false,
        };
      }
      return {
        ...slot,
        disabled: true,
      };
    });
  }, [availableSlotValues, selectedSlotDescriptor, slots]);

  const showTimeGrid = activeDateLoaded && visibleSlots.length > 0;

  const planSummary = useMemo(() => {
    if (selectedSlotDescriptor) {
      return `Time: ${selectedSlotDescriptor.display}`;
    }
    if (selectedTime) {
      return `Time: ${selectedTime}`;
    }
    if (isTimeDisabled) {
      return resolvedUnavailableMessage ?? 'Time not available';
    }
    return 'Time not selected';
  }, [isTimeDisabled, resolvedUnavailableMessage, selectedSlotDescriptor, selectedTime]);

  const accordionSummary = useMemo(() => {
    if (isPlanVariant) {
      return planSummary;
    }

    if (isLoading) {
      return 'Finding available times…';
    }

    const countCopy = `Showing ${availableCount} ${availableCount === 1 ? 'option' : 'options'}`;

    if (selectedSlotDescriptor) {
      if (availableCount === 0) {
        return `Selected ${selectedSlotDescriptor.display} • No other times available`;
      }
      return `Selected ${selectedSlotDescriptor.display} • ${countCopy}`;
    }

    if (isTimeDisabled) {
      return resolvedUnavailableMessage ?? 'No times available';
    }

    return countCopy;
  }, [
    availableCount,
    isLoading,
    isPlanVariant,
    isTimeDisabled,
    planSummary,
    resolvedUnavailableMessage,
    selectedSlotDescriptor,
  ]);

  const latestStartMinutes = useMemo(
    () => getLatestStartMinutes(currentSchedule),
    [currentSchedule],
  );

  useEffect(() => {
    if (!isTimeDisabled) {
      return;
    }
    if (activeDateLoaded && availableSlots.length === 0 && selectedSlotDescriptor) {
      return;
    }
    setTimeValidationError(null);
  }, [activeDateLoaded, availableSlots.length, isTimeDisabled, selectedSlotDescriptor]);

  const resolvedTimeErrorMessage = errorMessage ?? timeValidationError ?? undefined;

  const renderTimeContent = () => {
    const slotMessage = resolvedUnavailableMessage
      ?? (activeDateLoaded
        ? currentSchedule?.isClosed
          ? CLOSED_COPY
          : availableSlots.length === 0
            ? NO_SLOTS_COPY
            : unavailabilityReason === 'unknown'
              ? UNKNOWN_COPY
              : null
        : null);

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>Finding available times…</span>
        </div>
      );
    }

    if (loadError) {
      return <p className="text-sm text-destructive">{loadError}</p>;
    }

    if (!showTimeGrid) {
      if (slotMessage) {
        return (
          <div
            className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-4 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {slotMessage}
          </div>
        );
      }

      return null;
    }

    return (
      <>
        <TimeSlotGrid
          slots={visibleSlots}
          value={selectedTime}
          onSelect={handleSlotSelect}
          scrollToValue={selectedTime || null}
        />

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
      </>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-3">
        {label ? <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span> : null}
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/70 shadow-sm">
          <div className="grid gap-px bg-border/40 md:grid-cols-3">
            <div className="bg-card p-4">
              <Calendar24Date
                date={{
                  value: activeDate,
                  minDate: fallbackMinDate,
                  onSelect: handleDateSelect,
                  onBlur,
                  error: errorMessage ?? undefined,
                }}
                onMonthChange={handleMonthPrefetch}
                isDateUnavailable={isDateDisabled}
                loadingDates={loadingDates}
              />
            </div>

            {children ? (
              <div className="bg-card p-4">
                {children}
              </div>
            ) : null}

            <div className="bg-card p-4">
              <Calendar24Time
                time={{
                  value: draftTime,
                  onChange: handleTimeChange,
                  onBlur,
                  error: resolvedTimeErrorMessage,
                }}
                suggestions={availableSlots}
                intervalMinutes={intervalMinutes}
                isTimeDisabled={isTimeDisabled}
                unavailableMessage={resolvedUnavailableMessage}
              />
            </div>
          </div>
        </div>
      </div>
      {shouldUseAccordion ? (
        <Accordion
          type="single"
          collapsible
          className="overflow-hidden rounded-xl border border-border bg-muted/30 text-card-foreground"
        >
          <AccordionItem value="times">
            <AccordionTrigger className="flex flex-col items-start gap-1 text-left">
              <span id={timeAccordionHeadingId} className="text-base font-semibold text-foreground">
                {isPlanVariant ? 'Time options' : 'Available times'}
              </span>
            <span
              id={timeAccordionSummaryId}
              className="text-sm font-normal text-muted-foreground"
            >
              {accordionSummary}
            </span>
            </AccordionTrigger>
            <AccordionContent
              className="pt-4"
              aria-labelledby={`${timeAccordionHeadingId} ${timeAccordionSummaryId}`}
            >
              <div className="space-y-4">{renderTimeContent()}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        shouldUseScrollArea ? (
          <div
            className="max-h-72 space-y-4 overflow-y-auto pr-1 sm:max-h-80 sm:pr-2"
            role="region"
            aria-labelledby={timeRegionLabelId}
          >
            <span id={timeRegionLabelId} className="sr-only">
              Available time options
            </span>
            {renderTimeContent()}
          </div>
        ) : (
          <div className="space-y-4">{renderTimeContent()}</div>
        )
      )}
    </div>
  );
}
