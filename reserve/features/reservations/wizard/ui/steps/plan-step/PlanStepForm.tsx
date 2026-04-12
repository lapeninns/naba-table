'use client';

import { AlertCircle } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useController } from 'react-hook-form';

import { formatDateForInput } from '@reserve/shared/formatting/booking';
import { cn } from '@shared/lib/cn';
import { Alert, AlertDescription, AlertIcon } from '@shared/ui/alert';
import { Form, FormField } from '@shared/ui/form';

import { Calendar24Date, Calendar24Time, NotesField, PartySizeField } from './components';
import { usePlanStepForm } from '../../../hooks/usePlanStepForm';

import type { PlanStepFormProps, PlanStepFormState } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const UNKNOWN_AVAILABILITY_COPY =
  'Availability is still loading. Please try another date or retry in a moment.';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
}

function BentoCard({ children, className }: BentoCardProps) {
  return (
    <div
      className={cn(
        'luminous-card rounded-[var(--luminous-radius)] p-4 sm:p-5',
        'transition-all duration-300',
        'hover:shadow-[0_28px_72px_rgba(26,28,30,0.08)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

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
    <form
      className="space-y-6"
      onSubmit={handleSubmit(state.submitForm, state.handleError)}
      noValidate
    >
      {/* Hidden submit button for form submission via Enter */}
      <button type="submit" className="hidden" aria-hidden />

      {/* ═══════════════════════════════════════════════════════════════════
          BENTO GRID LAYOUT
          Desktop: 3 columns (Date | Party | Time)
          Tablet: 2 columns (Date+Party | Time)
          Mobile: 1 column stacked
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4">
        {/* Date Selection — full width */}
        <BentoCard>
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
        </BentoCard>

        {/* Party Size — own row */}
        <BentoCard>
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
        </BentoCard>

        {/* Time Selection — own row */}
        <BentoCard>
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
        </BentoCard>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          Unavailable Warning Alert
      ───────────────────────────────────────────────────────────── */}
      {unavailableCopy && (
        <Alert variant="warning" className="border border-dashed animate-fade-in">
          <AlertIcon>
            <AlertCircle className="h-4 w-4" aria-hidden />
          </AlertIcon>
          <AlertDescription aria-live="polite">{unavailableCopy}</AlertDescription>
        </Alert>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          Notes Field - Full Width
      ───────────────────────────────────────────────────────────── */}
      <BentoCard className="col-span-2">
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
      </BentoCard>
    </form>
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
