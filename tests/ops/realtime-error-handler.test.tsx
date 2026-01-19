import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useRealtimeErrorHandler,
  type RealtimeError,
  type ErrorSeverity,
} from '@/hooks/ops/useRealtimeErrorHandler';

describe('useRealtimeErrorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
    // Clean up Sentry mock if present
    if ((window as any).Sentry) {
      delete (window as any).Sentry;
    }
  });

  describe('createError', () => {
    it('creates an error with all provided fields', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const beforeTime = new Date();
      let error: RealtimeError;
      act(() => {
        error = result.current.createError('CONNECTION_LOST', 'Lost connection to server', 'high', {
          channelId: 'test-channel',
        });
      });
      const afterTime = new Date();

      expect(error!.code).toBe('CONNECTION_LOST');
      expect(error!.message).toBe('Lost connection to server');
      expect(error!.severity).toBe('high');
      expect(error!.context).toEqual({ channelId: 'test-channel' });
      expect(error!.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(error!.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('uses default severity of medium when not provided', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      let error: RealtimeError;
      act(() => {
        error = result.current.createError('MINOR_ISSUE', 'Something minor happened');
      });

      expect(error!.severity).toBe('medium');
    });

    it('creates error without context when not provided', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      let error: RealtimeError;
      act(() => {
        error = result.current.createError('TEST_ERROR', 'Test message', 'low');
      });

      expect(error!.context).toBeUndefined();
    });

    it('creates errors with each severity level', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());
      const severities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];

      severities.forEach((severity) => {
        let error: RealtimeError;
        act(() => {
          error = result.current.createError('TEST', 'Test', severity);
        });
        expect(error!.severity).toBe(severity);
      });
    });
  });

  describe('handleError', () => {
    it('logs error in development mode', () => {
      process.env.NODE_ENV = 'development';
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
        severity: 'medium',
      };

      act(() => {
        result.current.handleError(error);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Realtime Error]', error);
    });

    it('does not log error in production mode (via console.error spy)', () => {
      process.env.NODE_ENV = 'production';
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
        severity: 'low',
      };

      act(() => {
        result.current.handleError(error);
      });

      // In production, the [Realtime Error] log should not be called
      expect(consoleErrorSpy).not.toHaveBeenCalledWith('[Realtime Error]', error);
    });

    it('triggers critical alert for critical severity', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'CRITICAL_FAILURE',
        message: 'System critical failure',
        timestamp: new Date(),
        severity: 'critical',
      };

      act(() => {
        result.current.handleError(error);
      });

      // Critical alert uses console.error with specific formatting
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL REALTIME ERROR'),
        expect.any(String),
        expect.any(String),
        error,
      );
    });

    it('sends analytics alert for high severity', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'HIGH_ERROR',
        message: 'High priority error',
        timestamp: new Date(),
        severity: 'high',
      };

      act(() => {
        result.current.handleError(error);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Realtime error'), error);
    });

    it('logs to analytics for medium severity', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'MEDIUM_ERROR',
        message: 'Medium priority error',
        timestamp: new Date(),
        severity: 'medium',
      };

      act(() => {
        result.current.handleError(error);
      });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Realtime issue'),
        error.message,
      );
    });

    it('does not trigger any special alert for low severity', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'LOW_ERROR',
        message: 'Low priority error',
        timestamp: new Date(),
        severity: 'low',
      };

      act(() => {
        result.current.handleError(error);
      });

      // Low severity should only trigger console.error in dev mode, no special alerts
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });

    it('sends to Sentry when available', () => {
      const mockSentry = {
        captureException: vi.fn(),
      };
      (window as any).Sentry = mockSentry;

      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'SENTRY_ERROR',
        message: 'Error for Sentry',
        timestamp: new Date(),
        severity: 'high',
        context: { userId: 'user-123' },
      };

      act(() => {
        result.current.handleError(error);
      });

      expect(mockSentry.captureException).toHaveBeenCalledWith('Error for Sentry', {
        tags: {
          realtime_error_code: 'SENTRY_ERROR',
          severity: 'high',
          component: 'realtime',
        },
        extra: { userId: 'user-123' },
      });
    });

    it('does not throw when Sentry is not available', () => {
      // Ensure Sentry is not available
      delete (window as any).Sentry;

      const { result } = renderHook(() => useRealtimeErrorHandler());

      const error: RealtimeError = {
        code: 'NO_SENTRY',
        message: 'Error without Sentry',
        timestamp: new Date(),
        severity: 'medium',
      };

      expect(() => {
        act(() => {
          result.current.handleError(error);
        });
      }).not.toThrow();
    });
  });

  describe('hook stability', () => {
    it('returns stable function references across rerenders', () => {
      const { result, rerender } = renderHook(() => useRealtimeErrorHandler());

      const firstHandleError = result.current.handleError;
      const firstCreateError = result.current.createError;

      rerender();

      expect(result.current.handleError).toBe(firstHandleError);
      expect(result.current.createError).toBe(firstCreateError);
    });
  });

  describe('integration: createError + handleError', () => {
    it('can create and immediately handle an error', () => {
      const { result } = renderHook(() => useRealtimeErrorHandler());

      act(() => {
        const error = result.current.createError(
          'SUBSCRIPTION_FAILED',
          'Failed to subscribe to channel',
          'high',
          { channel: 'bookings' },
        );
        result.current.handleError(error);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Realtime error'),
        expect.objectContaining({
          code: 'SUBSCRIPTION_FAILED',
          message: 'Failed to subscribe to channel',
          severity: 'high',
          context: { channel: 'bookings' },
        }),
      );
    });
  });
});
