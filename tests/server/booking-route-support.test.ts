import { afterEach, describe, expect, it, vi } from 'vitest';

import { stringifyError } from '@/server/bookings/error-formatting';
import { retryWithBackoff } from '@/server/bookings/retry';
import { getPrimaryValidationIssue } from '@/server/bookings/validation-issues';

describe('booking route support helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('returns the first successful result without scheduling retries', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      await expect(retryWithBackoff(fn)).resolves.toBe('ok');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it('retries failures with exponential delays before returning success', async () => {
      vi.useFakeTimers();
      const fn = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'))
        .mockResolvedValue('ok');
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

      const result = retryWithBackoff(fn, {
        attempts: 3,
        initialDelayMs: 10,
        multiplier: 3,
      });

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(30);

      await expect(result).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 10);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 30);
    });

    it('throws the final Error after attempts are exhausted', async () => {
      vi.useFakeTimers();
      const finalError = new Error('final');
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(finalError);

      const result = retryWithBackoff(fn, {
        attempts: 2,
        initialDelayMs: 5,
      });
      const assertion = expect(result).rejects.toThrow(finalError);

      await vi.advanceTimersByTimeAsync(5);

      await assertion;
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('wraps non-Error final rejections', async () => {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue('plain failure');

      await expect(retryWithBackoff(fn, { attempts: 1 })).rejects.toThrow('plain failure');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('stringifyError', () => {
    it('uses stack or message for Error values', () => {
      const error = new Error('stacked');
      error.stack = 'custom stack';

      expect(stringifyError(error)).toBe('custom stack');

      const messageOnly = new Error('message only');
      messageOnly.stack = '';

      expect(stringifyError(messageOnly)).toBe('message only');
    });

    it('returns string values unchanged', () => {
      expect(stringifyError('plain failure')).toBe('plain failure');
    });

    it('serializes plain objects with indentation', () => {
      expect(stringifyError({ code: 'E_TEST' })).toBe('{\n  "code": "E_TEST"\n}');
    });

    it('falls back to String when JSON serialization fails', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(stringifyError(circular)).toBe('[object Object]');
    });
  });

  describe('getPrimaryValidationIssue', () => {
    it('returns the first validation issue', () => {
      expect(
        getPrimaryValidationIssue({
          ok: false,
          issues: [
            { code: 'CAPACITY_EXCEEDED', message: 'Full' },
            { code: 'OUTSIDE_HOURS', message: 'Closed' },
          ],
        }),
      ).toEqual({ code: 'CAPACITY_EXCEEDED', message: 'Full' });
    });

    it('returns null when the response has no issues', () => {
      expect(getPrimaryValidationIssue({ ok: false, issues: [] })).toBeNull();
    });
  });
});
