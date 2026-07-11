import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  WizardDependenciesProvider,
  useWizardDependencies,
} from '@features/reservations/wizard/di/context';
import {
  defaultWizardDependencies,
  type WizardDependencies,
} from '@features/reservations/wizard/di/types';

describe('useWizardDependencies', () => {
  it('returns the defaults when no provider is mounted @contract @smoke', () => {
    const { result } = renderHook(() => useWizardDependencies());
    expect(result.current).toBe(defaultWizardDependencies);
  });

  it('returns the defaults when the provider has no value @contract', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WizardDependenciesProvider>{children}</WizardDependenciesProvider>
    );
    const { result } = renderHook(() => useWizardDependencies(), { wrapper });
    expect(result.current).toBe(defaultWizardDependencies);
  });

  it('merges partial overrides while keeping default implementations @contract', () => {
    const analytics: WizardDependencies['analytics'] = { track: vi.fn() };
    const navigator: WizardDependencies['navigator'] = {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WizardDependenciesProvider value={{ analytics, navigator }}>
        {children}
      </WizardDependenciesProvider>
    );

    const { result } = renderHook(() => useWizardDependencies(), { wrapper });

    expect(result.current.analytics).toBe(analytics);
    expect(result.current.navigator).toBe(navigator);
    expect(result.current.haptics).toBe(defaultWizardDependencies.haptics);
    expect(result.current.errorReporter).toBe(defaultWizardDependencies.errorReporter);
  });
});
