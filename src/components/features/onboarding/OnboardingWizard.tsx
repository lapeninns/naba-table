'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { OnboardingProvider, useOnboarding } from './context/OnboardingContext';
import { AccountStep, ProfileStep } from './OnboardingAccountProfileSteps';
import { HoursStep, ServicePeriodsStep } from './OnboardingScheduleSteps';
import { ReviewStep, TablesStep } from './OnboardingTablesReviewSteps';
import {
  getMaxAccessibleStep,
  ONBOARDING_STEPS,
  STEP_PATHS,
  stepFromPathname,
} from './onboardingWizardDomain';
import { OnboardingShell } from './ui/OnboardingShell';

import type { OnboardingState } from './types';

function StepError() {
  const { state } = useOnboarding();
  if (!state.error) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

function OnboardingContent() {
  const { state, setStep } = useOnboarding();
  const pathname = usePathname();
  const router = useRouter();
  const requestedStep = stepFromPathname(pathname);
  const maxAccessibleStep = getMaxAccessibleStep(state);
  const lastHandledPathRef = useRef<string | null>(null);

  const noop = () => {};

  useEffect(() => {
    if (lastHandledPathRef.current === pathname) {
      return;
    }
    lastHandledPathRef.current = pathname;
    const nextStep = requestedStep > maxAccessibleStep ? maxAccessibleStep : requestedStep;
    if (state.step !== nextStep) {
      setStep(nextStep);
    }
  }, [maxAccessibleStep, pathname, requestedStep, setStep, state.step]);

  useEffect(() => {
    const expectedPath = STEP_PATHS[state.step];
    if (pathname !== expectedPath) {
      router.replace(expectedPath);
    }
  }, [pathname, router, state.step]);

  return (
    <OnboardingShell
      steps={ONBOARDING_STEPS}
      current={state.step}
      title="Launch your restaurant in minutes"
    >
      <StepError />
      {state.step === 1 && <AccountStep onComplete={noop} />}
      {state.step === 2 && <ProfileStep onComplete={noop} />}
      {state.step === 3 && <HoursStep onComplete={noop} />}
      {state.step === 4 && <ServicePeriodsStep onComplete={noop} />}
      {state.step === 5 && <TablesStep onComplete={noop} />}
      {state.step === 6 && <ReviewStep />}
    </OnboardingShell>
  );
}

export function OnboardingWizard({ initialState }: { initialState?: Partial<OnboardingState> }) {
  return (
    <OnboardingProvider initialState={initialState}>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
