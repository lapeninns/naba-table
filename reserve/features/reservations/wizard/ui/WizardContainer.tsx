'use client';

import * as React from 'react';

import { WizardLayout, type WizardHeroRef, type WizardLayoutSurface } from './WizardLayout';
import { WizardNavigation } from './WizardNavigation';
import { WizardProgress } from './WizardProgress';

import type { WizardStepMeta, WizardSummary } from './WizardProgress';
import type { BookingWizardMode, StepAction } from '../model/reducer';

type WizardContextValue = {
  steps: WizardStepMeta[];
  currentStep: number;
  totalSteps: number;
  mode: BookingWizardMode;
  layoutSurface: WizardLayoutSurface;
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
  /** Restaurant name to display at the top of the wizard */
  restaurantName?: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
  layoutElement?: 'main' | 'div';
  layoutSurface?: WizardLayoutSurface;
  navigationClassName?: string;
  className?: string;
  contentClassName?: string;
  mode?: BookingWizardMode;
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
  restaurantName,
  banner,
  children,
  layoutElement = 'main',
  layoutSurface = 'guest',
  navigationClassName,
  className,
  contentClassName,
  mode = 'customer',
}: WizardContainerProps) {
  const totalSteps = steps.length || 1;
  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);

  const providerValue = React.useMemo<WizardContextValue>(
    () => ({ steps, currentStep: clampedStep, totalSteps, mode, layoutSurface }),
    [steps, clampedStep, totalSteps, mode, layoutSurface],
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
        restaurantName={restaurantName}
        banner={banner}
        elementType={layoutElement}
        surface={layoutSurface}
        className={className}
        contentClassName={contentClassName}
        progress={<WizardProgress steps={steps} currentStep={clampedStep} summary={summary} />}
        footer={
          <WizardNavigation
            steps={steps}
            currentStep={clampedStep}
            summary={summary}
            actions={actions}
            visible={stickyVisible}
            onHeightChange={onStickyHeightChange}
            surface={layoutSurface}
            className={navigationClassName}
          />
        }
      >
        {!stickyVisible ? (
          <div className="sr-only" aria-live="polite">
            {srAnnouncement}
          </div>
        ) : null}
        {children}
      </WizardLayout>
    </WizardContext.Provider>
  );
}

export function useWizardContext(): WizardContextValue {
  const context = React.useContext(WizardContext);
  if (!context) {
    return {
      steps: [],
      currentStep: 1,
      totalSteps: 1,
      mode: 'customer',
      layoutSurface: 'guest',
    };
  }
  return context;
}
