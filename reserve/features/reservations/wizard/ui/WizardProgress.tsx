'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@shared/lib/cn';

import type { SummaryFact } from '../model/selectors';

export type { SummaryFact };

export interface WizardStepMeta {
  id: number;
  label: string;
  helper?: string;
}

export interface WizardSummary {
  primary: string;
  details?: string[];
  srLabel?: string;
  /** Labeled booking facts for the expandable summary sheet. */
  facts?: SummaryFact[];
}

interface WizardProgressProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  className?: string;
  /** Show detailed step list (for main content area, not sticky nav) */
  showStepList?: boolean;
  onStepSelect?: (step: number) => void;
}

export function WizardProgress({
  steps,
  currentStep,
  summary,
  className,
  showStepList = false,
  onStepSelect,
}: WizardProgressProps) {
  const id = React.useId();
  const total = steps.length || 1;
  const clampedCurrent = Math.min(Math.max(currentStep, 1), total);
  const progressValue = total <= 1 ? 100 : ((clampedCurrent - 1) / (total - 1)) * 100;
  const ariaSummary = summary.srLabel ?? `${summary.primary}. ${summary.details?.join(', ') ?? ''}`;
  const headingId = `${id}-heading`;
  const liveSummaryId = `${id}-summary`;
  const currentStepData = steps[clampedCurrent - 1];

  return (
    <section
      data-wizard-progress
      className={cn('flex flex-col gap-3 text-[color:var(--pg-text)]', className)}
      aria-label="Booking steps"
      aria-describedby={liveSummaryId}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div id={headingId} className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold sm:text-base">
            {currentStepData?.label ?? `Step ${clampedCurrent}`}
          </span>
          <span className="shrink-0 text-xs font-medium tabular-nums text-[color:var(--pg-text-muted)]">
            {`${clampedCurrent} of ${total}`}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm sm:gap-3">
          <Progress
            value={progressValue}
            className="h-1.5 flex-1 rounded-full bg-[color:var(--pg-bg-muted)] [&>div]:bg-[color:var(--pg-action)]"
            aria-label="Booking progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressValue)}
            aria-valuetext={`Step ${clampedCurrent} of ${total}`}
          />
          <span className="text-xs font-medium tabular-nums text-[color:var(--pg-text-muted)]">
            {`${Math.round(progressValue)}%`}
          </span>
        </div>
      </div>

      <div id={liveSummaryId} className="sr-only">
        {`Step ${clampedCurrent} of ${total}. ${ariaSummary}`}
      </div>

      {showStepList && (
        <ol
          className="mt-2 grid grid-cols-4 gap-1 sm:mt-4 sm:flex sm:items-center sm:justify-between sm:gap-3"
          aria-label="Steps"
        >
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCurrent = stepNumber === clampedCurrent;
            const isComplete = stepNumber < clampedCurrent;
            const marker = (
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors sm:h-9 sm:w-9 sm:text-sm',
                  isCurrent
                    ? 'border-[color:var(--pg-action)] bg-[color:var(--pg-action)] text-[color:var(--pg-action-contrast)]'
                    : isComplete
                      ? 'border-[color:var(--pg-action)] bg-[color:color-mix(in_srgb,var(--pg-action)_12%,transparent)] text-[color:var(--pg-action)]'
                      : 'border-[color:var(--pg-border)] bg-[color:var(--pg-bg)] text-[color:var(--pg-text-muted)]',
                )}
              >
                {stepNumber}
              </div>
            );
            const copy = (
              <div className="min-w-0 text-center sm:text-left">
                <p className="truncate text-xs font-semibold text-[color:var(--pg-text)]">
                  {step.label}
                </p>
                {step.helper ? (
                  <p className="hidden truncate text-[11px] text-[color:var(--pg-text-muted)] sm:block">
                    {step.helper}
                  </p>
                ) : null}
              </div>
            );
            return (
              <li
                key={step.id ?? stepNumber}
                className={cn(
                  'flex min-w-0 items-center justify-center text-sm sm:flex-1 sm:justify-start sm:gap-3',
                  !isCurrent && 'opacity-80',
                )}
              >
                {isComplete && onStepSelect ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex min-h-11 min-w-0 flex-col items-center gap-1 rounded-md p-0 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:gap-3 sm:text-left"
                    aria-label={`${step.label} (${stepNumber} of ${total})`}
                    onClick={() => onStepSelect(stepNumber)}
                  >
                    {marker}
                    {copy}
                  </Button>
                ) : (
                  <div
                    className="flex min-h-11 min-w-0 flex-col items-center gap-1 sm:flex-row sm:gap-3"
                    aria-label={`${step.label} (${stepNumber} of ${total})`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {marker}
                    {copy}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
