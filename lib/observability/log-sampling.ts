const counters = new Map<string, number>();

/**
 * Deterministic per-process sampler for routine (healthy, repetitive) logs.
 * Returns true for the first occurrence of `key` and then once every `rate`
 * occurrences, so a steady stream keeps a representative sample without
 * drowning the log store. Callers must ALWAYS log errors and abnormally slow
 * requests unconditionally — only route the routine/healthy case through this.
 */
export function sampleRoutineLog(key: string, rate: number): boolean {
  if (rate <= 1) return true;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return next % rate === 1;
}

export function resetLogSamplingForTests(): void {
  counters.clear();
}
