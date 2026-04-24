'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Progress } from '@shared/ui/progress';

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
}

export function WizardProgress({
  steps,
  currentStep,
  summary,
  className,
  showStepList = false,
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
      <div id={liveSummaryId} className="sr-only" aria-live="polite">
        {`Step ${clampedCurrent} of ${total}. ${ariaSummary}`}
      </div>

      {/* Optional: Full step list (only when showStepList is true) */}
      {showStepList && (
        <ol className="mt-4 flex items-center justify-between gap-3" aria-label="Steps">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCurrent = stepNumber === clampedCurrent;
            const isComplete = stepNumber < clampedCurrent;
            return (
              <li
                key={step.id ?? stepNumber}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 text-sm',
                  !isCurrent && 'opacity-80',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                    isCurrent
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isComplete
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-background text-muted-foreground',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${step.label} (${stepNumber} of ${total})`}
                >
                  {stepNumber}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{step.label}</p>
                  {step.helper ? (
                    <p className="truncate text-[11px] text-muted-foreground">{step.helper}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
