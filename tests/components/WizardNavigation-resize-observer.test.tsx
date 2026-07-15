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
  const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

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
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  });

  afterEach(() => {
    if (resizeObserverDescriptor) {
      Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
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

describe('WizardNavigation height observer contract', () => {
  const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  let callback: ResizeObserverCallback | undefined;
  let measuredHeight = 72;

  class ResizeObserverStub implements ResizeObserver {
    constructor(observerCallback: ResizeObserverCallback) {
      callback = observerCallback;
    }

    disconnect(): void {}
    observe(): void {}
    unobserve(): void {}
  }

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverStub,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ height: measuredHeight }),
    );
  });

  afterEach(() => {
    if (resizeObserverDescriptor) {
      Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
    callback = undefined;
    measuredHeight = 72;
    vi.restoreAllMocks();
  });

  it('reports the collapsed rail height and reports zero when hidden', () => {
    const onHeightChange = vi.fn();
    const { rerender } = render(
      <WizardNavigation {...baseProps} onHeightChange={onHeightChange} />,
    );

    expect(document.querySelector('[data-wizard-navigation-rail]')).toBeInTheDocument();
    expect(onHeightChange).toHaveBeenLastCalledWith(72);

    measuredHeight = 96;
    const observer: ResizeObserver = {
      disconnect(): void {},
      observe(): void {},
      unobserve(): void {},
    };
    callback?.([], observer);
    expect(onHeightChange).toHaveBeenLastCalledWith(96);

    rerender(<WizardNavigation {...baseProps} visible={false} onHeightChange={onHeightChange} />);
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });

  it('reports zero when the navigation unmounts', () => {
    const onHeightChange = vi.fn();
    const { unmount } = render(<WizardNavigation {...baseProps} onHeightChange={onHeightChange} />);

    unmount();
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });
});
