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
import { isBookingOption } from '@reserve/shared/booking';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
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
  nextSchedule: { isClosed: boolean; slots: { disabled: boolean }[] } | null,
): PlanStepUnavailableReason | null => {
  if (!nextSchedule) {
    return 'unknown';
  }
  if (nextSchedule.isClosed) {
    return 'closed';
  }
  const hasEnabledSlot = nextSchedule.slots.some((slot) => !slot.disabled);
  return hasEnabledSlot ? null : 'no-slots';
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

export const PLAN_DATE_ADVISORY_COPY =
  'Weekend and holiday hours can vary. Contact the venue directly if you need to confirm availability before you travel.';

export function derivePlanDateAdvisory(
  date: string | null | undefined,
  overrideDates: Iterable<string> | null | undefined,
): string | null {
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
  const [unavailableDates, setUnavailableDates] = useState<Map<string, PlanStepUnavailableReason>>(
    () => new Map(),
  );
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
        const next = new Set(prev);
        for (const dateKey of mask.overrideDates ?? []) {
          next.add(dateKey);
        }
        return next;
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
          applyCalendarMask(mask);
        })
        .catch((error) => {
          maskPrefetchedMonthsRef.current.delete(monthKey);
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
    maskPrefetchedMonthsRef.current.clear();
    setLoadingDates(new Set());
    setUnavailableDates(new Map());
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

function usePlanSlotData({ restaurantSlug, date, time }: PlanSlotDataArgs): PlanSlotDataResult {
  const {
    slots,
    inferBookingOption,
    schedule,
    isLoading: isScheduleLoading,
    isFetching: isScheduleFetching,
  } = useTimeSlots({
    restaurantSlug,
    date,
    selectedTime: time,
  });

  const enabledSlots = useMemo(() => slots.filter((slot) => !slot.disabled), [slots]);
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
    slots,
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

    const reason = unavailableDates.get(currentDate);
    if (reason !== 'closed') {
      return;
    }

    // Auto-advance to next available date
    let cursor = parseDateKey(currentDate);
    if (!cursor) {
      return;
    }

    // Limit search to 60 days to avoid infinite loops
    for (let i = 0; i < 60; i += 1) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      const isoKey = formatDateForInput(cursor);
      const nextReason = unavailableDates.get(isoKey);

      // If we don't have data for this date yet (undefined), we assume it might be open
      // or wait for mask to load. However, since we prefetch masks, undefined usually means
      // out of range or not yet loaded.
      // But if we are within the prefetched range, undefined means "open".
      // To be safe, we only switch if we explicitly know it is NOT closed.
      // If nextReason is undefined, it effectively means "not closed" in the current mask logic.

      if (nextReason !== 'closed') {
        form.setValue('date', isoKey, { shouldDirty: false, shouldValidate: true });
        actions.updateDetails('date', isoKey);
        break;
      }
    }
  }, [actions, form, state.details.date, unavailableDates]);

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
    time: state.details.time,
  });

  const debouncedPrefetch = useDebounce(prefetchVisibleMonth, 300);
  const advisoryMessage = useMemo(
    () => derivePlanDateAdvisory(state.details.date, overrideDates),
    [overrideDates, state.details.date],
  );

  const lastValidDateRef = useRef<string | null>(state.details.date ?? null);

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
      if (state.details[key] === value) {
        return;
      }
      actions.updateDetails(key, value);
    },
    [actions, state.details],
  );

  const fallbackTime = enabledSlots[0]?.value ?? '';

  useEffect(() => {
    if (!state.details.time && fallbackTime) {
      updateField('time', fallbackTime);
      form.setValue('time', fallbackTime, { shouldDirty: false, shouldValidate: true });
    }
  }, [fallbackTime, form, state.details.time, updateField]);

  const normalizeToInterval = useCallback(
    (value: string) => {
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
      const normalizedMinutes = Math.floor(cappedMinutes / intervalMinutes) * intervalMinutes;
      const nextHours = Math.floor(normalizedMinutes / 60);
      const nextMinutes = normalizedMinutes % 60;

      return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
    },
    [intervalMinutes, latestSelectableMinutes],
  );

  const submitForm = useCallback(
    (values: PlanFormValues) => {
      const normalizedTime = normalizeToInterval(values.time);
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
    [form, hasAvailableSlots, inferBookingOption, normalizeToInterval, onTrack, updateField],
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
    updateField,
    updateUnavailableDate,
  ]);

  useEffect(() => {
    const duration = schedule?.defaultDurationMinutes;
    if (!duration || duration <= 0) {
      return;
    }
    if (state.details.reservationDurationMinutes === duration) {
      return;
    }
    updateField('reservationDurationMinutes', duration);
  }, [schedule?.defaultDurationMinutes, state.details.reservationDurationMinutes, updateField]);

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
      prefetchMonth: (month: Date) => {
        debouncedPrefetch(month);
      },
    },
    minDate: normalizedMinDate,
    intervalMinutes,
    unavailableDates,
    loadingDates,
    hasAvailableSlots,
    isScheduleLoading,
    isScheduleFetching,
    schedule,
    currentUnavailabilityReason,
    advisoryMessage,
    isSubmitting: form.formState.isSubmitting,
    isValid: form.formState.isValid,
    submitForm,
    handleError,
  } as const;
}
