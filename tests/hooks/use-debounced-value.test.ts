import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '@src/hooks/use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 200));

    expect(result.current).toBe('initial');
  });

  it('@contract only exposes a new value after the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('second');
  });

  it('@contract restarts the timer on rapid changes so intermediate values never surface', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('abc');
  });

  it('@contract cancels the pending update on unmount', () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'x' },
    });

    rerender({ value: 'y' });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
