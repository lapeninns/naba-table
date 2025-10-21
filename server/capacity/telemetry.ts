import { recordObservabilityEvent } from "@/server/observability";

type CandidateSummary = {
  tableIds: string[];
  tableNumbers: string[];
  totalCapacity: number;
  tableCount: number;
  slack?: number;
  score?: number;
};

export type SelectorDecisionEvent = {
  restaurantId: string;
  bookingId: string;
  partySize: number;
  window?: { start: string | null; end: string | null };
  candidates: CandidateSummary[];
  selected?: CandidateSummary | null;
  skipReason?: string | null;
  durationMs: number;
  featureFlags: {
    selectorScoring: boolean;
    opsMetrics: boolean;
  };
};

export async function emitSelectorDecision(event: SelectorDecisionEvent): Promise<void> {
  const logPayload = {
    type: "capacity.selector",
    timestamp: new Date().toISOString(),
    restaurantId: event.restaurantId,
    bookingId: event.bookingId,
    partySize: event.partySize,
    window: event.window ?? null,
    selected: event.selected ?? null,
    topCandidates: event.candidates,
    candidates: event.candidates,
    skipReason: event.skipReason ?? null,
    durationMs: event.durationMs,
    featureFlags: event.featureFlags,
  };

  try {
    console.log(JSON.stringify(logPayload));
  } catch (error) {
    console.error("[capacity.selector] failed to serialize log payload", {
      error,
      bookingId: event.bookingId,
      restaurantId: event.restaurantId,
    });
  }

  try {
    await recordObservabilityEvent({
      source: "capacity.selector",
      eventType: event.selected ? "capacity.selector.assignment" : "capacity.selector.skipped",
      severity: event.skipReason ? "warning" : "info",
      context: logPayload,
    });
  } catch (error) {
    console.error("[capacity.selector] failed to persist observability event", {
      error,
      bookingId: event.bookingId,
      restaurantId: event.restaurantId,
    });
  }
}

export function summarizeCandidate(input: {
  tableIds: string[];
  tableNumbers: (string | null | undefined)[];
  totalCapacity: number;
  tableCount: number;
  slack?: number;
  score?: number;
}): CandidateSummary {
  return {
    tableIds: input.tableIds,
    tableNumbers: input.tableNumbers.map((value) => value ?? ""),
    totalCapacity: input.totalCapacity,
    tableCount: input.tableCount,
    slack: input.slack,
    score: input.score,
  };
}
