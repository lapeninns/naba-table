import { recordObservabilityEvent } from "@/server/observability";

import type { Json } from "@/types/supabase";

export type CandidateSummary = {
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
      restaurantId: event.restaurantId,
      bookingId: event.bookingId,
    });
  } catch (error) {
    console.error("[capacity.selector] failed to persist observability event", {
      error,
      bookingId: event.bookingId,
      restaurantId: event.restaurantId,
    });
  }
}

export type SelectorQuoteEvent = SelectorDecisionEvent & {
  holdId?: string;
  expiresAt?: string;
};

export async function emitSelectorQuote(event: SelectorQuoteEvent): Promise<void> {
  const payload = {
    ...event,
    type: "capacity.selector.quote",
  };

  try {
    await recordObservabilityEvent({
      source: "capacity.selector",
      eventType: "capacity.selector.quote",
      severity: event.skipReason ? "warning" : "info",
      context: payload,
      restaurantId: event.restaurantId,
      bookingId: event.bookingId,
    });
  } catch (error) {
    console.error("[capacity.selector.quote] failed to record telemetry", {
      error,
      bookingId: event.bookingId,
      restaurantId: event.restaurantId,
    });
  }
}

export type HoldTelemetryEvent = {
  holdId: string;
  bookingId: string | null;
  restaurantId: string;
  zoneId: string;
  tableIds: string[];
  startAt: string;
  endAt: string;
  expiresAt?: string;
  actorId?: string | null;
  reason?: string | null;
  metadata?: Json | null;
};

async function emitHoldEvent(eventType: string, payload: HoldTelemetryEvent): Promise<void> {
  try {
    await recordObservabilityEvent({
      source: "capacity.hold",
      eventType,
      severity: eventType.endsWith("expired") ? "warning" : "info",
      context: payload,
      restaurantId: payload.restaurantId,
      bookingId: payload.bookingId ?? undefined,
    });
  } catch (error) {
    console.error(`[capacity.hold] failed to emit ${eventType}`, {
      error,
      holdId: payload.holdId,
      bookingId: payload.bookingId,
    });
  }
}

export async function emitHoldCreated(event: HoldTelemetryEvent): Promise<void> {
  await emitHoldEvent("capacity.hold.created", event);
}

export async function emitHoldConfirmed(event: HoldTelemetryEvent): Promise<void> {
  await emitHoldEvent("capacity.hold.confirmed", event);
}

export async function emitHoldExpired(event: HoldTelemetryEvent): Promise<void> {
  await emitHoldEvent("capacity.hold.expired", event);
}

export type RpcConflictEvent = {
  source: string;
  bookingId: string;
  restaurantId: string;
  tableIds: string[];
  idempotencyKey?: string | null;
  holdId?: string | null;
  error: {
    code?: string | null;
    message: string;
    details?: string | null;
    hint?: string | null;
  };
};

export async function emitRpcConflict(event: RpcConflictEvent): Promise<void> {
  try {
    await recordObservabilityEvent({
      source: "capacity.rpc",
      eventType: "capacity.rpc.conflict",
      severity: "warning",
      context: event,
      restaurantId: event.restaurantId,
      bookingId: event.bookingId,
    });
  } catch (error) {
    console.error("[capacity.rpc] failed to record conflict telemetry", {
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
