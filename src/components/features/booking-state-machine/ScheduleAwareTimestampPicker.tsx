"use client";

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';

import { cn } from '@/lib/utils';
import { fetchReservationSchedule, scheduleQueryKey } from '@reserve/features/reservations/wizard/services/schedule';
import { toTimeSlotDescriptor, type ReservationSchedule, type TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services/timeSlots';
import { Calendar24Field, TimeSlotGrid } from '@reserve/features/reservations/wizard/ui/steps/plan-step/components';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import {
  getDisabledDays as buildDisabledDayMap,
  getLatestStartMinutes,
  hasCapacity,
  isDateUnavailable as resolveDateUnavailability,
  isPastOrClosing,
  type UnavailabilityReason,
} from '@reserve/shared/schedule/availability';
import { normalizeTime } from '@reserve/shared/time';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';

type DisabledReasonState = Map<string, UnavailabilityReason>;

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
}: ScheduleAwareTimestampPickerProps) {
  const timeRegionLabelId = useId();
  const timeAccordionHeadingId = useId();
  const timeAccordionSummaryId = useId();
  const queryClient = useQueryClient();

  const [scheduleStateByDate, setScheduleStateByDate] = useState<Map<string, ScheduleRecord>>(() => new Map());
  const scheduleStateRef = useRef(scheduleStateByDate);
  const selectionModeRef = useRef<'initial' | 'user-change'>('initial');

  const fallbackMinDate = useMemo(() => toStartOfDay(minDate ?? new Date()), [minDate]);
  const normalizedMinDate = useMemo(() => toStartOfDay(fallbackMinDate), [fallbackMinDate]);

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
  const prefetchedMonthsRef = useRef<Set<string>>(new Set());
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

  const scheduleCollection = useMemo(() => {
    const map = new Map<string, ReservationSchedule | null>();
    scheduleStateByDate.forEach((record, key) => {
      map.set(key, record.schedule);
    });
    return map;
  }, [scheduleStateByDate]);

  const disabledDays = useMemo(() => buildDisabledDayMap(scheduleCollection), [scheduleCollection]);

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
    prefetchedMonthsRef.current.clear();
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
        return null;
      }
    },
    [queryClient, restaurantSlug],
  );

  const prefetchSurroundingDates = useCallback(
    (dateKey: string, span = 2) => {
      const base = DateTime.fromISO(dateKey, { zone: 'utc' });
      if (!base.isValid) {
        return;
      }
      for (let offset = -span; offset <= span; offset += 1) {
        if (offset === 0) continue;
        const nextKey = base.plus({ days: offset }).toISODate();
        if (nextKey) {
          void loadSchedule(nextKey, { prefetched: true });
        }
      }
    },
    [loadSchedule],
  );

  const prefetchMonth = useCallback(
    (monthStart: Date) => {
      const slug = restaurantSlug?.trim();
      if (!slug) {
        return;
      }
      const monthKey = MONTH_KEY_FORMATTER(monthStart);
      if (prefetchedMonthsRef.current.has(monthKey)) {
        return;
      }
      prefetchedMonthsRef.current.add(monthKey);
      const dateKeys = buildMonthDateKeys(monthStart, normalizedMinDate);
      dateKeys.forEach((dateKey) => {
        void loadSchedule(dateKey, { prefetched: true });
      });
    },
    [loadSchedule, normalizedMinDate, restaurantSlug],
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
    if (activeRecordStatus !== 'success') {
      return;
    }
    const parsed = DateTime.fromISO(activeDate, { zone: 'utc' });
    if (parsed.isValid) {
      prefetchSurroundingDates(activeDate);
      const monthStart = new Date(parsed.year, parsed.month - 1, 1);
      prefetchMonth(monthStart);
    }
  }, [activeDate, activeRecordStatus, prefetchMonth, prefetchSurroundingDates]);

  const loadError = activeRecordStatus === 'error' ? activeRecord?.error ?? 'Unable to load availability for this date. Please try again.' : null;
  const isLoading = activeRecordStatus === 'loading';
  const activeDateLoaded = activeRecordStatus === 'success';

  const rawUnavailabilityReason = useMemo<UnavailabilityReason | null>(() => {
    if (!activeDate) {
      return null;
    }
    return resolveDateUnavailability(activeDate, scheduleCollection);
  }, [activeDate, scheduleCollection]);

  const unavailabilityReason = activeDateLoaded ? rawUnavailabilityReason : null;

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

      const isAvailable = availableSlots.some((slot) => slot.value === normalized);
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
      selectionModeRef.current = 'initial';
      onBlur?.();
    },
    [activeDate, availableSlots, commitChange, onBlur, selectedTime],
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
      prefetchMonth(firstDay);
    },
    [prefetchMonth],
  );

  const isDateDisabled = useCallback(
    (date: Date) => {
      const key = formatDateForInput(date);
      const reason = disabledDays.get(key);
      if (reason === 'unknown') {
        return true;
      }
      const resolved = resolveDateUnavailability(key, scheduleCollection);
      return resolved === 'unknown';
    },
    [disabledDays, scheduleCollection],
  );

  const resolvedUnavailableMessage = useMemo(() => {
    if (!activeDateLoaded) {
      return undefined;
    }
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
  }, [activeDateLoaded, unavailabilityReason]);

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

  const accordionSummary = useMemo(() => {
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
  }, [availableCount, isLoading, isTimeDisabled, resolvedUnavailableMessage, selectedSlotDescriptor]);

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
          suggestions={availableSlots}
          intervalMinutes={intervalMinutes}
          isDateUnavailable={isDateDisabled}
          isTimeDisabled={isTimeDisabled}
          unavailableMessage={resolvedUnavailableMessage}
          onMonthChange={handleMonthPrefetch}
        />
      </div>
      {timeAccordion ? (
        <Accordion
          type="single"
          collapsible
          className="overflow-hidden rounded-xl border border-border bg-muted/30 text-card-foreground"
          defaultValue={isTimeDisabled ? undefined : 'times'}
        >
          <AccordionItem value="times">
            <AccordionTrigger className="flex flex-col items-start gap-1 text-left">
              <span id={timeAccordionHeadingId} className="text-base font-semibold text-foreground">
                Available times
              </span>
              <span
                id={timeAccordionSummaryId}
                className="text-sm font-normal text-muted-foreground"
              >
                {accordionSummary}
              </span>
            </AccordionTrigger>
            <AccordionContent
              forceMount
              className="pt-4"
              aria-labelledby={`${timeAccordionHeadingId} ${timeAccordionSummaryId}`}
            >
              <div className="space-y-4">{renderTimeContent()}</div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        timeScrollArea ? (
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
