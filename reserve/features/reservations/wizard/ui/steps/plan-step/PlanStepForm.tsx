'use client';

import React, { useMemo } from 'react';
import { useController, useWatch } from 'react-hook-form';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';
import { Form, FormField } from '@shared/ui/form';

import { Calendar24Field, NotesField, OccasionPicker, PartySizeField } from './components';
import { usePlanStepForm } from '../../../hooks/usePlanStepForm';

import type { PlanStepFormProps, PlanStepFormState } from './types';
import type { PlanFormValues } from '../../../model/schemas';

const SERVICE_ORDER: PlanFormValues['bookingType'][] = ['lunch', 'dinner', 'drinks'];
const SERVICE_LABELS: Record<PlanFormValues['bookingType'], string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

type PlanStepFormContentProps = {
  state: PlanStepFormState;
};

function PlanStepFormContent({ state }: PlanStepFormContentProps) {
  const { control, formState, handleSubmit } = state.form;
  const {
    field: dateField,
    fieldState: { error: dateFieldError },
  } = useController({ name: 'date', control });
  const {
    field: timeField,
    fieldState: { error: timeFieldError },
  } = useController({ name: 'time', control });
  const bookingTypeValue = useWatch({ name: 'bookingType', control });
  const notesValue = useWatch({ name: 'notes', control });

  const accordionSummary = useMemo(() => {
    const label = bookingTypeValue ? SERVICE_LABELS[bookingTypeValue] : undefined;
    const hasNotes = Boolean(notesValue?.trim()?.length);

    if (label && hasNotes) {
      return `Occasion: ${label} • Notes added`;
    }

    if (label) {
      return `Occasion: ${label}`;
    }

    if (hasNotes) {
      return 'Notes added';
    }

    return 'Select occasion or add notes (optional)';
  }, [bookingTypeValue, notesValue]);

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit(state.submitForm, state.handleError)}
      noValidate
    >
      <button type="submit" className="hidden" aria-hidden />
      <div className="grid gap-6 md:grid-cols-2">
        <Calendar24Field
          date={{
            value: dateField.value,
            minDate: state.minDate,
            onSelect: (next) => {
              state.handlers.selectDate(next);
            },
            onBlur: dateField.onBlur,
            error: dateFieldError?.message ?? formState.errors.date?.message,
          }}
          time={{
            value: timeField.value,
            onChange: (next) => {
              state.handlers.selectTime(next);
            },
            onBlur: timeField.onBlur,
            error: timeFieldError?.message ?? formState.errors.time?.message,
          }}
          suggestions={state.slots}
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

      <Accordion
        type="single"
        collapsible
        defaultValue={notesValue?.trim()?.length ? 'details' : undefined}
        className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
      >
        <AccordionItem value="details">
          <AccordionTrigger>
            <span className="flex flex-col text-left">
              <span className="text-base font-semibold text-foreground">Occasion & notes</span>
              <span className="text-sm font-normal text-muted-foreground">{accordionSummary}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-4">
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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
