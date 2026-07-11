import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCopyToClipboard } from '@src/hooks/use-copy-to-clipboard';

function stubClipboard(writeText: (() => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window.navigator, 'clipboard');
  });

  it('@contract starts idle', () => {
    stubClipboard(() => Promise.resolve());
    const { result } = renderHook(() => useCopyToClipboard());

    expect(result.current.status).toBe('idle');
  });

  it('@contract copies text, reports copied, and resets to idle after the delay', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);

    const { result } = renderHook(() => useCopyToClipboard(2000));

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy('table 12');
    });

    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledWith('table 12');
    expect(result.current.status).toBe('copied');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.status).toBe('idle');
  });

  it('@contract reports an error status when the clipboard write fails, then resets', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));

    const { result } = renderHook(() => useCopyToClipboard(1000));

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy('secret');
    });

    expect(copied).toBe(false);
    expect(result.current.status).toBe('error');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.status).toBe('idle');
  });

  it('@contract fails fast when the Clipboard API is unavailable', async () => {
    stubClipboard(undefined);

    const { result } = renderHook(() => useCopyToClipboard());

    let copied: boolean | undefined;
    await act(async () => {
      copied = await result.current.copy('nothing');
    });

    expect(copied).toBe(false);
    expect(result.current.status).toBe('error');
  });
});
