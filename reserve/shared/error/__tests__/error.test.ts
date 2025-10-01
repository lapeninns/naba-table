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
});

describe('defaultErrorReporter', () => {
  it('logs errors via console.error in non-production env', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    defaultErrorReporter.capture(new Error('capture test'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
