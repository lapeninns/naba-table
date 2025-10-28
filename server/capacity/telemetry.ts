import { recordObservabilityEvent } from "@/server/observability";

import type { CandidateDiagnostics } from "./selector";
import type { Json } from "@/types/supabase";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const SENSITIVE_NAME_KEYS = new Set([
  "name",
  "guestName",
  "guest_name",
  "customerName",
  "customer_name",
  "primaryGuestName",
  "primary_guest_name",
  "createdByName",
  "created_by_name",
  "assignedToName",
  "assigned_to_name",
]);

function redactEmails(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(EMAIL_PATTERN, "[redacted-email]");
}

function sanitizeTelemetryValue(value: unknown, key?: string): Json {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    if (key && SENSITIVE_NAME_KEYS.has(key)) {
      return "[redacted]";
    }
    return redactEmails(value) as Json;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTelemetryValue(item)) as Json[];
  }

  if (typeof value === "object") {
    const result: Record<string, Json> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_NAME_KEYS.has(entryKey)) {
        result[entryKey] = "[redacted]";
        continue;
      }
      result[entryKey] = sanitizeTelemetryValue(entryValue, entryKey);
    }
    return result;
  }

  return null;
}

function sanitizeTelemetryContext<T extends Json>(input: T): T {
  return sanitizeTelemetryValue(input) as T;
}

export type CandidateSummary = {
  tableIds: string[];
  tableNumbers: string[];
  totalCapacity: number;
  tableCount: number;
  slack?: number;
  score?: number;
  adjacencyStatus?: "single" | "connected" | "disconnected";
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
  timing?: {
    totalMs: number;
    plannerMs?: number;
    assignmentMs?: number;
    holdMs?: number;
  };
  plannerConfig?: {
    combinationEnabled: boolean;
    requireAdjacency: boolean;
    adjacencyRequiredGlobally: boolean;
    adjacencyMinPartySize: number | null;
    kMax: number;
    bucketLimit: number;
    evaluationLimit: number;
    maxOverage: number;
    maxTables: number;
  };
  diagnostics?: CandidateDiagnostics;
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
    timing: event.timing ?? null,
    plannerConfig: event.plannerConfig ?? null,
    diagnostics: event.diagnostics ?? null,
  };

  const sanitizedPayload = sanitizeTelemetryContext(logPayload);

  try {
    console.log(JSON.stringify(sanitizedPayload));
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
      context: sanitizedPayload,
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

  const sanitizedPayload = sanitizeTelemetryContext(payload as Json);

  try {
    await recordObservabilityEvent({
      source: "capacity.selector",
      eventType: "capacity.selector.quote",
      severity: event.skipReason ? "warning" : "info",
      context: sanitizedPayload,
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
  const sanitizedPayload = sanitizeTelemetryContext(payload as Json);
  try {
    await recordObservabilityEvent({
      source: "capacity.hold",
      eventType,
      severity: eventType.endsWith("expired") ? "warning" : "info",
      context: sanitizedPayload,
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
  const sanitizedPayload = sanitizeTelemetryContext(event as Json);
  try {
    await recordObservabilityEvent({
      source: "capacity.rpc",
      eventType: "capacity.rpc.conflict",
      severity: "warning",
      context: sanitizedPayload,
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
  adjacencyStatus?: "single" | "connected" | "disconnected";
}): CandidateSummary {
  return {
    tableIds: input.tableIds,
    tableNumbers: input.tableNumbers.map((value) => value ?? ""),
    totalCapacity: input.totalCapacity,
    tableCount: input.tableCount,
    slack: input.slack,
    score: input.score,
    adjacencyStatus: input.adjacencyStatus,
  };
}
