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
}

export function WizardProgress({ steps, currentStep, summary, className }: WizardProgressProps) {
  const total = steps.length || 1;
  const clampedCurrent = Math.min(Math.max(currentStep, 1), total);
  const progressValue = total <= 1 ? 100 : ((clampedCurrent - 1) / (total - 1)) * 100;
  const ariaSummary = summary.srLabel ?? `${summary.primary}. ${summary.details?.join(', ') ?? ''}`;
  const headingId = React.useId();
  const liveSummaryId = React.useId();

  return (
    <section
      className={cn('flex flex-col gap-2', className)}
      aria-labelledby={headingId}
      aria-describedby={liveSummaryId}
    >
      <div
        id={headingId}
        className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-[13px]"
      >
        <span>{`Step ${clampedCurrent} of ${total}`}</span>
        <span aria-hidden>{`${Math.round(progressValue)}% complete`}</span>
      </div>
      <Progress
        value={progressValue}
        className="h-1.5 rounded-full bg-muted"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressValue)}
        aria-valuetext={`Step ${clampedCurrent} of ${total}`}
      />
      <div id={liveSummaryId} className="sr-only" aria-live="polite">
        {`Step ${clampedCurrent} of ${total}. ${ariaSummary}`}
      </div>
      <ol className="hidden items-center justify-between gap-3 md:flex" aria-label="Steps">
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
    </section>
  );
}
