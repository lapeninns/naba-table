'use client';

import { AlertCircle } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useController } from 'react-hook-form';

import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@shared/ui/accordion';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Form, FormField } from '@shared/ui/form';

import {
  Calendar24Date,
  Calendar24Time,
  NotesField,
  PartySizeField,
  TimeSlotGrid,
} from './components';
import { usePlanStepForm } from '../../../hooks/usePlanStepForm';

import type { PlanStepFormProps, PlanStepFormState } from './types';

type PlanStepFormContentProps = {
  state: PlanStepFormState;
};

const UNKNOWN_AVAILABILITY_COPY =
  'Availability is still loading. Please try another date or retry in a moment.';

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

  const isDateUnavailable = useCallback(
    (day: Date) => {
      const key = formatDateForInput(day);
      const reason = state.unavailableDates.get(key) ?? null;
      return reason === 'closed';
    },
    [state.unavailableDates],
  );

  const timeDisabled =
    state.currentUnavailabilityReason === 'closed' ||
    state.currentUnavailabilityReason === 'no-slots';

  const unavailableCopy = useMemo(() => {
    switch (state.currentUnavailabilityReason) {
      case 'closed':
        return 'We’re closed on this date. Please choose a different day.';
      case 'no-slots':
        return 'All reservation times are taken on this date. Please choose a different day.';
      case 'unknown':
        return UNKNOWN_AVAILABILITY_COPY;
      default:
        return null;
    }
  }, [state.currentUnavailabilityReason]);

  const accordionSummary = useMemo(() => {
    const selectedSlot = state.slots.find((slot) => slot.value === timeField.value);
    return timeField.value
      ? `Time: ${selectedSlot?.display ?? timeField.value}`
      : 'Time not selected';
  }, [state.slots, timeField.value]);

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit(state.submitForm, state.handleError)}
      noValidate
    >
      <button type="submit" className="hidden" aria-hidden />
      <div className="grid gap-6 md:grid-cols-3">
        <Calendar24Date
          date={{
            value: dateField.value ?? '',
            minDate: state.minDate,
            onSelect: (next: Date | null) => {
              state.handlers.selectDate(next);
            },
            onBlur: dateField.onBlur,
            error: dateFieldError?.message ?? formState.errors.date?.message,
          }}
          onMonthChange={state.handlers.prefetchMonth}
          isDateUnavailable={isDateUnavailable}
          loadingDates={state.loadingDates}
        />

        <div className="relative">
          <div
            className="hidden md:absolute md:-left-3 md:top-8 md:bottom-0 md:w-px md:bg-border"
            aria-hidden="true"
          />
          <FormField
            control={control}
            name="party"
            render={({ field }) => (
              <PartySizeField
                value={field.value ?? 1}
                onChange={state.handlers.changeParty}
                error={formState.errors.party?.message}
              />
            )}
          />
          <div
            className="hidden md:absolute md:-right-3 md:top-8 md:bottom-0 md:w-px md:bg-border"
            aria-hidden="true"
          />
        </div>

        <Calendar24Time
          time={{
            value: timeField.value ?? '',
            onChange: (next: string, options?: { commit?: boolean }) => {
              state.handlers.selectTime(next, options);
            },
            onBlur: () => {
              timeField.onBlur?.();
              state.handlers.selectTime(getValues('time'), { commit: true });
            },
            error: timeFieldError?.message ?? formState.errors.time?.message,
          }}
          suggestions={state.slots}
          intervalMinutes={state.intervalMinutes ?? undefined}
          isTimeDisabled={timeDisabled}
          unavailableMessage={unavailableCopy ?? undefined}
          isTimeLoading={state.isScheduleFetching || state.isScheduleLoading}
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
              <span className="text-base font-semibold text-foreground">Time options</span>
              <span className="text-sm font-normal text-muted-foreground">{accordionSummary}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-4">
              <TimeSlotGrid
                slots={timeDisabled ? [] : state.slots}
                value={timeField.value ?? ''}
                loading={state.isScheduleFetching || state.isScheduleLoading}
                onSelect={(next) => {
                  state.handlers.selectTime(next);
                  timeField.onBlur?.();
                }}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <NotesField
            value={field.value ?? ''}
            onChange={(next) => {
              field.onChange(next);
            }}
            onBlur={(next) => {
              field.onBlur();
              state.handlers.commitNotes(next);
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
