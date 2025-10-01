'use client';

import React from 'react';

import { reservationConfigResult } from '@reserve/shared/config/reservations';
import { Form, FormField } from '@shared/ui/form';

import { DateField, NotesField, OccasionPicker, PartySizeField, TimeSlotGrid } from './components';
import { usePlanStepForm } from '../../../hooks/usePlanStepForm';

import type { PlanStepFormProps, PlanStepFormState } from './types';
import type { PlanFormValues } from '../../../model/schemas';

const SERVICE_ORDER: PlanFormValues['bookingType'][] = ['lunch', 'dinner', 'drinks'];
const UNAVAILABLE_TOOLTIP = reservationConfigResult.config.copy.unavailableTooltip;

type PlanStepFormContentProps = {
  state: PlanStepFormState;
};

function PlanStepFormContent({ state }: PlanStepFormContentProps) {
  const { control, formState, handleSubmit } = state.form;

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit(state.submitForm, state.handleError)}
      noValidate
    >
      <button type="submit" className="hidden" aria-hidden />
      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          control={control}
          name="date"
          render={({ field }) => (
            <DateField
              value={field.value}
              onSelect={state.handlers.selectDate}
              minDate={state.minDate}
              error={formState.errors.date?.message}
            />
          )}
        />

        <FormField
          control={control}
          name="party"
          render={({ field }) => (
            <PartySizeField
              value={field.value}
              onChange={state.handlers.changeParty}
              error={formState.errors.party?.message}
            />
          )}
        />
      </div>

      <FormField
        control={control}
        name="time"
        render={({ field }) => (
          <TimeSlotGrid
            slots={state.slots}
            selected={field.value}
            tooltip={UNAVAILABLE_TOOLTIP}
            onSelect={state.handlers.selectTime}
            error={formState.errors.time?.message}
          />
        )}
      />

      <FormField
        control={control}
        name="bookingType"
        render={({ field }) => (
          <OccasionPicker
            value={field.value}
            order={SERVICE_ORDER}
            onChange={state.handlers.changeOccasion}
            availability={state.availability}
            error={formState.errors.bookingType?.message}
          />
        )}
      />

      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <NotesField
            value={field.value ?? ''}
            onChange={(next) => {
              field.onChange(next);
              state.handlers.changeNotes(next);
            }}
            error={formState.errors.notes?.message}
          />
        )}
      />
    </form>
  );
}

export function PlanStepForm(props: PlanStepFormProps) {
  const state = usePlanStepForm(props);

  return (
    <Form {...state.form}>
      <PlanStepFormContent state={state} />
    </Form>
  );
}

export type { PlanStepFormProps } from './types';
