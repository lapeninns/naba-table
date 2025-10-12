'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { toMinutes } from '@reserve/shared/time';

import { planFormSchema, type PlanFormValues } from '../model/schemas';

import type { BookingDetails } from '../model/reducer';
import type {
  PlanStepFormProps,
  PlanStepFormState,
  PlanStepUnavailableReason,
} from '../ui/steps/plan-step/types';

const DEFAULT_TIME = reservationConfigResult.config.opening.open;
const DEFAULT_INTERVAL_MINUTES = reservationConfigResult.config.opening.intervalMinutes;
const DEFAULT_CLOSING_MINUTES = toMinutes(reservationConfigResult.config.opening.close);

export function usePlanStepForm({
  state,
  actions,
  onActionsChange,
  onTrack,
  minDate,
}: PlanStepFormProps): PlanStepFormState {
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
      actions.updateDetails(key, value);
    },
    [actions],
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
    const reason: PlanStepUnavailableReason = schedule.isClosed ? 'closed' : 'no-slots';
    const shouldBlockDate = schedule.isClosed || !hasAvailableSlots;

    setUnavailableDates((prev) => {
      const existing = prev.get(scheduleDate);
      if (shouldBlockDate) {
        if (existing === reason) {
          return prev;
        }
        const next = new Map(prev);
        next.set(scheduleDate, reason);
        return next;
      }
      if (!existing) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(scheduleDate);
      return next;
    });

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
          reason === 'closed'
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

  useEffect(() => {
    const submit = () => form.handleSubmit(submitForm, handleError)();
    onActionsChange([
      {
        id: 'plan-continue',
        label: 'Continue',
        icon: 'ChevronDown',
        variant: 'default',
        disabled: isSubmitting || !isValid,
        loading: isSubmitting,
        onClick: submit,
      },
    ]);
  }, [form, handleError, isSubmitting, isValid, onActionsChange, submitForm]);

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
