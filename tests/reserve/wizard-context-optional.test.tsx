// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  useWizardActions,
  useWizardContext,
  useWizardState,
} from '@features/reservations/wizard/context/WizardContext';

// triage-091: step hooks support a "legacy explicit props" contract; useWizardState/useWizardActions
// must NOT throw when rendered outside a WizardProvider (they return null and the caller falls back
// to its explicit props). useWizardContext()/useWizardNavigation() still throw by design.
describe('wizard context hooks outside a provider (triage-091)', () => {
  it('useWizardState() returns null instead of throwing outside WizardProvider', () => {
    const { result } = renderHook(() => useWizardState());
    expect(result.current).toBeNull();
  });

  it('useWizardActions() returns null instead of throwing outside WizardProvider', () => {
    const { result } = renderHook(() => useWizardActions());
    expect(result.current).toBeNull();
  });

  it('useWizardContext() still throws outside WizardProvider', () => {
    expect(() => renderHook(() => useWizardContext())).toThrow(/WizardProvider/);
  });
});
