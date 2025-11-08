'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { emit } from '@/lib/analytics/emit';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import {
  fetchReservationSchedule,
  scheduleQueryKey,
} from '@reserve/features/reservations/wizard/services/schedule';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { toMinutes } from '@reserve/shared/time';

import { useWizardActions, useWizardState } from '../context/WizardContext';
import { planFormSchema, type PlanFormValues } from '../model/schemas';
import { useDebounce } from '../utils/debounce';

import type { BookingDetails, StepAction } from '../model/reducer';
import type {
  PlanStepFormProps,
  PlanStepFormState,
  PlanStepUnavailableReason,
} from '../ui/steps/plan-step/types';
import type { BookingOption } from '@reserve/shared/booking';

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

const buildMonthDateKeys = (
  monthStart: Date,
  minSelectableDate: Date,
  limit?: number,
): string[] => {
  const start = toMonthStart(monthStart);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const keys: string[] = [];

  const normalizedMin = new Date(minSelectableDate);
  normalizedMin.setHours(0, 0, 0, 0);
  const maxEntries =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : Number.POSITIVE_INFINITY;

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor < normalizedMin) {
      continue;
    }
    keys.push(formatDateForInput(new Date(cursor)));
    if (maxEntries > 0 && keys.length >= maxEntries) {
      break;
    }
  }

  return keys;
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

const linkAbortSignals = (controller: AbortController, querySignal?: AbortSignal) => {
  if (!querySignal) {
    return undefined;
  }
  if (querySignal.aborted) {
    controller.abort();
    return undefined;
  }

  const abortHandler = () => controller.abort();
  querySignal.addEventListener('abort', abortHandler, { once: true });

  return () => {
    querySignal.removeEventListener('abort', abortHandler);
  };
};

type UnavailableDateTrackingArgs = {
  restaurantSlug: string | null | undefined;
  date: string | null | undefined;
  minDate: Date;
};

type UnavailableDateTrackingResult = {
  unavailableDates: Map<string, PlanStepUnavailableReason>;
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
}: UnavailableDateTrackingArgs): UnavailableDateTrackingResult {
  const queryClient = useQueryClient();
  const prefetchedMonthsRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const pendingFetchesRef = useRef<Map<string, Promise<void>>>(new Map());
  const [unavailableDates, setUnavailableDates] = useState<Map<string, PlanStepUnavailableReason>>(
    () => new Map(),
  );
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

  const prefetchVisibleMonth = useCallback(
    (value: Date | null | undefined) => {
      if (!value) {
        return;
      }

      const slug = restaurantSlug?.trim();
      if (!slug) {
        return;
      }

      const monthStart = toMonthStart(value);
      const monthStarts: Date[] = [monthStart];

      const previousMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
      if (previousMonth.getTime() >= normalizedMinTimestamp) {
        monthStarts.push(previousMonth);
      }

      const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      monthStarts.push(nextMonth);

      monthStarts.forEach((month) => {
        const monthKey = MONTH_KEY_FORMATTER(month);
        if (prefetchedMonthsRef.current.has(monthKey)) {
          return;
        }

        prefetchedMonthsRef.current.add(monthKey);

        const dateKeys = buildMonthDateKeys(month, normalizedMinDate);
        if (dateKeys.length === 0) {
          return;
        }

        dateKeys.forEach((dateKey) => {
          if (pendingFetchesRef.current.has(dateKey)) {
            return;
          }

          const controller = new AbortController();
          abortControllersRef.current.set(dateKey, controller);

          setLoadingDates((prev) => {
            const next = new Set(prev);
            next.add(dateKey);
            return next;
          });

          const fetchPromise = (async () => {
            let unlinkAbort: (() => void) | undefined;
            try {
              const scheduleResult = await queryClient.fetchQuery({
                queryKey: scheduleQueryKey(slug, dateKey),
                queryFn: ({ signal: querySignal }) => {
                  unlinkAbort = linkAbortSignals(controller, querySignal);
                  return fetchReservationSchedule(slug, dateKey, controller.signal);
                },
                staleTime: 60_000,
              });

              if (!controller.signal.aborted) {
                const reason = deriveUnavailableReason(scheduleResult);
                updateUnavailableDate(dateKey, reason);
              }
            } catch (error) {
              if (controller.signal.aborted) {
                return;
              }

              if (process.env.NODE_ENV !== 'production') {
                console.error('[plan-step] failed to prefetch schedule', { date: dateKey, error });
              }

              emit('schedule.fetch.miss', { restaurantSlug: slug, date: dateKey });
              updateUnavailableDate(dateKey, 'unknown');
            } finally {
              unlinkAbort?.();
              if (!controller.signal.aborted) {
                setLoadingDates((prev) => {
                  const next = new Set(prev);
                  next.delete(dateKey);
                  return next;
                });
              }

              abortControllersRef.current.delete(dateKey);
              pendingFetchesRef.current.delete(dateKey);
            }
          })();

          pendingFetchesRef.current.set(dateKey, fetchPromise);
        });
      });
    },
    [normalizedMinDate, normalizedMinTimestamp, queryClient, restaurantSlug, updateUnavailableDate],
  );

  useEffect(() => {
    const initialMonth = parseDateKey(date) ?? normalizedMinDate;
    prefetchVisibleMonth(initialMonth);
  }, [date, normalizedMinDate, prefetchVisibleMonth]);

  useEffect(() => {
    const abortControllers = abortControllersRef.current;
    const pendingFetches = pendingFetchesRef.current;

    return () => {
      abortControllers.forEach((controller) => controller.abort());
      abortControllers.clear();
      pendingFetches.clear();
    };
  }, []);

  useEffect(() => {
    const abortControllers = abortControllersRef.current;
    const pendingFetches = pendingFetchesRef.current;
    const prefetchedMonths = prefetchedMonthsRef.current;
    abortControllers.forEach((controller) => controller.abort());
    abortControllers.clear();
    pendingFetches.clear();
    prefetchedMonths.clear();
    setLoadingDates(new Set());
  }, [restaurantSlug]);

  const currentUnavailabilityReason = useMemo<PlanStepUnavailableReason | null>(() => {
    if (!date) {
      return null;
    }
    return unavailableDates.get(date) ?? null;
  }, [date, unavailableDates]);

  return {
    unavailableDates,
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
  serviceAvailability: ReturnType<typeof useTimeSlots>['serviceAvailability'];
  inferBookingOption: ReturnType<typeof useTimeSlots>['inferBookingOption'];
  schedule: ReturnType<typeof useTimeSlots>['schedule'];
  availableBookingOptions: ReturnType<typeof useTimeSlots>['availableBookingOptions'];
  isScheduleLoading: boolean;
  enabledSlots: ReturnType<typeof useTimeSlots>['slots'];
  hasAvailableSlots: boolean;
  intervalMinutes: number | null;
  latestSelectableMinutes: number | null;
};

function usePlanSlotData({ restaurantSlug, date, time }: PlanSlotDataArgs): PlanSlotDataResult {
  const {
    slots,
    serviceAvailability,
    inferBookingOption,
    schedule,
    availableBookingOptions,
    isLoading: isScheduleLoading,
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
  const closingMinutes = schedule?.window?.closesAt ? toMinutes(schedule.window.closesAt) : null;
  const configuredBufferMinutes =
    typeof schedule?.lastSeatingBufferMinutes === 'number' && schedule.lastSeatingBufferMinutes > 0
      ? schedule.lastSeatingBufferMinutes
      : null;
  const guardMinutes =
    closingMinutes !== null
      ? Math.max(
          0,
          Math.max(
            configuredBufferMinutes ?? 0,
            typeof schedule?.defaultDurationMinutes === 'number'
              ? schedule.defaultDurationMinutes
              : 0,
          ),
        )
      : null;
  const latestSelectableMinutes =
    closingMinutes !== null && guardMinutes !== null
      ? Math.max(0, closingMinutes - guardMinutes)
      : null;

  return {
    slots,
    serviceAvailability,
    inferBookingOption,
    schedule,
    availableBookingOptions,
    isScheduleLoading,
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

  const {
    unavailableDates,
    prefetchVisibleMonth,
    updateUnavailableDate,
    normalizedMinDate,
    currentUnavailabilityReason,
    loadingDates,
  } = useUnavailableDateTracking({
    restaurantSlug: state.details.restaurantSlug,
    date: state.details.date,
    minDate,
  });

  const {
    slots,
    serviceAvailability,
    inferBookingOption,
    schedule,
    availableBookingOptions,
    isScheduleLoading,
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

      updateField('date', values.date);
      updateField('time', normalizedTime);
      updateField('party', values.party);
      updateField('bookingType', values.bookingType);
      updateField('notes', values.notes ?? '');
      form.setValue('time', normalizedTime, { shouldDirty: false, shouldValidate: true });
      actions.goToStep(2);
    },
    [actions, form, normalizeToInterval, updateField],
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
    },
    [form, onTrack, updateField],
  );

  const selectTime = useCallback(
    (value: string, options?: { commit?: boolean }) => {
      if (!hasAvailableSlots) {
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

  const changeOccasion = useCallback(
    (value: BookingOption) => {
      form.setValue('bookingType', value, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', value);
      onTrack?.('select_time', {
        time: form.getValues('time'),
        booking_type: value,
      });
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
              : 'Schedule not loaded yet—scroll to load month.';
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
        disabled: form.formState.isSubmitting || !form.formState.isValid,
        loading: form.formState.isSubmitting,
        onClick: handleContinue,
        role: 'primary',
      },
    ],
    [form.formState.isSubmitting, form.formState.isValid, handleContinue],
  );

  useEffect(() => {
    onActionsChange(planStepActions);
  }, [onActionsChange, planStepActions]);

  return {
    form,
    slots,
    availability: serviceAvailability,
    availableBookingOptions,
    occasionCatalog: schedule?.occasionCatalog ?? [],
    handlers: {
      selectDate,
      selectTime,
      changeParty,
      changeOccasion,
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
    schedule,
    currentUnavailabilityReason,
    isSubmitting: form.formState.isSubmitting,
    isValid: form.formState.isValid,
    submitForm,
    handleError,
  } as const;
}
