'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import { formatDateForInput } from '@reserve/shared/formatting/booking';

import { planFormSchema, type PlanFormValues } from '../model/schemas';

import type { BookingDetails } from '../model/reducer';
import type { PlanStepFormProps, PlanStepFormState } from '../ui/steps/plan-step/types';

const DEFAULT_TIME = '12:00';

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

  const { slots, serviceAvailability, inferBookingOption } = useTimeSlots({
    date: state.details.date,
    selectedTime: state.details.time,
  });

  useEffect(() => {
    form.reset(
      {
        date: state.details.date ?? '',
        time: state.details.time ?? DEFAULT_TIME,
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
  ]);

  const updateField = useCallback(
    <K extends keyof BookingDetails>(key: K, value: BookingDetails[K]) => {
      actions.updateDetails(key, value);
    },
    [actions],
  );

  useEffect(() => {
    if (!state.details.time) {
      updateField('time', DEFAULT_TIME);
    }
  }, [state.details.time, updateField]);

  const normalizeHalfHour = useCallback((value: string) => {
    if (!value) {
      return '';
    }

    const [hoursPart, minutesPart] = value.split(':');
    const hours = Number.parseInt(hoursPart ?? '', 10);
    const minutes = Number.parseInt(minutesPart ?? '', 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0) {
      return value;
    }

    const totalMinutes = Math.min(hours * 60 + minutes, 23 * 60 + 30);
    const normalizedMinutes = Math.floor(totalMinutes / 30) * 30;
    const nextHours = Math.floor(normalizedMinutes / 60);
    const nextMinutes = normalizedMinutes % 60;

    return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}`;
  }, []);

  const submitForm = useCallback(
    (values: PlanFormValues) => {
      const normalizedTime = normalizeHalfHour(values.time);

      updateField('date', values.date);
      updateField('time', normalizedTime);
      updateField('party', values.party);
      updateField('bookingType', values.bookingType);
      updateField('notes', values.notes ?? '');
      form.setValue('time', normalizedTime, { shouldDirty: false, shouldValidate: true });
      actions.goToStep(2);
    },
    [actions, form, normalizeHalfHour, updateField],
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
      if (options?.commit === false) {
        form.setValue('time', value, { shouldDirty: true, shouldValidate: false });
        return;
      }

      const normalized = normalizeHalfHour(value);
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
    [form, inferBookingOption, normalizeHalfHour, onTrack, updateField],
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

  const { isSubmitting, isValid } = form.formState;

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
    isSubmitting,
    isValid,
    submitForm,
    handleError,
  } as const;
}
