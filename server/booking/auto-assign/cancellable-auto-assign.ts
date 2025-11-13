export class CancellableAutoAssign {
  constructor(private readonly timeoutMs: number) {}

  async runWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    onAbort?: () => Promise<void> | void,
  ): Promise<T> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        (async () => {
          try {
            if (onAbort) {
              await onAbort();
            }
          } catch (hookError) {
            console.error("[auto-assign] inline timeout cleanup failed", hookError);
          }
          const abortError = new Error("Inline auto-assign timed out");
          abortError.name = "AbortError";
          reject(abortError);
        })();
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([operation(controller.signal), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
