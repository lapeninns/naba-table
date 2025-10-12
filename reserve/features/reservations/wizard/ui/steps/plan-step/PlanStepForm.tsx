'use client';

import { AlertCircle } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useController, useWatch } from 'react-hook-form';

import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Form, FormField } from '@shared/ui/form';

import {
  Calendar24Field,
  NotesField,
  OccasionPicker,
  PartySizeField,
  TimeSlotGrid,
} from './components';
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
  const { control, formState, handleSubmit, getValues } = state.form;
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

  const isDateUnavailable = useCallback(
    (day: Date) => {
      const key = formatDateForInput(day);
      return state.unavailableDates.has(key);
    },
    [state.unavailableDates],
  );

  const timeDisabled = state.currentUnavailabilityReason !== null;

  const unavailableCopy = useMemo(() => {
    switch (state.currentUnavailabilityReason) {
      case 'closed':
        return 'We’re closed on this date. Please choose a different day.';
      case 'no-slots':
        return 'All reservation times are taken on this date. Please choose a different day.';
      default:
        return null;
    }
  }, [state.currentUnavailabilityReason]);

  const accordionSummary = useMemo(() => {
    const selectedSlot = state.slots.find((slot) => slot.value === timeField.value);
    const timeSummary = timeField.value
      ? `Time: ${selectedSlot?.display ?? timeField.value}`
      : 'Time not selected';

    const label = bookingTypeValue ? SERVICE_LABELS[bookingTypeValue] : undefined;
    const hasNotes = Boolean(notesValue?.trim()?.length);

    const parts = [timeSummary];

    if (label) {
      parts.push(`Occasion: ${label}`);
    }

    if (hasNotes) {
      parts.push('Notes added');
    }

    if (!label && !hasNotes) {
      parts.push('Occasion or notes optional');
    }

    return parts.join(' • ');
  }, [bookingTypeValue, notesValue, state.slots, timeField.value]);

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
            onChange: (next, options) => {
              state.handlers.selectTime(next, options);
            },
            onBlur: () => {
              timeField.onBlur?.();
              state.handlers.selectTime(getValues('time'), { commit: true });
            },
            error: timeFieldError?.message ?? formState.errors.time?.message,
          }}
          suggestions={state.slots}
          intervalMinutes={state.intervalMinutes}
          isDateUnavailable={isDateUnavailable}
          isTimeDisabled={timeDisabled}
          unavailableMessage={unavailableCopy ?? undefined}
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

      {unavailableCopy ? (
        <Alert variant="warning" className="border border-dashed">
          <AlertIcon>
            <AlertCircle className="h-4 w-4" aria-hidden />
          </AlertIcon>
          <AlertDescription>{unavailableCopy}</AlertDescription>
        </Alert>
      ) : null}

      <Accordion
        type="single"
        collapsible
        className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground"
      >
        <AccordionItem value="details">
          <AccordionTrigger>
            <span className="flex flex-col text-left">
              <span className="text-base font-semibold text-foreground">
                Time, occasion & notes
              </span>
              <span className="text-sm font-normal text-muted-foreground">{accordionSummary}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-4">
              <TimeSlotGrid
                slots={timeDisabled ? [] : state.slots}
                value={timeField.value}
                onSelect={(next) => {
                  state.handlers.selectTime(next);
                  timeField.onBlur?.();
                }}
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
