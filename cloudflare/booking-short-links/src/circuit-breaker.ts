export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open.');
    this.name = 'CircuitOpenError';
  }
}

type CircuitState = 'closed' | 'open' | 'half-open';

type CircuitBreakerOptions = {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
  readonly timeoutMs: number;
  readonly now?: () => number;
};

export function createCircuitBreaker(options: CircuitBreakerOptions): {
  execute: <T>(operation: () => Promise<T>) => Promise<T>;
  state: () => CircuitState;
} {
  const now = options.now ?? Date.now;
  let failures = 0;
  let openedAt = 0;
  let currentState: CircuitState = 'closed';

  async function withTimeout<T>(operation: () => Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Circuit breaker operation timed out.')),
        options.timeoutMs,
      );
    });
    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return {
    async execute<T>(operation: () => Promise<T>): Promise<T> {
      if (currentState === 'open') {
        if (now() - openedAt < options.cooldownMs) throw new CircuitOpenError();
        currentState = 'half-open';
      }

      try {
        const result = await withTimeout(operation);
        failures = 0;
        currentState = 'closed';
        return result;
      } catch (error) {
        failures += 1;
        if (currentState === 'half-open' || failures >= options.failureThreshold) {
          currentState = 'open';
          openedAt = now();
        }
        throw error;
      }
    },
    state: () => currentState,
  };
}
