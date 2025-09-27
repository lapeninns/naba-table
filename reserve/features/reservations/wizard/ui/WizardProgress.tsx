'use client';

import * as React from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label="Reservation progress">
      <div
        className="sr-only"
        aria-live="polite"
      >{`Step ${clampedCurrent} of ${total}. ${ariaSummary}`}</div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-srx-ink-strong">{summary.primary}</p>
        {summary.details && summary.details.length > 0 ? (
          <p className="text-sm text-srx-ink-soft">
            {summary.details.map((detail, index) => (
              <React.Fragment key={`${detail}-${index}`}>
                {index > 0 ? (
                  <span aria-hidden className="mx-1">
                    •
                  </span>
                ) : null}
                <span>{detail}</span>
              </React.Fragment>
            ))}
          </p>
        ) : null}
      </div>
      <Progress value={progressValue} max={100} className="h-1.5" />
      <ol className="flex items-center justify-between gap-2" aria-label="Steps">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === clampedCurrent;
          const isComplete = stepNumber < clampedCurrent;
          return (
            <li
              key={step.id ?? stepNumber}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-1 text-center',
                !isCurrent && 'opacity-80',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isCurrent
                    ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)]'
                    : isComplete
                      ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]'
                      : 'border-[color:var(--color-border)] bg-white text-srx-ink-muted',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label} (${stepNumber} of ${total})`}
              >
                {stepNumber}
              </span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-medium text-srx-ink-strong">{step.label}</span>
                {step.helper ? (
                  <span className="text-[11px] text-srx-ink-soft">{step.helper}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
