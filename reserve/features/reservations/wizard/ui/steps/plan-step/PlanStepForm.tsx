'use client';

import { AlertCircle } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useController } from 'react-hook-form';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormField, FormRoot } from '@/components/ui/form';
import { formatDateForInput } from '@reserve/shared/formatting/booking';

import { Calendar24Date, Calendar24Time, NotesField, PartySizeField } from './components';
import { usePlanStepForm } from '../../../hooks/usePlanStepForm';

import type { PlanStepFormProps, PlanStepFormState } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const UNKNOWN_AVAILABILITY_COPY =
  'Availability is still loading. Please try another date or retry in a moment.';

// ─────────────────────────────────────────────────────────────────────────────
// Main Form Content
// ─────────────────────────────────────────────────────────────────────────────

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
        return 'We are closed on this date. Please choose a different day.';
      case 'no-slots':
        return 'All reservation times are taken on this date. Please choose a different day.';
      case 'unknown':
        return UNKNOWN_AVAILABILITY_COPY;
      default:
        return null;
    }
  }, [state.currentUnavailabilityReason]);

  return (
    <FormRoot
      className="space-y-5 sm:space-y-6"
      onSubmit={handleSubmit(state.submitForm, state.handleError)}
      noValidate
    >
      <Button type="submit" className="hidden" aria-hidden />

      <p className="text-sm text-muted-foreground">Party size, date, and time are required.</p>

      <div
        role="group"
        aria-label="Booking plan"
        data-slot="plan-fields"
        className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-x-6 md:grid-cols-2"
      >
        <section
          aria-label="Party size selection"
          data-plan-field="party"
          className="border-b border-border/70 py-5 md:col-span-1 md:pr-3"
        >
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
        </section>

        <section
          aria-label="Date selection"
          data-plan-field="date"
          className="border-b border-border/70 py-5 md:col-span-1 md:pl-3"
        >
          <Calendar24Date
            date={{
              value: dateField.value ?? '',
              minDate: state.minDate,
              onSelect: (next) => {
                state.handlers.selectDate(next);
              },
              onBlur: dateField.onBlur,
              error: dateFieldError?.message ?? formState.errors.date?.message,
            }}
            onMonthChange={state.handlers.prefetchMonth}
            isDateUnavailable={isDateUnavailable}
            loadingDates={state.loadingDates}
          />
        </section>

        <section
          aria-label="Time selection"
          data-plan-field="time"
          className="border-b border-border/70 py-5 md:col-span-2"
        >
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
        </section>

        <section
          aria-label="Additional booking notes"
          data-plan-field="notes"
          className="pt-4 md:col-span-2"
        >
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="notes" className="border-b-0">
              <AccordionTrigger className="min-h-11 px-1 py-3 text-base sm:px-1">
                Add dietary, access, or occasion notes
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-0 pt-2">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>

      {unavailableCopy && (
        <Alert variant="warning" className="border border-dashed animate-fade-in">
          <AlertIcon>
            <AlertCircle className="size-4" aria-hidden />
          </AlertIcon>
          <AlertDescription aria-live="polite">{unavailableCopy}</AlertDescription>
        </Alert>
      )}

      {state.advisoryMessage && (
        <Alert variant="info" className="animate-fade-in">
          <AlertIcon>
            <AlertCircle className="size-4" aria-hidden />
          </AlertIcon>
          <AlertDescription aria-live="polite">{state.advisoryMessage}</AlertDescription>
        </Alert>
      )}

      {state.dateChangeMessage ? (
        <p
          className="text-sm font-medium text-foreground"
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {state.dateChangeMessage}
        </p>
      ) : null}

      {!state.isValid ? (
        <p className="text-sm text-muted-foreground" role="status">
          Choose a date and available time to continue.
        </p>
      ) : null}
    </FormRoot>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported Component
// ─────────────────────────────────────────────────────────────────────────────

export function PlanStepForm(props: PlanStepFormProps) {
  const state = usePlanStepForm(props);

  return (
    <Form {...state.form}>
      <PlanStepFormContent state={state} />
    </Form>
  );
}

export type { PlanStepFormProps } from './types';
