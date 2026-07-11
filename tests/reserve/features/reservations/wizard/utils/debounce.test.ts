import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce, useDebounce, useThrottle } from '@features/reservations/wizard/utils/debounce';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('delays execution until the wait elapses @contract', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 200);

    debounced('first');
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledWith('first');
  });

  it('collapses rapid calls into the last one @contract', () => {
    const spy = vi.fn();
    const debounced = debounce(spy, 200);

    debounced('first');
    vi.advanceTimersByTime(100);
    debounced('second');
    vi.advanceTimersByTime(200);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('second');
  });
});

describe('useDebounce', () => {
  it('invokes the latest callback after the delay @contract', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useDebounce(callback as (...args: unknown[]) => unknown, 150),
      { initialProps: { callback: first } },
    );

    result.current('payload');
    // Swap the callback while the timer is pending; the hook must use the latest.
    rerender({ callback: second });
    vi.advanceTimersByTime(150);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('payload');
  });

  it('cancels the pending call on unmount @contract', () => {
    const spy = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebounce(spy as (...args: unknown[]) => unknown, 150),
    );

    result.current();
    unmount();
    vi.advanceTimersByTime(300);

    expect(spy).not.toHaveBeenCalled();
  });

  it('restarts the delay on every call @contract', () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useDebounce(spy as (...args: unknown[]) => unknown, 100));

    result.current('a');
    vi.advanceTimersByTime(60);
    result.current('b');
    vi.advanceTimersByTime(60);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('b');
  });
});

describe('useThrottle', () => {
  it('runs immediately then suppresses calls inside the window @contract', () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useThrottle(spy as (...args: unknown[]) => unknown, 500));

    result.current('first');
    result.current('second');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('first');
  });

  it('allows another call once the window has passed @contract', () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useThrottle(spy as (...args: unknown[]) => unknown, 500));

    result.current('first');
    vi.advanceTimersByTime(500);
    result.current('second');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('second');
  });
});
