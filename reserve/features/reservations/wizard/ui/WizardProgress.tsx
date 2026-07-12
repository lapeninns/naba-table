'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@shared/lib/cn';

export interface WizardStepMeta {
  id: number;
  label: string;
  helper?: string;
}

export interface WizardSummary {
  primary: string;
  details?: string[];
  srLabel?: string;
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
  const total = steps.length || 1;
  const clampedCurrent = Math.min(Math.max(currentStep, 1), total);
  const progressValue = total <= 1 ? 100 : ((clampedCurrent - 1) / (total - 1)) * 100;
  const ariaSummary = summary.srLabel ?? `${summary.primary}. ${summary.details?.join(', ') ?? ''}`;

  // Use stable IDs to prevent hydration mismatch
  const headingId = `wizard-progress-heading-${clampedCurrent}`;
  const liveSummaryId = `wizard-progress-summary-${clampedCurrent}`;

  const currentStepData = steps[clampedCurrent - 1];

  return (
    <section
      className={cn('flex flex-col gap-2', className)}
      aria-labelledby={headingId}
      aria-describedby={liveSummaryId}
    >
      {/* Compact header: Step X of Y + Progress bar */}
      <div id={headingId} className="flex items-center gap-3">
        {/* Step indicator pill */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:h-8 sm:w-8 sm:text-sm">
            {clampedCurrent}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground sm:text-base">
              {currentStepData?.label ?? `Step ${clampedCurrent}`}
            </span>
            <span className="text-xs text-muted-foreground">{`${clampedCurrent} of ${total}`}</span>
          </div>
        </div>

        {/* Progress bar - visible on all devices */}
        <div className="flex flex-1 items-center gap-2 sm:gap-3">
          <Progress
            value={progressValue}
            className="h-1.5 flex-1 rounded-full bg-muted"
            aria-label="Booking progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressValue)}
            aria-valuetext={`Step ${clampedCurrent} of ${total}`}
          />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {`${Math.round(progressValue)}%`}
          </span>
        </div>
      </div>

      {/* Screen reader live region */}
      <div id={liveSummaryId} className="sr-only">
        {`Step ${clampedCurrent} of ${total}. ${ariaSummary}`}
      </div>

      {/* Optional: Full step list (only when showStepList is true) */}
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
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isComplete
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border bg-background text-muted-foreground',
                )}
              >
                {stepNumber}
              </div>
            );
            const copy = (
              <div className="min-w-0 text-center sm:text-left">
                <p className="truncate text-xs font-semibold text-foreground">{step.label}</p>
                {step.helper ? (
                  <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
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
