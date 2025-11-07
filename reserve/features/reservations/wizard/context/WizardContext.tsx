import React, { createContext, useCallback, useContext, useMemo } from 'react';

import type { State } from '../model/reducer';
import type { WizardActions } from '../model/store';

interface WizardContextValue {
  state: State;
  actions: WizardActions;
  goToStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizardContext() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContext must be used within WizardProvider');
  }
  return context;
}

interface WizardProviderProps {
  children: React.ReactNode;
  state: State;
  actions: WizardActions;
}

export function WizardProvider({ children, state, actions }: WizardProviderProps) {
  const totalSteps = 4;
  const currentStepIndex = state.step;

  const canGoBack = useMemo(() => {
    return currentStepIndex > 1 && !state.submitting && !state.loading;
  }, [currentStepIndex, state.loading, state.submitting]);

  const canGoForward = useMemo(() => {
    return currentStepIndex < totalSteps && !state.submitting && !state.loading;
  }, [currentStepIndex, state.loading, state.submitting, totalSteps]);

  const goToStep = useCallback(
    (step: number) => {
      if (step < 1 || step > totalSteps) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[wizard-context] Invalid step requested', step);
        }
        return;
      }
      actions.goToStep(step as State['step']);
    },
    [actions, totalSteps],
  );

  const goToNextStep = useCallback(() => {
    if (canGoForward) {
      goToStep(currentStepIndex + 1);
    }
  }, [canGoForward, currentStepIndex, goToStep]);

  const goToPreviousStep = useCallback(() => {
    if (canGoBack) {
      goToStep(currentStepIndex - 1);
    }
  }, [canGoBack, currentStepIndex, goToStep]);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      actions,
      goToStep,
      goToNextStep,
      goToPreviousStep,
      canGoBack,
      canGoForward,
      currentStepIndex,
      totalSteps,
    }),
    [
      state,
      actions,
      goToStep,
      goToNextStep,
      goToPreviousStep,
      canGoBack,
      canGoForward,
      currentStepIndex,
      totalSteps,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizardState() {
  return useWizardContext().state;
}

export function useWizardActions() {
  return useWizardContext().actions;
}

export function useWizardNavigation() {
  const {
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canGoBack,
    canGoForward,
    currentStepIndex,
    totalSteps,
  } = useWizardContext();

  return {
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canGoBack,
    canGoForward,
    currentStepIndex,
    totalSteps,
  };
}
