import { env } from "@/lib/env";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FeatureFlagKey =
  | "planner.time_pruning.enabled"
  | "holds.strict_conflicts.enabled"
  | "adjacency.query.undirected"
  | "allocator.service.fail_hard";

type OverridesCache = {
  data: Map<FeatureFlagKey, boolean>;
  expiresAt: number;
  loading: Promise<void> | null;
};

const CACHE_TTL_MS = 30_000;
const cache: OverridesCache = {
  data: new Map(),
  expiresAt: 0,
  loading: null,
};

function getEnvironmentScope(): string {
  return env.node.env ?? "development";
}

async function fetchOverrides(client: SupabaseClient<Database, "public">): Promise<Map<FeatureFlagKey, boolean>> {
  const scope = getEnvironmentScope();
  const { data, error } = await client
    .from("feature_flag_overrides")
    .select("flag, value")
    .eq("environment", scope);

  if (error || !data) {
    console.warn("[feature-flags][overrides] failed to fetch overrides", {
      scope,
      error: error?.message ?? "unknown error",
    });
    return new Map();
  }

  const next = new Map<FeatureFlagKey, boolean>();
  for (const row of data) {
    const flag = row?.flag;
    if (typeof flag !== "string") continue;
    if (!["planner.time_pruning.enabled", "holds.strict_conflicts.enabled", "adjacency.query.undirected", "allocator.service.fail_hard"].includes(flag)) {
      continue;
    }
    next.set(flag as FeatureFlagKey, row.value === true);
  }
  return next;
}

async function refreshOverrides(): Promise<void> {
  try {
    const client = getServiceSupabaseClient();
    const next = await fetchOverrides(client);
    cache.data = next;
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
  } catch (error) {
    console.error("[feature-flags][overrides] refresh failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    cache.expiresAt = Date.now() + CACHE_TTL_MS;
  }
}

function ensureRefreshScheduled(): void {
  const now = Date.now();
  if (now < cache.expiresAt && cache.data.size > 0) {
    return;
  }
  if (!cache.loading) {
    cache.loading = refreshOverrides().finally(() => {
      cache.loading = null;
    });
  }
}

export function getFeatureFlagOverride(flag: FeatureFlagKey): boolean | null {
  ensureRefreshScheduled();
  return cache.data.has(flag) ? cache.data.get(flag)! : null;
}

export async function prefetchFeatureFlagOverrides(): Promise<void> {
  await refreshOverrides();
}

export function clearFeatureFlagOverrideCache(): void {
  cache.data = new Map();
  cache.expiresAt = 0;
  cache.loading = null;
}
