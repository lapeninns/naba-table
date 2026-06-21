import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WizardNavigation,
  type WizardNavigationProps,
} from '@reserve/features/reservations/wizard/ui/WizardNavigation';

const baseProps: WizardNavigationProps = {
  steps: [
    { id: 1, label: 'Plan' },
    { id: 2, label: 'Details' },
  ],
  currentStep: 1,
  summary: { primary: 'Booking summary' },
  actions: [{ id: 'next', label: 'Continue', onClick: () => {} }],
};

describe('WizardNavigation height observer without ResizeObserver', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    // jsdom's native matchMedia returns undefined here; provide a working stub so
    // usePrefersReducedMotion does not throw (mirrors other component tests).
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });

    // Simulate an environment (older browser / SSR) where ResizeObserver is absent.
    // @ts-expect-error - intentionally removing the global for the test.
    delete globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('renders and reports height without throwing when ResizeObserver is undefined', () => {
    const onHeightChange = vi.fn();

    expect(() =>
      render(<WizardNavigation {...baseProps} onHeightChange={onHeightChange} />),
    ).not.toThrow();

    // The guard must still take an initial measurement instead of bailing entirely.
    expect(onHeightChange).toHaveBeenCalled();
    expect(typeof onHeightChange.mock.calls[0]?.[0]).toBe('number');
  });
});
