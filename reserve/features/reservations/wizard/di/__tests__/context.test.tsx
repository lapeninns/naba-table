import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  WizardDependenciesProvider,
  useWizardDependencies,
  defaultWizardDependencies,
  type AnalyticsTracker,
} from '@features/reservations/wizard/di';

describe('WizardDependenciesProvider', () => {
  it('returns default dependencies when no overrides provided', () => {
    const { result } = renderHook(() => useWizardDependencies(), {
      wrapper: ({ children }) => (
        <WizardDependenciesProvider>{children}</WizardDependenciesProvider>
      ),
    });

    expect(result.current.analytics).toBe(defaultWizardDependencies.analytics);
    expect(result.current.haptics).toBe(defaultWizardDependencies.haptics);
    expect(result.current.navigator).toBe(defaultWizardDependencies.navigator);
    expect(result.current.errorReporter).toBe(defaultWizardDependencies.errorReporter);
  });

  it('merges provided overrides with defaults', () => {
    const tracker: AnalyticsTracker = {
      track: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WizardDependenciesProvider value={{ analytics: tracker }}>
        {children}
      </WizardDependenciesProvider>
    );

    const { result } = renderHook(() => useWizardDependencies(), { wrapper });

    expect(result.current.analytics).toBe(tracker);
    expect(result.current.haptics).toBe(defaultWizardDependencies.haptics);
    expect(result.current.navigator).toBe(defaultWizardDependencies.navigator);
    expect(result.current.errorReporter).toBe(defaultWizardDependencies.errorReporter);

    result.current.analytics.track('test-event');
    expect(tracker.track).toHaveBeenCalledWith('test-event');
  });
});
