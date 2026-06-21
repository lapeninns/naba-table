import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  useWizardActions,
  useWizardContext,
  useWizardNavigation,
  useWizardState,
} from '@reserve/features/reservations/wizard/context/WizardContext';
import { useConfirmationStep } from '@reserve/features/reservations/wizard/hooks/useConfirmationStep';
import { getInitialState } from '@reserve/features/reservations/wizard/model/reducer';

// triage-091: the "legacy explicit props" contract means step hooks may run
// outside a WizardProvider. The state/actions accessors must therefore degrade
// to null instead of throwing, while the provider-required accessors keep
// throwing so genuine misuse is still caught.
describe('Wizard context optional accessors', () => {
  it('useWizardState returns null when no provider is present', () => {
    const { result } = renderHook(() => useWizardState());
    expect(result.current).toBeNull();
  });

  it('useWizardActions returns null when no provider is present', () => {
    const { result } = renderHook(() => useWizardActions());
    expect(result.current).toBeNull();
  });

  it('useWizardContext still throws when no provider is present', () => {
    // Silence the React error-boundary console noise for the expected throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWizardContext())).toThrow(
      /must be used within WizardProvider/,
    );
    spy.mockRestore();
  });

  it('useWizardNavigation still throws when no provider is present', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWizardNavigation())).toThrow(
      /must be used within WizardProvider/,
    );
    spy.mockRestore();
  });

  it('lets a step hook run on explicit props without a WizardProvider', () => {
    const state = getInitialState({
      restaurantName: 'Legacy Bistro',
      date: '2030-09-15',
      time: '19:00',
      party: 2,
    });

    const { result } = renderHook(() =>
      useConfirmationStep({
        state,
        onNewBooking: vi.fn(),
        onClose: vi.fn(),
        onActionsChange: vi.fn(),
      }),
    );

    // Before triage-091 this threw because useWizardState() crashed without a
    // provider even though explicit state was supplied.
    expect(result.current.details.restaurantName).toBe('Legacy Bistro');
  });
});
