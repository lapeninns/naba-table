import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useGbpInitialRefresh } from '@/components/features/restaurant-settings/google-business-profile/useGbpInitialRefresh';

describe('initial Google comparison refresh', () => {
  it('fetches an unchecked listing once, including under Strict Mode', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      () =>
        useGbpInitialRefresh({
          connectionKey: 'venue:listing',
          enabled: true,
          checkedAt: null,
          refresh,
        }),
      { wrapper: StrictMode },
    );
    rerender();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('waits for loaded controls and a writable UI before starting', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useGbpInitialRefresh({ connectionKey: 'venue:listing', enabled, checkedAt: null, refresh }),
      { initialProps: { enabled: false } },
    );
    expect(refresh).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retains a recent comparison without an unnecessary Google request', () => {
    const refresh = vi.fn();
    renderHook(() =>
      useGbpInitialRefresh({
        connectionKey: 'venue:listing',
        enabled: true,
        checkedAt: new Date().toISOString(),
        refresh,
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes an old comparison on entry but does not retry a failed request on rerender', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(() =>
      useGbpInitialRefresh({
        connectionKey: 'venue:listing',
        enabled: true,
        checkedAt: '2020-01-01T00:00:00Z',
        refresh,
      }),
    );
    rerender();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('starts a separate request after switching to another listing', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ connectionKey }) =>
        useGbpInitialRefresh({ connectionKey, enabled: true, checkedAt: null, refresh }),
      { initialProps: { connectionKey: 'venue:one' } },
    );
    rerender({ connectionKey: 'venue:two' });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
