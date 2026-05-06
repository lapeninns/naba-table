'use client';

type DashboardPerfMeta = Record<string, number | string | boolean | null | undefined>;

export type DashboardPerfEntry = {
  name: string;
  durationMs: number;
  recordedAt: number;
  meta?: DashboardPerfMeta;
};

declare global {
  interface Window {
    __nabatableDashboardPerf?: DashboardPerfEntry[];
  }
}

const MAX_DASHBOARD_PERF_ENTRIES = 200;
const DASHBOARD_PERF_ENABLED = process.env.NODE_ENV !== 'production';

export function isDashboardPerfEnabled() {
  return (
    DASHBOARD_PERF_ENABLED && typeof window !== 'undefined' && typeof performance !== 'undefined'
  );
}

export function getDashboardPerfStart() {
  return isDashboardPerfEnabled() ? performance.now() : 0;
}

export function recordDashboardPerfMetric(name: string, startAt: number, meta?: DashboardPerfMeta) {
  if (!isDashboardPerfEnabled() || startAt <= 0) return;

  const entry: DashboardPerfEntry = {
    name,
    durationMs: Number((performance.now() - startAt).toFixed(2)),
    recordedAt: Date.now(),
    meta,
  };
  const entries = window.__nabatableDashboardPerf ?? [];
  entries.push(entry);
  if (entries.length > MAX_DASHBOARD_PERF_ENTRIES) {
    entries.splice(0, entries.length - MAX_DASHBOARD_PERF_ENTRIES);
  }
  window.__nabatableDashboardPerf = entries;

  performance.measure?.(name, {
    start: startAt,
    end: performance.now(),
    detail: meta,
  });
}
