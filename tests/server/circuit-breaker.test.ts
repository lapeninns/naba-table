import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from '../../server/lib/circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after failure threshold and transitions to half_open after duration', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 2, openDurationMs: 1000 });

    await expect(
      cb.run(async () => {
        throw new Error('fail-1');
      }),
    ).rejects.toThrow('fail-1');
    expect(cb.getState()).toBe('closed');

    await expect(
      cb.run(async () => {
        throw new Error('fail-2');
      }),
    ).rejects.toThrow('fail-2');
    expect(cb.getState()).toBe('open');

    await expect(cb.run(async () => 'nope')).rejects.toThrow('circuit breaker open');

    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('half_open');

    await expect(cb.run(async () => 'ok')).resolves.toBe('ok');
    expect(cb.getState()).toBe('closed');
    vi.useRealTimers();
  });
});
