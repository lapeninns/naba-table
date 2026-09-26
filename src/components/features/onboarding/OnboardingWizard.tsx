'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { OnboardingProvider, useOnboarding } from './context/OnboardingContext';
import { AccountStep, ProfileStep } from './OnboardingAccountProfileSteps';
import { navigateToOpsDashboard } from './onboardingLaunch';
import { HoursStep, ServicePeriodsStep } from './OnboardingScheduleSteps';
import { ReviewStep, TablesStep } from './OnboardingTablesReviewSteps';
import {
  getMaxAccessibleStep,
  ONBOARDING_STEPS,
  STEP_PATHS,
  stepFromPathname,
} from './onboardingWizardDomain';
import { OnboardingShell } from './ui/OnboardingShell';

import type { OnboardingResume, OnboardingState } from './types';

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

function AlreadyOnboarded() {
  return (
    <Alert>
      <AlertTitle>Your restaurant is already set up</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          This account already manages a restaurant. Change hours, services and tables from the
          dashboard.
        </p>
        <Button type="button" onClick={() => navigateToOpsDashboard()}>
          Go to dashboard
        </Button>
      </AlertDescription>
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
      {state.alreadyOnboarded && state.step > 1 ? <AlreadyOnboarded /> : null}
      {state.step === 1 && <AccountStep onComplete={noop} />}
      {!state.alreadyOnboarded && state.step === 2 && <ProfileStep onComplete={noop} />}
      {!state.alreadyOnboarded && state.step === 3 && <HoursStep onComplete={noop} />}
      {!state.alreadyOnboarded && state.step === 4 && <ServicePeriodsStep onComplete={noop} />}
      {!state.alreadyOnboarded && state.step === 5 && <TablesStep onComplete={noop} />}
      {!state.alreadyOnboarded && state.step === 6 && <ReviewStep />}
    </OnboardingShell>
  );
}

export function OnboardingWizard({
  initialState,
  resume,
}: {
  initialState?: Partial<OnboardingState>;
  resume?: OnboardingResume;
}) {
  return (
    <OnboardingProvider initialState={initialState} resume={resume}>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
