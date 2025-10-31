import { getServiceSupabaseClient } from "@/server/supabase";

import type { Table } from "./tables";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type DbClient = SupabaseClient<Database, "public">;

type MetricsCacheEntry = {
  metrics: Map<string, number>;
  expiresAt: number;
};

const scarcityCache = new Map<string, MetricsCacheEntry>();

function sanitizeSegment(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  return value.toString().trim().toLowerCase() || fallback;
}

export function deriveTableType(table: Table): string {
  const capacity = Number.isFinite(table.capacity) ? Number(table.capacity) : 0;
  const category = sanitizeSegment(table.category as string | null | undefined, "uncategorized");
  const seating = sanitizeSegment(table.seatingType as string | null | undefined, "standard");

  return `capacity:${capacity}|category:${category}|seating:${seating}`;
}

export function computeScarcityScore(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Number((1 / count).toFixed(4));
}

async function fetchRestaurantMetrics(client: DbClient, restaurantId: string): Promise<Map<string, number>> {
  const cacheEntry = scarcityCache.get(restaurantId);
  const now = Date.now();
  if (cacheEntry && cacheEntry.expiresAt > now) {
    return cacheEntry.metrics;
  }

  const { data, error } = await client
    .from("table_scarcity_metrics")
    .select("table_type, scarcity_score")
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[scarcity] failed to load metrics, falling back to heuristic", {
      restaurantId,
      error: error.message,
    });
    return new Map();
  }

  const metrics = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row || typeof row.table_type !== "string") {
      continue;
    }
    const score = Number(row.scarcity_score);
    if (Number.isFinite(score)) {
      metrics.set(row.table_type, score);
    }
  }

  scarcityCache.set(restaurantId, {
    metrics,
    expiresAt: now + CACHE_TTL_MS,
  });

  return metrics;
}

export async function loadTableScarcityScores(params: {
  restaurantId: string;
  tables: Table[];
  client?: DbClient;
}): Promise<Map<string, number>> {
  const { restaurantId, tables, client } = params;
  const dbClient = client ?? getServiceSupabaseClient();
  const metrics = await fetchRestaurantMetrics(dbClient, restaurantId);

  const countsByType = new Map<string, number>();
  for (const table of tables) {
    const type = deriveTableType(table);
    countsByType.set(type, (countsByType.get(type) ?? 0) + 1);
  }

  const scores = new Map<string, number>();

  for (const table of tables) {
    const type = deriveTableType(table);
    const metricScore = metrics.get(type);
    if (typeof metricScore === "number" && Number.isFinite(metricScore) && metricScore > 0) {
      scores.set(table.id, Number(metricScore.toFixed(4)));
      continue;
    }

    const fallback = computeScarcityScore(countsByType.get(type) ?? 0);
    scores.set(table.id, fallback);
  }

  return scores;
}

export function clearScarcityCache(): void {
  scarcityCache.clear();
}
