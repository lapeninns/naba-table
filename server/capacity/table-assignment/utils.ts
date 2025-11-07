import { DateTime } from "luxon";

import type { ManualSelectionSummary, Table } from "./types";
import type { SelectorDecisionEvent } from "@/server/capacity/telemetry";

export function toIsoUtc(dateTime: DateTime): string {
  return dateTime.setZone("UTC").toISO({
    suppressMilliseconds: true,
    suppressSeconds: false,
    includeOffset: false,
  })!;
}

export function normalizeIsoString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) {
    return null;
  }
  return toIsoUtc(parsed);
}

export function highResNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildTiming(params: {
  totalMs: number;
  plannerMs?: number;
  assignmentMs?: number;
  holdMs?: number;
}): SelectorDecisionEvent["timing"] {
  const timing: SelectorDecisionEvent["timing"] = {
    totalMs: roundMilliseconds(params.totalMs),
  };

  if (typeof params.plannerMs === "number" && params.plannerMs > 0) {
    timing.plannerMs = roundMilliseconds(params.plannerMs);
  }
  if (typeof params.assignmentMs === "number" && params.assignmentMs > 0) {
    timing.assignmentMs = roundMilliseconds(params.assignmentMs);
  }
  if (typeof params.holdMs === "number" && params.holdMs > 0) {
    timing.holdMs = roundMilliseconds(params.holdMs);
  }

  return timing;
}

export function serializeDetails(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function summarizeSelection(tables: Table[], partySize: number): ManualSelectionSummary {
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const zoneIds = new Set(tables.map((table) => table.zoneId));
  return {
    tableCount: tables.length,
    totalCapacity,
    slack: Math.max(0, totalCapacity - partySize),
    zoneId: zoneIds.size === 1 ? tables[0]?.zoneId ?? null : null,
    tableNumbers: tables.map((table) => table.tableNumber),
    partySize,
  };
}
