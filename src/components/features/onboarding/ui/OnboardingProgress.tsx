'use client';

import { CheckCircle2, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { OnboardingStep } from '../types';

export type ProgressStep = {
  id: OnboardingStep;
  title: string;
  description: string;
};

type OnboardingProgressProps = {
  steps: ProgressStep[];
  current: OnboardingStep;
};

export function OnboardingProgress({ steps, current }: OnboardingProgressProps) {
  return (
    <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Onboarding steps">
      {steps.map((step) => {
        const isComplete = step.id < current;
        const isActive = step.id === current;
        return (
          <li
            key={step.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card/60 p-3',
              isActive && 'border-primary shadow-sm',
              isComplete && 'border-primary/60 bg-primary/5',
            )}
          >
            <span className="mt-0.5 text-primary" aria-hidden>
              {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-tight text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
            </div>
            <span className="sr-only">{isActive ? 'Current step' : isComplete ? 'Completed' : 'Upcoming'}</span>
          </li>
        );
      })}
    </ol>
  );
}
