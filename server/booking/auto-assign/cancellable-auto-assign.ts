export class CancellableAutoAssign {
  constructor(private readonly timeoutMs: number) {}

  async runWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    onAbort?: () => Promise<void> | void,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await operation(controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        if (onAbort) {
          await onAbort();
        }
        const abortError = error instanceof Error ? error : new Error(String(error));
        abortError.name = "AbortError";
        throw abortError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
