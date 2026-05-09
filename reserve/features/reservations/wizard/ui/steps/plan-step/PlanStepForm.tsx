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
import { WizardPanel, WizardPanelContent } from '../../WizardPanel';

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        <WizardPanel interactive className="order-1 md:col-span-3 lg:col-span-3">
          <WizardPanelContent>
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
          </WizardPanelContent>
        </WizardPanel>

        <WizardPanel interactive className="order-2 md:col-span-3 lg:col-span-4">
          <WizardPanelContent>
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
          </WizardPanelContent>
        </WizardPanel>

        <WizardPanel interactive className="order-3 md:col-span-6 lg:col-span-5">
          <WizardPanelContent>
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
          </WizardPanelContent>
        </WizardPanel>

        <WizardPanel className="order-4 md:col-span-6 lg:col-span-12">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="notes" className="border-b-0">
              <AccordionTrigger className="px-4 py-4 text-base sm:px-5">
                Add dietary, access, or occasion notes
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <WizardPanelContent className="pt-0">
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
                </WizardPanelContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </WizardPanel>
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
