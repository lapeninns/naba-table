'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import {
  fetchReservationSchedule,
  scheduleQueryKey,
} from '@reserve/features/reservations/wizard/services/schedule';
import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { toMinutes } from '@reserve/shared/time';

import { planFormSchema, type PlanFormValues } from '../model/schemas';

import type { BookingDetails, StepAction } from '../model/reducer';
import type {
  PlanStepFormProps,
  PlanStepFormState,
  PlanStepUnavailableReason,
} from '../ui/steps/plan-step/types';

const DEFAULT_TIME = reservationConfigResult.config.opening.open;
const DEFAULT_INTERVAL_MINUTES = reservationConfigResult.config.opening.intervalMinutes;
const DEFAULT_CLOSING_MINUTES = toMinutes(reservationConfigResult.config.opening.close);

const MONTH_KEY_FORMATTER = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const toMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const deriveUnavailableReason = (
  nextSchedule: { isClosed: boolean; slots: { disabled: boolean }[] } | null,
): PlanStepUnavailableReason | null => {
  if (!nextSchedule) {
    return null;
  }
  if (nextSchedule.isClosed) {
    return 'closed';
  }
  const hasEnabledSlot = nextSchedule.slots.some((slot) => !slot.disabled);
  return hasEnabledSlot ? null : 'no-slots';
};

const buildMonthDateKeys = (monthStart: Date, minSelectableDate: Date): string[] => {
  const start = toMonthStart(monthStart);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const keys: string[] = [];

  const normalizedMin = new Date(minSelectableDate);
  normalizedMin.setHours(0, 0, 0, 0);

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor < normalizedMin) {
      continue;
    }
    keys.push(formatDateForInput(new Date(cursor)));
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

export function usePlanStepForm({
  state,
  actions,
  onActionsChange,
  onTrack,
  minDate,
}: PlanStepFormProps): PlanStepFormState {
  const queryClient = useQueryClient();
  const prefetchedMonthsRef = useRef<Set<string>>(new Set());
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    mode: 'onChange',
    reValidateMode: 'onBlur',
    defaultValues: {
      date: state.details.date ?? '',
      time: state.details.time ?? DEFAULT_TIME,
      party: state.details.party ?? 1,
      bookingType: state.details.bookingType,
      notes: state.details.notes ?? '',
    },
  });

  const [unavailableDates, setUnavailableDates] = useState<Map<string, PlanStepUnavailableReason>>(
    () => new Map(),
  );
  const lastValidDateRef = useRef<string | null>(state.details.date ?? null);
  const normalizedMinDate = useMemo(() => {
    const next = new Date(minDate);
    next.setHours(0, 0, 0, 0);
    return next;
  }, [minDate]);

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
      const slug = state.details.restaurantSlug;
      if (!slug) {
        return;
      }

      const monthStart = toMonthStart(value);
      const monthKey = MONTH_KEY_FORMATTER(monthStart);
      if (prefetchedMonthsRef.current.has(monthKey)) {
        return;
      }
      prefetchedMonthsRef.current.add(monthKey);

      const dateKeys = buildMonthDateKeys(monthStart, normalizedMinDate);
      if (dateKeys.length === 0) {
        return;
      }

      void Promise.all(
        dateKeys.map(async (dateKey) => {
          try {
            const scheduleResult = await queryClient.fetchQuery({
              queryKey: scheduleQueryKey(slug, dateKey),
              queryFn: ({ signal }) => fetchReservationSchedule(slug, dateKey, signal),
              staleTime: 60_000,
            });
            const reason = deriveUnavailableReason(scheduleResult);
            updateUnavailableDate(dateKey, reason);
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[plan-step] failed to prefetch schedule', { date: dateKey, error });
            }
          }
        }),
      );
    },
    [normalizedMinDate, queryClient, state.details.restaurantSlug, updateUnavailableDate],
  );

  const {
    slots,
    serviceAvailability,
    inferBookingOption,
    schedule,
    isLoading: isScheduleLoading,
  } = useTimeSlots({
    restaurantSlug: state.details.restaurantSlug,
    date: state.details.date,
    selectedTime: state.details.time,
  });

  const enabledSlots = useMemo(() => slots.filter((slot) => !slot.disabled), [slots]);
  const hasAvailableSlots = enabledSlots.length > 0;

  const intervalMinutes = schedule?.intervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
  const closingMinutes = schedule?.window?.closesAt
    ? toMinutes(schedule.window.closesAt)
    : DEFAULT_CLOSING_MINUTES;
  const latestSelectableMinutes = Math.max(0, closingMinutes - intervalMinutes);
  const fallbackTime = enabledSlots[0]?.value ?? '';

  useEffect(() => {
    const initialMonthCandidate = parseDateKey(state.details.date) ?? normalizedMinDate;
    prefetchVisibleMonth(initialMonthCandidate);
  }, [normalizedMinDate, prefetchVisibleMonth, state.details.date]);

  useEffect(() => {
    prefetchedMonthsRef.current.clear();
  }, [state.details.restaurantSlug]);

  useEffect(() => {
    form.reset(
      {
        date: state.details.date ?? '',
        time: state.details.time ?? fallbackTime,
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
    fallbackTime,
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

      const intervalValue = intervalMinutes > 0 ? intervalMinutes : DEFAULT_INTERVAL_MINUTES;
      const totalMinutes = Math.min(hours * 60 + minutes, latestSelectableMinutes);
      const normalizedMinutes = Math.floor(totalMinutes / intervalValue) * intervalValue;
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
      const next = direction === 'decrement' ? Math.max(1, current - 1) : Math.min(12, current + 1);
      form.setValue('party', next, { shouldDirty: true, shouldValidate: true });
      updateField('party', next);
      onTrack?.('select_party', { party: next });
    },
    [form, onTrack, updateField],
  );

  const changeOccasion = useCallback(
    (value: PlanFormValues['bookingType']) => {
      form.setValue('bookingType', value, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', value);
      onTrack?.('select_time', {
        time: form.getValues('time'),
        booking_type: value,
      });
    },
    [form, onTrack, updateField],
  );

  const changeNotes = useCallback(
    (value: string) => {
      updateField('notes', value);
    },
    [updateField],
  );

  useEffect(() => {
    if (!schedule) {
      return;
    }

    const scheduleDate = schedule.date;
    const derivedReason = deriveUnavailableReason(schedule);
    const shouldBlockDate = Boolean(derivedReason);

    updateUnavailableDate(scheduleDate, derivedReason);

    const isCurrentDate = scheduleDate === state.details.date;

    if (shouldBlockDate) {
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
            : 'No reservation times are available for the selected date. Please choose another day.';
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
    } else if (!shouldBlockDate && !schedule.isClosed) {
      lastValidDateRef.current = scheduleDate;
    }
  }, [
    enabledSlots,
    form,
    hasAvailableSlots,
    inferBookingOption,
    schedule,
    state.details.date,
    updateField,
    updateUnavailableDate,
  ]);

  const { isSubmitting, isValid } = form.formState;
  const currentUnavailabilityReason = useMemo<PlanStepUnavailableReason | null>(() => {
    const currentDate = state.details.date;
    if (!currentDate) {
      return null;
    }
    return unavailableDates.get(currentDate) ?? null;
  }, [state.details.date, unavailableDates]);

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
        disabled: isSubmitting || !isValid,
        loading: isSubmitting,
        onClick: handleContinue,
      },
    ],
    [handleContinue, isSubmitting, isValid],
  );

  useEffect(() => {
    onActionsChange(planStepActions);
  }, [onActionsChange, planStepActions]);

  return {
    form,
    slots,
    availability: serviceAvailability,
    handlers: {
      selectDate,
      selectTime,
      changeParty,
      changeOccasion,
      changeNotes,
      prefetchMonth: (month: Date) => {
        prefetchVisibleMonth(month);
      },
    },
    minDate,
    intervalMinutes,
    unavailableDates,
    hasAvailableSlots,
    isScheduleLoading,
    schedule,
    currentUnavailabilityReason,
    isSubmitting,
    isValid,
    submitForm,
    handleError,
  } as const;
}
