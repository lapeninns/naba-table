import { env } from "@/lib/env";

import type { PlannerReasonCategory } from "./planner-reason";
import type { PlannerStrategyContext } from "./planner-telemetry";

export type PlannerCacheEntry = {
  status: "success" | "failure";
  reason: string | null;
  reasonCode: string | null;
  reasonCategory: PlannerReasonCategory;
  timestamp: number;
};

type PlannerCacheKeyInput = {
  restaurantId: string | null;
  bookingDate: string | null;
  startTime: string | null;
  partySize: number | null;
  strategy: PlannerStrategyContext;
  trigger?: string | null;
};

const DEFAULT_TTL_MS = env.featureFlags.planner.cacheTtlMs ?? 60_000;
const cache = new Map<string, PlannerCacheEntry>();

export function isPlannerCacheEnabled(): boolean {
  return env.featureFlags.planner.cacheEnabled ?? false;
}

export function buildPlannerCacheKey(input: PlannerCacheKeyInput): string {
  const adjacencyLabel =
    input.strategy.requireAdjacency === null
      ? "auto"
      : input.strategy.requireAdjacency
        ? "adjacent"
        : "relaxed";
  const maxTablesLabel =
    typeof input.strategy.maxTables === "number" && !Number.isNaN(input.strategy.maxTables)
      ? input.strategy.maxTables
      : "auto";
  const restaurantComponent = input.restaurantId ?? "unknown_restaurant";
  const dateComponent = input.bookingDate ?? "unknown_date";
  const timeComponent = input.startTime ?? "unknown_time";
  const partyComponent = typeof input.partySize === "number" ? input.partySize : "auto_party";
  const triggerComponent = input.trigger ?? "default";
  return [
    "plannerCache",
    restaurantComponent,
    dateComponent,
    timeComponent,
    partyComponent,
    adjacencyLabel,
    maxTablesLabel,
    triggerComponent,
  ].join(":");
}

export function getPlannerCacheEntry(key: string): PlannerCacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function setPlannerCacheEntry(
  key: string,
  entry: Omit<PlannerCacheEntry, "timestamp">,
): void {
  cache.set(key, { ...entry, timestamp: Date.now() });
}
