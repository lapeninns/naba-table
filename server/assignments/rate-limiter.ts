export class RateLimitExceededError extends Error {
  constructor(public readonly resourceId: string) {
    super(`Rate limit exceeded for ${resourceId}`);
    this.name = "RateLimitExceededError";
  }
}

export class RateLimiter {
  private readonly counters = new Map<string, number>();

  constructor(private readonly maxConcurrentPerKey: number) {}

  async consume(key: string): Promise<{ release: () => void }> {
    if (!key) {
      return { release: () => undefined };
    }
    const current = this.counters.get(key) ?? 0;
    if (current >= this.maxConcurrentPerKey) {
      throw new RateLimitExceededError(key);
    }
    this.counters.set(key, current + 1);

    return {
      release: () => {
        const latest = this.counters.get(key) ?? 0;
        if (latest <= 1) {
          this.counters.delete(key);
        } else {
          this.counters.set(key, latest - 1);
        }
      },
    };
  }
}
