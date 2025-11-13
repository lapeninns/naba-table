export class CircuitBreakerOpenError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Circuit breaker open. Retry after ${retryAfterMs}ms`);
    this.name = "CircuitBreakerOpenError";
  }
}

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenSuccesses?: number;
};

export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private nextAttemptAt = 0;
  private halfOpenSuccessCount = 0;

  constructor(private readonly options: CircuitBreakerOptions = {}) {}

  isOpen(): boolean {
    if (this.state === "open" && Date.now() >= this.nextAttemptAt) {
      this.state = "half-open";
      this.halfOpenSuccessCount = 0;
      return false;
    }
    return this.state === "open";
  }

  remainingCooldownMs(): number {
    if (this.state !== "open") {
      return 0;
    }
    return Math.max(0, this.nextAttemptAt - Date.now());
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitBreakerOpenError(this.remainingCooldownMs());
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.halfOpenSuccessCount += 1;
      if (this.halfOpenSuccessCount >= (this.options.halfOpenSuccesses ?? 2)) {
        this.reset();
      }
      return;
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    if (this.state === "half-open") {
      this.trip();
      return;
    }
    this.failureCount += 1;
    if (this.failureCount >= (this.options.failureThreshold ?? 5)) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = "open";
    this.nextAttemptAt = Date.now() + (this.options.cooldownMs ?? 15_000);
    this.failureCount = 0;
  }

  private reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.nextAttemptAt = 0;
    this.halfOpenSuccessCount = 0;
  }
}
