'use client';

import * as React from 'react';

import { WizardLayout, type WizardHeroRef } from './WizardLayout';
import { WizardNavigation } from './WizardNavigation';

import type { WizardStepMeta, WizardSummary } from './WizardProgress';
import type { StepAction } from '../model/reducer';

type WizardContextValue = {
  steps: WizardStepMeta[];
  currentStep: number;
  totalSteps: number;
};

const WizardContext = React.createContext<WizardContextValue | null>(null);

export interface WizardContainerProps {
  steps: WizardStepMeta[];
  currentStep: number;
  actions: StepAction[];
  summary: WizardSummary;
  heroRef?: WizardHeroRef;
  stickyHeight?: number;
  stickyVisible?: boolean;
  onStickyHeightChange?: (height: number) => void;
  banner?: React.ReactNode;
  children: React.ReactNode;
  layoutElement?: 'main' | 'div';
}

export function WizardContainer({
  steps,
  currentStep,
  actions,
  summary,
  heroRef,
  stickyHeight = 0,
  stickyVisible = false,
  onStickyHeightChange,
  banner,
  children,
  layoutElement = 'main',
}: WizardContainerProps) {
  const totalSteps = steps.length || 1;
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);

  const providerValue = React.useMemo<WizardContextValue>(
    () => ({ steps, currentStep: clampedStep, totalSteps }),
    [steps, clampedStep, totalSteps],
  );

  const srAnnouncement = React.useMemo(() => {
    const summaryText =
      summary.srLabel ?? `${summary.primary}. ${summary.details?.join(', ') ?? ''}`;
    return `Step ${clampedStep} of ${totalSteps}. ${summaryText}`;
  }, [clampedStep, summary.details, summary.primary, summary.srLabel, totalSteps]);

  return (
    <WizardContext.Provider value={providerValue}>
      <WizardLayout
        heroRef={heroRef}
        stickyHeight={stickyHeight}
        stickyVisible={stickyVisible}
        banner={banner}
        elementType={layoutElement}
        footer={
          <WizardNavigation
            steps={steps}
            currentStep={clampedStep}
            summary={summary}
            actions={actions}
            visible={stickyVisible}
            onHeightChange={onStickyHeightChange}
          />
        }
      >
        <div className="sr-only" aria-live="polite">
          {srAnnouncement}
        </div>
        {children}
      </WizardLayout>
    </WizardContext.Provider>
  );
}

export function useWizardContext() {
  const context = React.useContext(WizardContext);
  if (!context) {
    return { steps: [], currentStep: 1, totalSteps: 1 } as WizardContextValue;
  }
  return context;
}
