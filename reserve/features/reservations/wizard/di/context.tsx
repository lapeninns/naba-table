'use client';

import React, { createContext, useContext, useMemo } from 'react';

import { defaultWizardDependencies, type WizardDependencies } from './types';

const WizardDependenciesContext = createContext<WizardDependencies>(defaultWizardDependencies);

export type WizardDependenciesProviderProps = {
  value?: Partial<WizardDependencies>;
  children: React.ReactNode;
};

export function WizardDependenciesProvider({ value, children }: WizardDependenciesProviderProps) {
  const merged = useMemo<WizardDependencies>(() => {
    if (!value) {
      return defaultWizardDependencies;
    }

    return {
      analytics: value.analytics ?? defaultWizardDependencies.analytics,
      haptics: value.haptics ?? defaultWizardDependencies.haptics,
      navigator: value.navigator ?? defaultWizardDependencies.navigator,
      errorReporter: value.errorReporter ?? defaultWizardDependencies.errorReporter,
    };
  }, [value]);

  return (
    <WizardDependenciesContext.Provider value={merged}>
      {children}
    </WizardDependenciesContext.Provider>
  );
}

export function useWizardDependencies(): WizardDependencies {
  return useContext(WizardDependenciesContext);
}
