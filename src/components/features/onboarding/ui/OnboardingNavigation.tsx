'use client';

import { Button } from '@/components/ui/button';

import type { OnboardingStep } from '../types';

export type OnboardingNavigationProps = {
  step: OnboardingStep;
  totalSteps: number;
  canGoBack?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  busy?: boolean;
  nextLabel?: string;
  backLabel?: string;
};

export function OnboardingNavigation({
  step,
  totalSteps,
  canGoBack = true,
  onBack,
  onNext,
  onSubmit,
  busy,
  nextLabel = 'Next',
  backLabel = 'Back',
}: OnboardingNavigationProps) {
  const isLast = step === totalSteps;

  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        Step {step} of {totalSteps}
      </div>
      <div className="flex gap-2 sm:justify-end">
        <Button type="button" variant="ghost" onClick={onBack} disabled={!canGoBack || busy}>
          {backLabel}
        </Button>
        <Button
          type={isLast ? 'submit' : 'button'}
          onClick={isLast ? onSubmit : onNext}
          disabled={busy}
        >
          {isLast ? 'Launch restaurant' : nextLabel}
        </Button>
      </div>
    </div>
  );
}
