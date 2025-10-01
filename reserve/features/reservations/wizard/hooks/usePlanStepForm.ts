'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { useTimeSlots } from '@reserve/features/reservations/wizard/services';
import { formatDateForInput } from '@reserve/shared/formatting/booking';

import { planFormSchema, type PlanFormValues } from '../model/schemas';

import type { BookingDetails } from '../model/reducer';
import type { PlanStepFormProps, PlanStepFormState } from '../ui/steps/plan-step/types';

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
      time: state.details.time ?? '',
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
        time: state.details.time ?? '',
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

  const submitForm = useCallback(
    (values: PlanFormValues) => {
      updateField('date', values.date);
      updateField('time', values.time);
      updateField('party', values.party);
      updateField('bookingType', values.bookingType);
      updateField('notes', values.notes ?? '');
      actions.goToStep(2);
    },
    [actions, updateField],
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
    },
    [form, updateField],
  );

  const selectTime = useCallback(
    (value: string) => {
      form.setValue('time', value, { shouldDirty: true, shouldValidate: true });
      updateField('time', value);
      const inferredService = inferBookingOption(value);
      form.setValue('bookingType', inferredService, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', inferredService);
      onTrack?.('select_time', {
        time: value,
        booking_type: inferredService,
      });
    },
    [form, inferBookingOption, onTrack, updateField],
  );

  const changeParty = useCallback(
    (direction: 'decrement' | 'increment') => {
      const current = form.getValues('party');
      const next = direction === 'decrement' ? Math.max(1, current - 1) : Math.min(12, current + 1);
      form.setValue('party', next, { shouldDirty: true, shouldValidate: true });
      updateField('party', next);
    },
    [form, updateField],
  );

  const changeOccasion = useCallback(
    (value: PlanFormValues['bookingType']) => {
      form.setValue('bookingType', value, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', value);
    },
    [form, updateField],
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
