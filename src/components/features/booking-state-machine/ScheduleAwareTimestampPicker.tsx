"use client";

import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  calendarMaskQueryKey,
  fetchCalendarMask,
  fetchReservationSchedule,
  scheduleQueryKey,
  type CalendarMask,
} from '@reserve/features/reservations/wizard/services/schedule';
import {
  toTimeSlotDescriptor,
  type RawScheduleSlot,
  type ReservationSchedule,
  type TimeSlotDescriptor,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { Calendar24Date, Calendar24Time } from '@reserve/features/reservations/wizard/ui/steps/plan-step/components';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { getLatestStartMinutes, hasCapacity, type UnavailabilityReason } from '@reserve/shared/schedule/availability';
import { MINUTES_PER_DAY, normalizeTime, toMinutes } from '@reserve/shared/time';



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
  /** When editing a booking of a specific type (e.g. 'lunch'), filter slots where this service is enabled */
  targetService?: string | null;

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
const OVERRIDE_SELECTION_COPY =
  'There are no regular slots for this date at this time, but you can still save changes to override availability.';

/**
 * Build a full 15m grid (or schedule interval) from opening → latest allowed start,
 * filling in missing slots so edit flows don't "lose" times when booking_slots is sparse.
 */
const mergeWithSyntheticSlots = (schedule: ReservationSchedule | null): ReservationSchedule | null => {
  if (!schedule || schedule.isClosed) {
    return schedule;
  }

  const interval = Number.isFinite(schedule.intervalMinutes) && schedule.intervalMinutes > 0
    ? schedule.intervalMinutes
    : DEFAULT_MINUTES_STEP;

  const opensAt = normalizeTime(schedule.window?.opensAt ?? null);
  const closesAt = normalizeTime(schedule.window?.closesAt ?? null);
  if (!opensAt || !closesAt) {
    return schedule;
  }

  const openingMinutes = toMinutes(opensAt);
  const closingMinutes = toMinutes(closesAt);
  const guardMinutes = Math.max(0, schedule.lastSeatingBufferMinutes ?? 0, schedule.defaultDurationMinutes ?? 0);
  const latestStartMinutes = Math.max(0, closingMinutes - guardMinutes);
  if (openingMinutes >= latestStartMinutes) {
    return schedule;
  }

  const existingByValue = new Map(schedule.slots.map((slot) => [slot.value, slot]));
  const defaultBookingOption = schedule.availableBookingOptions[0] ?? schedule.slots[0]?.bookingOption ?? 'lunch';

  const synthetic: RawScheduleSlot[] = [];
  for (let m = openingMinutes; m <= latestStartMinutes; m += interval) {
    const hours = Math.floor(m / 60);
    const minutes = m % 60;
    const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    if (existingByValue.has(value)) {
      continue;
    }
    // Synthetic slots are always disabled so out-of-period gaps never become selectable.
    synthetic.push({
      value,
      display: value,
      periodId: null,
      periodName: null,
      bookingOption: defaultBookingOption,
      defaultBookingOption,
      availability: {
        services: {},
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: false,
        },
      },
      disabled: true,
    });
  }

  if (synthetic.length === 0) {
    return schedule;
  }

  const mergedSlots = [...schedule.slots, ...synthetic].sort((a, b) => a.value.localeCompare(b.value));
  return { ...schedule, slots: mergedSlots };
};

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

/**
 * Allow manual time selection even when the schedule API omits specific slots.
 * Treat a time as eligible if it falls inside the venue's operating window (opensAt → latest start).
 */
const isWithinScheduleWindow = (
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
  const latestAllowed = typeof latestStartMinutes === 'number' ? latestStartMinutes : closingMinutes;

  return minutes >= openingMinutes && minutes <= latestAllowed;
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
  targetService,
  children,
}: ScheduleAwareTimestampPickerProps) {
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

      const record = dateKey ? scheduleStateRef.current.get(dateKey) ?? null : null;
      const schedule = record?.schedule ?? null;
      const timezone = schedule?.timezone ?? scheduleTimezone;
      const iso = toIsoString(dateKey, timeValue, timezone);
      onChange(iso);
    },
    [onChange, scheduleTimezone],
  );

  useEffect(() => {
    // Don't override user's in-progress date selection when parent re-renders
    // (e.g., when party size changes). Only sync when we're in 'initial' mode.
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
      parts.date && parts.time ? `${parts.date}|${parts.time}` : parts.date ? `${parts.date}|null` : null;
  }, [scheduleTimezone, value]);

  useEffect(() => {
    // Don't reset if user is mid-edit - this prevents the cascade where:
    // 1. User selects new date → mode='user-change'
    // 2. This effect runs (because initialDate changed due to parent form reset)
    // 3. Effect sets mode='initial', wiping user's selection
    // 4. Value sync effect then overrides with old date
    const slugKey = restaurantSlug ?? null;
    const dateKey = initialDate;
    const prev = resetSignatureRef.current;
    const hasSlugChanged = prev.slug !== slugKey;
    const hasDateChanged = prev.date !== dateKey;

    // Only guard if user is mid-edit AND the change is trivial (same slug, same initial date)
    // This allows the effect to run on dialog open, but prevents it from running when
    // user changes party size (which doesn't change slug or initialDate)
    if (selectionModeRef.current === 'user-change' && !hasSlugChanged && !hasDateChanged) {
      return;
    }

    resetSignatureRef.current = { slug: slugKey, date: dateKey };

    if (!hasSlugChanged && !hasDateChanged) {
      return;
    }

    // FIX: If the new confirmed date matches what we're already currently viewing/fetching,
    // don't wipe the schedule state. This prevents the "flash of content" bug where
    // valid slots are cleared just because the parent form verified the new date.
    if (!hasSlugChanged && dateKey === activeDate) {
      lastCommittedRef.current = lastCommittedInitial;
      selectionModeRef.current = 'initial';
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
  }, [initialDate, initialTime, lastCommittedInitial, restaurantSlug, activeDate]);

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
        const enriched = mergeWithSyntheticSlots(schedule);

        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          next.set(dateKey, {
            status: 'success',
            schedule: enriched,
            error: null,
          });
          return next;
        });
        const derivedReason = deriveScheduleUnavailability(enriched);
        updateUnavailableDate(dateKey, derivedReason);
        return enriched;
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
    () =>
      slots.filter((slot) => {
        if (slot.disabled) {
          return false;
        }
        // If targetService is specified (e.g., editing a 'lunch' booking),
        // check if that specific service is enabled on this slot
        if (targetService) {
          const services = slot.availability?.services ?? {};
          return services[targetService] !== 'disabled';
        }
        // Otherwise use default hasCapacity check
        return hasCapacity(slot);
      }),
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
      const hasSelected = availableSlots.some((slot) => slot.value === selectedTime);
      const hasAnySlots = availableSlots.length > 0;
      const withinWindow = isWithinScheduleWindow(selectedTime, currentSchedule);
      if (!hasSelected) {
        if (withinWindow) {
          setTimeValidationError(null);
        } else {
          const message = hasAnySlots ? UNAVAILABLE_SELECTION_COPY : OVERRIDE_SELECTION_COPY;
          setTimeValidationError((prev) => prev ?? message);
        }
      } else {
        setTimeValidationError(null);
      }
      // For edit flows, always commit the user-selected time on the current
      // date, even if it no longer appears in enabled slots. This lets ops
      // override availability while still surfacing a warning.
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

    // Auto-select first available slot (runs even in 'user-change' mode after date selection)
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

      // When schedule is still loading (or absent), allow provisional selection without blocking.
      if (isScheduleLoading || !currentSchedule) {
        setTimeValidationError(null);
        setDraftTime(candidate);
        setSelectedTime(candidate);
        commitChange(activeDate, candidate);
        selectionModeRef.current = 'initial';
        onBlur?.();
        return;
      }

      const isAvailable = availableSlots.some((slot) => slot.value === candidate);
      const withinWindow = isWithinScheduleWindow(candidate, currentSchedule);
      if (!isAvailable) {
        if (withinWindow) {
          setTimeValidationError(null);
          setDraftTime(candidate);
          setSelectedTime(candidate);
          commitChange(activeDate, candidate);
          selectionModeRef.current = 'initial';
          onBlur?.();
          return;
        }
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
    [activeDate, availableSlots, commitChange, currentSchedule, intervalMinutes, isScheduleLoading, onBlur, selectedTime],
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

  const isTimeDisabled = disabled;

  // Provide a concrete message whenever the time picker is disabled so the input can clear
  // stale values in lockstep with the "No available times" UI.
  const unavailableMessageForTime = resolvedUnavailableMessage ?? (isTimeDisabled ? 'No available times for the selected date.' : undefined);





  const resolvedTimeErrorMessage = errorMessage ?? timeValidationError ?? undefined;

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
                isTimeLoading={isScheduleLoading}
                unavailableMessage={unavailableMessageForTime}
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
