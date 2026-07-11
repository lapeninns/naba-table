import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRealtimeErrorHandler } from '@src/hooks/ops/useRealtimeErrorHandler';

const NOW_ISO = '2026-07-11T12:00:00.000Z';

describe('useRealtimeErrorHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract createError fills defaults deterministically', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());

    const error = result.current.createError('CHANNEL_DOWN', 'lost connection');

    expect(error).toEqual({
      code: 'CHANNEL_DOWN',
      message: 'lost connection',
      severity: 'medium',
      timestamp: new Date(NOW_ISO),
      context: undefined,
    });
  });

  it('@contract createError carries explicit severity and context through', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());

    const error = result.current.createError('SUB_FAIL', 'nope', 'critical', { channel: 'x' });

    expect(error.severity).toBe('critical');
    expect(error.context).toEqual({ channel: 'x' });
  });

  it('@contract routes critical errors to the critical alert channel', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());
    const error = result.current.createError('FATAL', 'boom', 'critical');

    result.current.handleError(error);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL REALTIME ERROR'),
      expect.any(String),
      expect.any(String),
      error,
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('@contract routes high severity errors to the warning channel', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());
    const error = result.current.createError('DEGRADED', 'slow', 'high');

    result.current.handleError(error);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('DEGRADED'),
      error,
    );
  });

  it('@contract routes medium severity errors to the info channel', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());
    const error = result.current.createError('RETRYING', 'transient');

    result.current.handleError(error);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('RETRYING'),
      'transient',
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('@contract low severity errors produce no alerts', () => {
    const { result } = renderHook(() => useRealtimeErrorHandler());
    const error = result.current.createError('NOISE', 'ignorable', 'low');

    result.current.handleError(error);

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
});
