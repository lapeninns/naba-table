import { fetchJson } from "@/lib/http/fetchJson";

const OPS_SELECTOR_METRICS_BASE = "/api/ops/metrics/selector";

export type SelectorMetricsSummary = {
  assignmentsTotal: number;
  skippedTotal: number;
  mergeRate: number;
  avgOverage: number;
  avgDurationMs: number;
  p95DurationMs: number | null;
};

export type SelectorSkipReason = {
  reason: string;
  count: number;
};

export type SelectorMetricSample = {
  createdAt: string;
  bookingId: string | null;
  selected: Record<string, unknown> | null;
  skipReason: string | null;
  topCandidates: unknown[];
  durationMs: number | null;
};

export type SelectorMetricsResponse = {
  summary: SelectorMetricsSummary;
  skipReasons: SelectorSkipReason[];
  samples: SelectorMetricSample[];
};

export async function getSelectorMetrics(restaurantId: string, date?: string): Promise<SelectorMetricsResponse> {
  const params = new URLSearchParams({ restaurantId });
  if (date) {
    params.set("date", date);
  }

  const response = await fetchJson<SelectorMetricsResponse>(`${OPS_SELECTOR_METRICS_BASE}?${params.toString()}`, {
    method: "GET",
  });

  return response;
}
