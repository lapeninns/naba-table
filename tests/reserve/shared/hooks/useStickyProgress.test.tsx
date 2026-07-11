import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStickyProgress } from '@shared/hooks/useStickyProgress';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observerCallback: ObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

class IntersectionObserverMock {
  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

afterEach(() => {
  globalThis.IntersectionObserver = originalIntersectionObserver;
  observerCallback = null;
  vi.clearAllMocks();
});

describe('useStickyProgress', () => {
  it('tracks anchor visibility through the intersection observer @contract', () => {
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver;
    const anchor = document.createElement('div');
    const anchorRef = { current: anchor };

    const { result } = renderHook(() => useStickyProgress(anchorRef));

    expect(observe).toHaveBeenCalledWith(anchor);
    expect(result.current.isAnchorVisible).toBe(true);
    expect(result.current.shouldShow).toBe(true);

    act(() => {
      observerCallback?.([{ isIntersecting: false }]);
    });
    expect(result.current.isAnchorVisible).toBe(false);

    act(() => {
      observerCallback?.([{ isIntersecting: true }]);
    });
    expect(result.current.isAnchorVisible).toBe(true);
  });

  it('disconnects the observer on unmount @contract', () => {
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver;
    const anchorRef = { current: document.createElement('div') };

    const { unmount } = renderHook(() => useStickyProgress(anchorRef));
    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('stays visible without observing when the anchor is missing @contract', () => {
    globalThis.IntersectionObserver =
      IntersectionObserverMock as unknown as typeof IntersectionObserver;
    const anchorRef = { current: null };

    const { result } = renderHook(() => useStickyProgress(anchorRef));

    expect(observe).not.toHaveBeenCalled();
    expect(result.current.isAnchorVisible).toBe(true);
  });
});
