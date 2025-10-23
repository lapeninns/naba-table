import { describe, expect, it, vi } from 'vitest';

import { defaultErrorReporter, mapErrorToMessage } from '@reserve/shared/error';

describe('mapErrorToMessage', () => {
  it('returns fallback when error is nullish', () => {
    expect(mapErrorToMessage(undefined, 'fallback')).toBe('fallback');
    expect(mapErrorToMessage(null, 'oops')).toBe('oops');
  });

  it('returns string errors directly', () => {
    expect(mapErrorToMessage('Some error', 'fallback')).toBe('Some error');
    expect(mapErrorToMessage('   ', 'fallback')).toBe('fallback');
  });

  it('returns message from Error instances', () => {
    expect(mapErrorToMessage(new Error('Boom'), 'fallback')).toBe('Boom');
  });

  it('returns message property from plain objects', () => {
    expect(mapErrorToMessage({ message: 'Plain error' }, 'fallback')).toBe('Plain error');
    expect(mapErrorToMessage({ message: '   ' }, 'fallback')).toBe('fallback');
  });

  it('returns error field when present', () => {
    expect(mapErrorToMessage({ error: 'API exploded' }, 'fallback')).toBe('API exploded');
  });

  it('returns first validation issue message', () => {
    expect(
      mapErrorToMessage(
        {
          issues: [
            { code: 'CAPACITY_EXCEEDED', message: 'Too many covers' },
            { code: 'OTHER', message: 'Another issue' },
          ],
        },
        'fallback',
      ),
    ).toBe('Too many covers');
  });

  it('maps known error codes to friendly copy', () => {
    expect(mapErrorToMessage({ code: 'CAPACITY_EXCEEDED' }, 'fallback')).toBe(
      'No tables are available at that time. Please choose another slot.',
    );
    expect(mapErrorToMessage({ errorCode: 'RATE_LIMITED' }, 'fallback')).toBe(
      'Too many booking attempts right now. Please wait a moment and try again.',
    );
  });
});

describe('defaultErrorReporter', () => {
  it('logs errors via console.error in non-production env', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    defaultErrorReporter.capture(new Error('capture test'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
