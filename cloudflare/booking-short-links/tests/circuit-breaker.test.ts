import { describe, expect, it, vi } from 'vitest';

import { CircuitOpenError, createCircuitBreaker } from '../src/circuit-breaker';

describe('booking short-link circuit breaker', () => {
  it('opens after the failure threshold and recovers after cooldown', async () => {
    let now = 100;
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 50,
      timeoutMs: 1_000,
      now: () => now,
    });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('D1 unavailable'))
      .mockRejectedValueOnce(new Error('D1 unavailable'))
      .mockResolvedValue('recovered');

    await expect(breaker.execute(operation)).rejects.toThrow('D1 unavailable');
    await expect(breaker.execute(operation)).rejects.toThrow('D1 unavailable');
    await expect(breaker.execute(operation)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(operation).toHaveBeenCalledTimes(2);

    now += 51;
    await expect(breaker.execute(operation)).resolves.toBe('recovered');
    expect(breaker.state()).toBe('closed');
  });
});
