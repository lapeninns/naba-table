'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { emit } from '@/lib/analytics/emit';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import {
  fetchCalendarMask,
  calendarMaskQueryKey,
  type CalendarMask,
} from '@reserve/features/reservations/wizard/services/schedule';
import {
  toTimeSlotDescriptor,
  type ReservationSchedule,
} from '@reserve/features/reservations/wizard/services/timeSlots';
import { isBookingOption } from '@reserve/shared/booking';
import { formatDateForInput, formatReservationDate } from '@reserve/shared/formatting/booking';
import { filterSelectableTimeSlots, isPastOrClosing } from '@reserve/shared/schedule/availability';
import { toMinutes } from '@reserve/shared/time';
import { isWeekend, toDateMidnight } from '@reserve/shared/time/date';

import { useWizardActions, useWizardState } from '../context/WizardContext';
import { planFormSchema, type PlanFormValues } from '../model/schemas';
import { useDebounce } from '../utils/debounce';

import type { BookingDetails, StepAction } from '../model/reducer';
import type {
  PlanStepFormProps,
  PlanStepFormState,
  PlanStepUnavailableReason,
} from '../ui/steps/plan-step/types';

const MONTH_KEY_FORMATTER = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const toMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const deriveUnavailableReason = (
  nextSchedule: ReservationSchedule | null,
  options?: { now?: Date },
): PlanStepUnavailableReason | null => {
  if (!nextSchedule) {
    return 'unknown';
  }
  if (nextSchedule.isClosed) {
    return 'closed';
  }
  const descriptors = nextSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  const selectableSlots = filterSelectableTimeSlots(descriptors, {
    date: nextSchedule.date,
    schedule: nextSchedule,
    now: options?.now,
  });
  return selectableSlots.length > 0 ? null : 'no-slots';
};

const isScheduleExhaustedByCurrentTime = (
  nextSchedule: ReservationSchedule | null,
  options?: { now?: Date },
): boolean => {
  if (!nextSchedule || nextSchedule.isClosed) {
    return false;
  }

  const zone = nextSchedule.timezone?.trim() || 'UTC';
  const reference = options?.now
    ? DateTime.fromJSDate(options.now, { zone })
    : DateTime.now().setZone(zone);
  if (!reference.isValid || reference.toISODate() !== nextSchedule.date) {
    return false;
  }

  const descriptors = nextSchedule.slots.map((slot) => toTimeSlotDescriptor(slot));
  const capacitySlots = descriptors.filter((slot) => !slot.disabled);
  if (capacitySlots.length === 0) {
    return false;
  }

  return (
    filterSelectableTimeSlots(capacitySlots, {
      date: nextSchedule.date,
      schedule: nextSchedule,
      now: options?.now,
    }).length === 0
  );
};

export const buildMonthPrefetchTargets = (
  value: Date | null | undefined,
  normalizedMinTimestamp: number,
): Date[] => {
  if (!value) {
    return [];
  }

  const monthStart = toMonthStart(value);
  const monthStarts: Date[] = [monthStart];

  const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  if (previousMonth.getTime() >= normalizedMinTimestamp) {
    monthStarts.push(previousMonth);
  }

  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  monthStarts.push(nextMonth);

  return monthStarts;
};

const parseDateKey = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number.parseInt(yearPart ?? '', 10);
  const month = Number.parseInt(monthPart ?? '', 10);
  const day = Number.parseInt(dayPart ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const next = new Date(year, month - 1, day);
  return Number.isNaN(next.getTime()) ? null : next;
};

export const findNextCandidateDate = (
  currentDate: string,
  unavailableDates: Map<string, PlanStepUnavailableReason>,
  options?: { skipNoSlots?: boolean },
): string | null => {
  let cursor = parseDateKey(currentDate);
  if (!cursor) {
    return null;
  }

  for (let i = 0; i < 60; i += 1) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const isoKey = formatDateForInput(cursor);
    const nextReason = unavailableDates.get(isoKey);

    if (nextReason === 'closed') {
      continue;
    }
    if (options?.skipNoSlots && nextReason === 'no-slots') {
      continue;
    }
    return isoKey;
  }

  return null;
};

export const PLAN_DATE_ADVISORY_COPY =
  'Weekend and holiday hours can vary. Contact the venue directly if you need to confirm availability before you travel.';

const automaticDateChangeMessage = (date: string) =>
  `That date is unavailable, so we moved you to ${formatReservationDate(date)}.`;

export function derivePlanDateAdvisory(
  date: string | null | undefined,
  overrideDates: Iterable<string> | null | undefined,
  operatingHoursNote?: string | null,
): string | null {
  const trimmedNote = operatingHoursNote?.trim();
  if (trimmedNote) {
    return trimmedNote;
  }

  if (!date) {
    return null;
  }

  let selectedDate: Date;
  try {
    selectedDate = toDateMidnight(date);
  } catch {
    return null;
  }

  const hasOverride = overrideDates ? new Set(Array.from(overrideDates)).has(date) : false;

  if (!isWeekend(selectedDate) && !hasOverride) {
    return null;
  }

  return PLAN_DATE_ADVISORY_COPY;
}

/**
 * Snap a `HH:mm` value to the nearest enabled interval boundary.
 *
 * Rounds to the nearest interval (not down) so a manual entry such as 19:08 with
 * a 15-minute interval resolves to 19:15 rather than silently dropping back to
 * 19:00. The result is clamped to `latestSelectableMinutes` when provided so the
 * snap can never land past the last selectable slot. Invalid input is returned
 * unchanged.
 */
export function normalizeTimeToInterval(
  value: string,
  intervalMinutes: number | null,
  latestSelectableMinutes: number | null,
): string {
  if (!value) {
    return '';
  }

  const [hoursPart, minutesPart] = value.split(':');
  const hours = Number.parseInt(hoursPart ?? '', 10);
  const minutes = Number.parseInt(minutesPart ?? '', 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0) {
    return value;
  }

  if (!intervalMinutes || intervalMinutes <= 0) {
    return value;
  }

  const totalMinutes = Math.max(0, hours * 60 + minutes);
  const cappedMinutes =
    typeof latestSelectableMinutes === 'number'
      ? Math.min(totalMinutes, latestSelectableMinutes)
      : totalMinutes;
  let normalizedMinutes = Math.round(cappedMinutes / intervalMinutes) * intervalMinutes;
  if (typeof latestSelectableMinutes === 'number' && normalizedMinutes > latestSelectableMinutes) {
    // Rounding up can overshoot the final slot; step back to the previous boundary.
    normalizedMinutes = Math.floor(cappedMinutes / intervalMinutes) * intervalMinutes;
  }
  const nextHours = Math.floor(normalizedMinutes / 60);
  const nextMinutes = normalizedMinutes % 60;

  return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
}

export const deriveMaskAvailability = (
  mask: CalendarMask,
  normalizedMinTimestamp: number,
): Map<string, PlanStepUnavailableReason | null> => {
  const results = new Map<string, PlanStepUnavailableReason | null>();

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

type UnavailableDateTrackingArgs = {
  restaurantSlug: string | null | undefined;
  date: string | null | undefined;
  minDate: Date;
  initialCalendarMask?: CalendarMask | null;
};

type UnavailableDateTrackingResult = {
  unavailableDates: Map<string, PlanStepUnavailableReason>;
  overrideDates: Set<string>;
  prefetchVisibleMonth: (value: Date | null | undefined) => void;
  updateUnavailableDate: (dateKey: string, reason: PlanStepUnavailableReason | null) => void;
  normalizedMinDate: Date;
  currentUnavailabilityReason: PlanStepUnavailableReason | null;
  loadingDates: Set<string>;
};

function useUnavailableDateTracking({
  restaurantSlug,
  date,
  minDate,
  initialCalendarMask,
}: UnavailableDateTrackingArgs): UnavailableDateTrackingResult {
  const queryClient = useQueryClient();
  const maskPrefetchedMonthsRef = useRef<Set<string>>(new Set());
  const activeMaskSlugRef = useRef<string | null>(restaurantSlug?.trim() || null);
  const [unavailableDates, setUnavailableDates] = useState<Map<string, PlanStepUnavailableReason>>(
    () => new Map(),
  );
  const unavailableDatesRef = useRef<Map<string, PlanStepUnavailableReason>>(new Map());
  const [overrideDates, setOverrideDates] = useState<Set<string>>(() => new Set());
  const [loadingDates, setLoadingDates] = useState<Set<string>>(() => new Set());

  const normalizedMinDate = useMemo(() => {
    const hasTime =
      minDate.getHours() !== 0 ||
      minDate.getMinutes() !== 0 ||
      minDate.getSeconds() !== 0 ||
      minDate.getMilliseconds() !== 0;

    if (!hasTime) {
      return minDate;
    }

    const normalized = new Date(minDate);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }, [minDate]);

  const normalizedMinTimestamp = useMemo(() => normalizedMinDate.getTime(), [normalizedMinDate]);

  const updateUnavailableDate = useCallback(
    (dateKey: string, reason: PlanStepUnavailableReason | null) => {
      const existingRefValue = unavailableDatesRef.current.get(dateKey) ?? null;
      if (existingRefValue === reason) {
        return;
      }

      setUnavailableDates((prev) => {
        const existing = prev.get(dateKey) ?? null;
        if (existing === reason) {
          return prev;
        }
        const nextMap = new Map(prev);
        if (reason) {
          nextMap.set(dateKey, reason);
        } else {
          nextMap.delete(dateKey);
        }
        unavailableDatesRef.current = nextMap;
        return nextMap;
      });
    },
    [],
  );

  const applyCalendarMask = useCallback(
    (mask: CalendarMask) => {
      deriveMaskAvailability(mask, normalizedMinTimestamp).forEach((reason, isoKey) => {
        updateUnavailableDate(isoKey, reason);
      });
      setOverrideDates((prev) => {
        const overrideDateKeys = mask.overrideDates ?? [];
        if (overrideDateKeys.length === 0) {
          return prev;
        }

        const next = new Set(prev);
        let changed = false;
        for (const dateKey of overrideDateKeys) {
          if (next.has(dateKey)) {
            continue;
          }
          next.add(dateKey);
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [normalizedMinTimestamp, updateUnavailableDate],
  );

  const prefetchCalendarMask = useCallback(
    (month: Date) => {
      const slug = restaurantSlug?.trim();
      if (!slug) {
        return;
      }
      const monthKey = MONTH_KEY_FORMATTER(month);
      if (maskPrefetchedMonthsRef.current.has(monthKey)) {
        return;
      }
      maskPrefetchedMonthsRef.current.add(monthKey);

      const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const fromKey = formatDateForInput(rangeStart);
      const toKey = formatDateForInput(rangeEnd);

      void queryClient
        .fetchQuery({
          queryKey: calendarMaskQueryKey(slug, fromKey, toKey),
          queryFn: ({ signal }) => fetchCalendarMask(slug, fromKey, toKey, signal),
          staleTime: 5 * 60_000,
        })
        .then((mask) => {
          if (activeMaskSlugRef.current !== slug) {
            return;
          }
          applyCalendarMask(mask);
        })
        .catch((error) => {
          if (activeMaskSlugRef.current === slug) {
            maskPrefetchedMonthsRef.current.delete(monthKey);
          }
          const isAbort =
            error instanceof DOMException
              ? error.name === 'AbortError'
              : typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                error.name === 'AbortError';
          const isSilent =
            typeof error === 'object' &&
            error !== null &&
            'silent' in error &&
            Boolean(error.silent);
          if (isAbort || isSilent) {
            return;
          }
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[plan-step] failed to fetch calendar mask', {
              restaurantSlug: slug,
              from: fromKey,
              to: toKey,
              error,
            });
          }
        });
    },
    [applyCalendarMask, queryClient, restaurantSlug],
  );

  useEffect(() => {
    if (!initialCalendarMask) {
      return;
    }
    const slug = restaurantSlug?.trim();
    if (!slug) {
      return;
    }
    const monthStart = DateTime.fromISO(initialCalendarMask.from, {
      zone: initialCalendarMask.timezone ?? 'UTC',
    });
    if (!monthStart.isValid) {
      return;
    }
    const jsMonthStart = new Date(monthStart.year, monthStart.month - 1, 1);
    const monthKey = MONTH_KEY_FORMATTER(jsMonthStart);
    if (maskPrefetchedMonthsRef.current.has(monthKey)) {
      return;
    }
    maskPrefetchedMonthsRef.current.add(monthKey);
    applyCalendarMask(initialCalendarMask);
  }, [applyCalendarMask, initialCalendarMask, restaurantSlug]);

  const prefetchVisibleMonth = useCallback(
    (value: Date | null | undefined) => {
      const slug = restaurantSlug?.trim();
      if (!value || !slug) {
        return;
      }

      buildMonthPrefetchTargets(value, normalizedMinTimestamp).forEach((month) => {
        prefetchCalendarMask(month);
      });
    },
    [normalizedMinTimestamp, prefetchCalendarMask, restaurantSlug],
  );

  useEffect(() => {
    const initialMonth = parseDateKey(date) ?? normalizedMinDate;
    prefetchVisibleMonth(initialMonth);
    const nextMonth = new Date(initialMonth.getFullYear(), initialMonth.getMonth() + 1, 1);
    prefetchVisibleMonth(nextMonth);
  }, [date, normalizedMinDate, prefetchVisibleMonth]);

  useEffect(() => {
    const nextSlug = restaurantSlug?.trim() || null;
    activeMaskSlugRef.current = nextSlug;
    maskPrefetchedMonthsRef.current.clear();
    setLoadingDates(new Set());
    const nextUnavailableDates = new Map<string, PlanStepUnavailableReason>();
    unavailableDatesRef.current = nextUnavailableDates;
    setUnavailableDates(nextUnavailableDates);
    setOverrideDates(new Set());
  }, [restaurantSlug]);

  const currentUnavailabilityReason = useMemo<PlanStepUnavailableReason | null>(() => {
    if (!date) {
      return null;
    }
    return unavailableDates.get(date) ?? null;
  }, [date, unavailableDates]);

  return {
    unavailableDates,
    overrideDates,
    prefetchVisibleMonth,
    updateUnavailableDate,
    normalizedMinDate,
    currentUnavailabilityReason,
    loadingDates,
  };
}

type PlanSlotDataArgs = {
  restaurantSlug: string | null | undefined;
  date: string | null | undefined;
  partySize: number;
  time: string | null | undefined;
};

type PlanSlotDataResult = {
  slots: ReturnType<typeof useTimeSlots>['slots'];
  inferBookingOption: ReturnType<typeof useTimeSlots>['inferBookingOption'];
  schedule: ReturnType<typeof useTimeSlots>['schedule'];
  isScheduleLoading: boolean;
  isScheduleFetching: boolean;
  enabledSlots: ReturnType<typeof useTimeSlots>['slots'];
  hasAvailableSlots: boolean;
  intervalMinutes: number | null;
  latestSelectableMinutes: number | null;
};

function usePlanSlotData({
  restaurantSlug,
  date,
  partySize,
  time,
}: PlanSlotDataArgs): PlanSlotDataResult {
  const {
    slots,
    inferBookingOption,
    schedule,
    isLoading: isScheduleLoading,
    isFetching: isScheduleFetching,
  } = useTimeSlots({
    restaurantSlug,
    date,
    partySize,
    selectedTime: time,
  });

  const selectableSlots = useMemo(() => {
    if (!date || !schedule) {
      return slots.filter((slot) => !slot.disabled);
    }
    return filterSelectableTimeSlots(slots, { date, schedule });
  }, [date, schedule, slots]);

  const enabledSlots = selectableSlots;
  const hasAvailableSlots = enabledSlots.length > 0;
  const intervalMinutes =
    typeof schedule?.intervalMinutes === 'number' && schedule.intervalMinutes > 0
      ? schedule.intervalMinutes
      : null;
  const latestSelectableMinutes =
    schedule?.slots.reduce<number | null>((latest, slot) => {
      const candidate = toMinutes(slot.value);
      return latest === null ? candidate : Math.max(latest, candidate);
    }, null) ?? null;

  return {
    slots: selectableSlots,
    inferBookingOption,
    schedule,
    isScheduleLoading,
    isScheduleFetching,
    enabledSlots,
    hasAvailableSlots,
    intervalMinutes,
    latestSelectableMinutes,
  };
}

export function usePlanStepForm({
  state: providedState,
  actions: providedActions,
  onActionsChange,
  onTrack,
  minDate,
  initialCalendarMask,
}: PlanStepFormProps): PlanStepFormState {
  const contextState = useWizardState();
  const contextActions = useWizardActions();
  const state = providedState ?? contextState;
  const actions = providedActions ?? contextActions;
  if (!state || !actions) {
    throw new Error(
      'usePlanStepForm requires explicit state/actions props or a WizardProvider ancestor.',
    );
  }
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    mode: 'onChange',
    reValidateMode: 'onBlur',
    defaultValues: {
      date: state.details.date ?? '',
      time: state.details.time ?? '',
      party: state.details.party ?? 1,
      bookingType: state.details.bookingType,
      notes: state.details.notes ?? '',
    },
  });
  const initialPrefetchSlugRef = useRef<string | null>(null);
  const [dateChangeMessage, setDateChangeMessage] = useState<string | null>(null);

  const {
    unavailableDates,
    overrideDates,
    prefetchVisibleMonth,
    updateUnavailableDate,
    normalizedMinDate,
    currentUnavailabilityReason,
    loadingDates,
  } = useUnavailableDateTracking({
    restaurantSlug: state.details.restaurantSlug,
    date: state.details.date,
    minDate,
    initialCalendarMask,
  });
  const effectiveUnavailableDates = useMemo(() => {
    if (!initialCalendarMask) {
      return unavailableDates;
    }
    const next = new Map(unavailableDates);
    deriveMaskAvailability(initialCalendarMask, normalizedMinDate.getTime()).forEach(
      (reason, dateKey) => {
        if (reason) next.set(dateKey, reason);
      },
    );
    return next;
  }, [initialCalendarMask, normalizedMinDate, unavailableDates]);

  useEffect(() => {
    const slug = state.details.restaurantSlug?.trim();
    if (!slug) {
      return;
    }
    if (initialPrefetchSlugRef.current === slug) {
      return;
    }
    const initialMonth = parseDateKey(state.details.date) ?? normalizedMinDate;
    prefetchVisibleMonth(initialMonth);
    initialPrefetchSlugRef.current = slug;
  }, [normalizedMinDate, prefetchVisibleMonth, state.details.date, state.details.restaurantSlug]);

  useEffect(() => {
    const currentDate = state.details.date;
    if (!currentDate) {
      return;
    }

    const isDirty = form.getFieldState('date').isDirty;
    if (isDirty) {
      return;
    }

    const reason = effectiveUnavailableDates.get(currentDate);
    if (reason !== 'closed') {
      return;
    }

    const nextDate = findNextCandidateDate(currentDate, effectiveUnavailableDates);
    if (nextDate) {
      form.setValue('date', nextDate, { shouldDirty: false, shouldValidate: true });
      actions.updateDetails('date', nextDate);
      setDateChangeMessage(automaticDateChangeMessage(nextDate));
    }
  }, [actions, effectiveUnavailableDates, form, state.details.date]);

  const {
    slots,
    inferBookingOption,
    schedule,
    isScheduleLoading,
    isScheduleFetching,
    enabledSlots,
    hasAvailableSlots,
    intervalMinutes,
    latestSelectableMinutes,
  } = usePlanSlotData({
    restaurantSlug: state.details.restaurantSlug,
    date: state.details.date,
    partySize: state.details.party ?? 1,
    time: state.details.time,
  });

  const debouncedPrefetch = useDebounce(prefetchVisibleMonth, 300);
  const advisoryMessage = useMemo(
    () => derivePlanDateAdvisory(state.details.date, overrideDates, schedule?.notes),
    [overrideDates, schedule?.notes, state.details.date],
  );

  const lastValidDateRef = useRef<string | null>(state.details.date ?? null);
  const detailsRef = useRef(state.details);

  useEffect(() => {
    detailsRef.current = state.details;
  }, [state.details]);

  useEffect(() => {
    form.reset(
      {
        date: state.details.date ?? '',
        time: state.details.time ?? enabledSlots[0]?.value ?? '',
        party: state.details.party ?? 1,
        bookingType: state.details.bookingType,
        notes: state.details.notes ?? '',
      },
      { keepDirty: false, keepTouched: false },
    );
  }, [
    form,
    state.details.date,
    state.details.time,
    state.details.party,
    state.details.bookingType,
    state.details.notes,
    enabledSlots,
  ]);

  const updateField = useCallback(
    <K extends keyof BookingDetails>(key: K, value: BookingDetails[K]) => {
      if (detailsRef.current[key] === value) {
        return;
      }
      actions.updateDetails(key, value);
    },
    [actions],
  );

  const fallbackTime = enabledSlots[0]?.value ?? '';

  useEffect(() => {
    if (!state.details.time && fallbackTime) {
      updateField('time', fallbackTime);
      form.setValue('time', fallbackTime, { shouldDirty: false, shouldValidate: true });
    }
  }, [fallbackTime, form, state.details.time, updateField]);

  const normalizeToInterval = useCallback(
    (value: string) => normalizeTimeToInterval(value, intervalMinutes, latestSelectableMinutes),
    [intervalMinutes, latestSelectableMinutes],
  );

  const submitForm = useCallback(
    (values: PlanFormValues) => {
      const normalizedTime = normalizeToInterval(values.time);
      if (
        values.date &&
        schedule &&
        isPastOrClosing({ date: values.date, time: normalizedTime, schedule })
      ) {
        form.setError('time', {
          type: 'manual',
          message: 'Please pick a time in the future.',
        });
        return;
      }
      const bookingTypeValue = isBookingOption(values.bookingType)
        ? values.bookingType
        : (inferBookingOption(normalizedTime) ?? state.details.bookingType);

      updateField('date', values.date);
      updateField('time', normalizedTime);
      updateField('party', values.party);
      updateField('bookingType', bookingTypeValue);
      updateField('notes', values.notes ?? '');
      form.setValue('bookingType', bookingTypeValue, {
        shouldDirty: false,
        shouldValidate: false,
      });
      form.setValue('time', normalizedTime, { shouldDirty: false, shouldValidate: true });
      actions.goToStep(2);
    },
    [
      actions,
      form,
      inferBookingOption,
      normalizeToInterval,
      schedule,
      state.details.bookingType,
      updateField,
    ],
  );

  const handleError = useCallback(
    (errors: Record<string, unknown>) => {
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        form.setFocus(firstKey as keyof PlanFormValues, { shouldSelect: true });
      }
    },
    [form],
  );

  const selectDate = useCallback(
    (value: Date | undefined | null) => {
      setDateChangeMessage(null);
      const formatted = value ? formatDateForInput(value) : '';
      form.setValue('date', formatted, { shouldDirty: true, shouldValidate: true });
      updateField('date', formatted);
      if (formatted) {
        onTrack?.('select_date', { date: formatted });
      }
      if (!formatted) {
        form.setValue('time', '', { shouldDirty: true, shouldValidate: true });
        updateField('time', '');
      }
    },
    [form, onTrack, updateField],
  );

  const selectTime = useCallback(
    (value: string, options?: { commit?: boolean }) => {
      if (!hasAvailableSlots) {
        form.setValue('time', '', { shouldDirty: true, shouldValidate: true });
        updateField('time', '');
        return;
      }

      if (options?.commit === false) {
        form.setValue('time', value, { shouldDirty: true, shouldValidate: false });
        return;
      }

      const selectedDate = form.getValues('date') || state.details.date;
      if (
        selectedDate &&
        schedule &&
        isPastOrClosing({ date: selectedDate, time: value, schedule })
      ) {
        form.setError('time', {
          type: 'manual',
          message: 'Please pick a time in the future.',
        });
        return;
      }

      const normalized = normalizeToInterval(value);
      form.setValue('time', normalized, { shouldDirty: true, shouldValidate: true });
      updateField('time', normalized);

      const inferredService = inferBookingOption(normalized);
      form.setValue('bookingType', inferredService, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', inferredService);

      onTrack?.('select_time', {
        time: normalized,
        booking_type: inferredService,
      });
    },
    [
      form,
      hasAvailableSlots,
      inferBookingOption,
      normalizeToInterval,
      onTrack,
      schedule,
      state.details.date,
      updateField,
    ],
  );

  const changeParty = useCallback(
    (direction: 'decrement' | 'increment') => {
      const current = form.getValues('party');
      const next =
        direction === 'decrement'
          ? Math.max(MIN_ONLINE_PARTY_SIZE, current - 1)
          : Math.min(MAX_ONLINE_PARTY_SIZE, current + 1);
      form.setValue('party', next, { shouldDirty: true, shouldValidate: true });
      updateField('party', next);
      onTrack?.('select_party', { party: next });
    },
    [form, onTrack, updateField],
  );

  const commitNotes = useCallback(
    (value: string) => {
      updateField('notes', value ?? '');
    },
    [updateField],
  );

  useEffect(() => {
    if (!schedule) {
      return;
    }

    const scheduleDate = schedule.date;
    const derivedReason = deriveUnavailableReason(schedule);

    updateUnavailableDate(scheduleDate, derivedReason);

    const isCurrentDate = scheduleDate === state.details.date;

    if (derivedReason) {
      if (derivedReason === 'closed') {
        emit('selection.blocked.closed', {
          restaurantSlug: state.details.restaurantSlug,
          date: scheduleDate,
        });
      }
      if (isCurrentDate) {
        if (derivedReason === 'no-slots' && isScheduleExhaustedByCurrentTime(schedule)) {
          const nextDate = findNextCandidateDate(scheduleDate, effectiveUnavailableDates, {
            skipNoSlots: true,
          });
          if (nextDate) {
            form.clearErrors(['date', 'time']);
            form.setValue('date', nextDate, { shouldDirty: false, shouldValidate: true });
            form.setValue('time', '', { shouldDirty: false, shouldValidate: true });
            updateField('date', nextDate);
            updateField('time', '');
            setDateChangeMessage(automaticDateChangeMessage(nextDate));
            return;
          }
        }

        const fallbackDate = lastValidDateRef.current;
        if (fallbackDate && fallbackDate !== scheduleDate) {
          form.setValue('date', fallbackDate, { shouldDirty: true, shouldValidate: true });
          updateField('date', fallbackDate);
        } else if (!fallbackDate) {
          form.setValue('date', '', { shouldDirty: true, shouldValidate: true });
          updateField('date', '');
        }

        if (form.getValues('time')) {
          form.setValue('time', '', { shouldDirty: true, shouldValidate: true });
          updateField('time', '');
        }

        const dateMessage =
          derivedReason === 'closed'
            ? 'We’re closed on the selected date. Please choose a different day.'
            : derivedReason === 'no-slots'
              ? 'No reservation times are available for the selected date. Please choose another day.'
              : 'We couldn’t load availability for this date. Please choose another day.';
        form.setError('date', { type: 'manual', message: dateMessage });
        form.setError('time', {
          type: 'manual',
          message: 'Select another date to continue.',
        });
      }
      return;
    }

    if (isCurrentDate) {
      form.clearErrors(['date', 'time']);
      lastValidDateRef.current = scheduleDate;

      const currentTime = form.getValues('time');
      const hasCurrentSlot =
        currentTime && enabledSlots.some((slot) => slot.value === currentTime && !slot.disabled);

      if (!hasCurrentSlot) {
        const nextSlot = enabledSlots[0]?.value ?? '';
        if (nextSlot) {
          form.setValue('time', nextSlot, { shouldDirty: false, shouldValidate: true });
          updateField('time', nextSlot);
          const inferredService = inferBookingOption(nextSlot);
          form.setValue('bookingType', inferredService, {
            shouldDirty: false,
            shouldValidate: true,
          });
          updateField('bookingType', inferredService);
        } else if (form.getValues('time')) {
          form.setValue('time', '', { shouldDirty: true, shouldValidate: true });
          updateField('time', '');
        }
      }
    } else if (!derivedReason && !schedule.isClosed) {
      lastValidDateRef.current = scheduleDate;
    }
  }, [
    enabledSlots,
    form,
    inferBookingOption,
    schedule,
    state.details.date,
    state.details.restaurantSlug,
    effectiveUnavailableDates,
    updateField,
    updateUnavailableDate,
  ]);

  useEffect(() => {
    const duration =
      slots.find((slot) => slot.value === state.details.time)?.durationMinutes ??
      schedule?.defaultDurationMinutes;
    if (!duration || duration <= 0) {
      return;
    }
    if (state.details.reservationDurationMinutes === duration) {
      return;
    }
    updateField('reservationDurationMinutes', duration);
  }, [
    schedule?.defaultDurationMinutes,
    slots,
    state.details.reservationDurationMinutes,
    state.details.time,
    updateField,
  ]);

  useEffect(() => {
    const scheduleRestaurantId = schedule?.restaurantId?.trim();
    const scheduleTimezone = schedule?.timezone?.trim();

    if (scheduleRestaurantId) {
      updateField('restaurantId', scheduleRestaurantId);
    }

    if (scheduleTimezone) {
      updateField('restaurantTimezone', scheduleTimezone);
    }
  }, [schedule?.restaurantId, schedule?.timezone, updateField]);

  const handleContinue = useCallback(() => {
    form.handleSubmit(submitForm, handleError)();
  }, [form, handleError, submitForm]);

  const prefetchMonth = useCallback(
    (month: Date) => {
      debouncedPrefetch(month);
    },
    [debouncedPrefetch],
  );

  const planStepActions = useMemo<StepAction[]>(
    () => [
      {
        id: 'plan-continue',
        label: 'Continue',
        icon: 'ChevronDown',
        variant: 'default',
        disabled: form.formState.isSubmitting || !form.formState.isValid || !hasAvailableSlots,
        loading: form.formState.isSubmitting,
        onClick: handleContinue,
        role: 'primary',
      },
    ],
    [form.formState.isSubmitting, form.formState.isValid, handleContinue, hasAvailableSlots],
  );

  useEffect(() => {
    onActionsChange(planStepActions);
  }, [onActionsChange, planStepActions]);

  return {
    form,
    slots,
    handlers: {
      selectDate,
      selectTime,
      changeParty,
      commitNotes,
      prefetchMonth,
    },
    minDate: normalizedMinDate,
    intervalMinutes,
    unavailableDates: effectiveUnavailableDates,
    loadingDates,
    hasAvailableSlots,
    isScheduleLoading,
    isScheduleFetching,
    schedule,
    currentUnavailabilityReason,
    advisoryMessage,
    dateChangeMessage,
    isSubmitting: form.formState.isSubmitting,
    isValid: form.formState.isValid,
    submitForm,
    handleError,
  } as const;
}
