export type RetryWithBackoffOptions = {
  attempts?: number;
  initialDelayMs?: number;
  multiplier?: number;
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryWithBackoffOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const initialDelayMs = options.initialDelayMs ?? 200;
  const multiplier = options.multiplier ?? 2;

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === attempts - 1) break;
      const delay = initialDelayMs * Math.pow(multiplier, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
