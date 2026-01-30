export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerOptions = {
  failureThreshold: number;
  openDurationMs: number;
};

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private openedAtMs: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {
    if (!Number.isFinite(options.failureThreshold) || options.failureThreshold < 1) {
      throw new Error('failureThreshold must be >= 1');
    }
    if (!Number.isFinite(options.openDurationMs) || options.openDurationMs < 0) {
      throw new Error('openDurationMs must be >= 0');
    }
  }

  getState(): CircuitBreakerState {
    this.maybeTransition();
    return this.state;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransition();

    if (this.state === 'open') {
      throw new Error('circuit breaker open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private maybeTransition(): void {
    if (this.state !== 'open') {
      return;
    }

    const openedAt = this.openedAtMs;
    if (openedAt === null) {
      return;
    }

    const elapsed = Date.now() - openedAt;
    if (elapsed >= this.options.openDurationMs) {
      this.state = 'half_open';
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.openedAtMs = null;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.openedAtMs = Date.now();
    }
  }
}
