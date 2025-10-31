import path from "node:path";

import { env } from "@/lib/env";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_DEMAND_PROFILE_RELATIVE_PATH = "config/demand-profiles.json";
export const DEFAULT_SCARCITY_WEIGHT = 22;
const MIN_SCARCITY_WEIGHT = 0;
const MAX_SCARCITY_WEIGHT = 1000;
const CACHE_TTL_MS = 30_000;
const GLOBAL_CACHE_KEY = "__global__";

type DbClient = SupabaseClient<Database, "public">;

export type StrategicConfigSource = "env" | "db";

export type StrategicConfigState = {
  scarcityWeight: number;
  demandMultiplierOverride: number | null;
  futureConflictPenalty: number | null;
  updatedAt: string | null;
  source: StrategicConfigSource;
};

type StrategicConfigCacheEntry = {
  state: StrategicConfigState;
  expiresAt: number;
};

export type StrategicConfigSnapshotOptions = {
  restaurantId?: string | null;
};

export type StrategicConfigLoadOptions = StrategicConfigSnapshotOptions & {
  client?: DbClient;
  force?: boolean;
};

type StrategicConfigOverride = Partial<StrategicConfigState> & StrategicConfigSnapshotOptions & {
  source?: StrategicConfigSource;
};

type StrategicConfigRow = {
  scarcity_weight: number | null;
  demand_multiplier_override: number | null;
  future_conflict_penalty: number | null;
  updated_at: string | null;
};

let testScarcityWeight: number | null = null;
let testDemandProfilePath: string | null = null;
let testConfigOverride: Partial<StrategicConfigState> | null = null;

const configCache = new Map<string, StrategicConfigCacheEntry>();

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function resolveConfigPath(rawPath?: string | null): string {
  if (!rawPath) {
    return path.join(process.cwd(), DEFAULT_DEMAND_PROFILE_RELATIVE_PATH);
  }
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }
  return path.join(process.cwd(), rawPath);
}

function computeCacheKey(restaurantId: string | null): string {
  return restaurantId ?? GLOBAL_CACHE_KEY;
}

function createEnvState(): StrategicConfigState {
  const scarcityWeight = clamp(
    env.strategic.scarcityWeight ?? DEFAULT_SCARCITY_WEIGHT,
    MIN_SCARCITY_WEIGHT,
    MAX_SCARCITY_WEIGHT,
  );

  return {
    scarcityWeight,
    demandMultiplierOverride: null,
    futureConflictPenalty: null,
    updatedAt: null,
    source: "env",
  } as const;
}

function ensureCacheEntry(key: string): StrategicConfigCacheEntry {
  const existing = configCache.get(key);
  if (existing) {
    return existing;
  }

  const base = createEnvState();
  const entry: StrategicConfigCacheEntry = {
    state: key === GLOBAL_CACHE_KEY ? base : { ...base },
    expiresAt: 0,
  };
  configCache.set(key, entry);
  return entry;
}

function applyTestOverrides(state: StrategicConfigState): StrategicConfigState {
  const scarcity =
    typeof testScarcityWeight === "number"
      ? clamp(testScarcityWeight, MIN_SCARCITY_WEIGHT, MAX_SCARCITY_WEIGHT)
      : state.scarcityWeight;

  const base: StrategicConfigState = {
    ...state,
    scarcityWeight: scarcity,
  };

  if (!testConfigOverride) {
    return base;
  }

  return {
    ...base,
    ...testConfigOverride,
    scarcityWeight:
      typeof testConfigOverride.scarcityWeight === "number"
        ? clamp(testConfigOverride.scarcityWeight, MIN_SCARCITY_WEIGHT, MAX_SCARCITY_WEIGHT)
        : base.scarcityWeight,
    source: testConfigOverride.source ?? base.source,
  };
}

function mapRowToState(row: StrategicConfigRow): StrategicConfigState {
  const scarcity = clamp(Number(row.scarcity_weight ?? DEFAULT_SCARCITY_WEIGHT), MIN_SCARCITY_WEIGHT, MAX_SCARCITY_WEIGHT);
  const demandOverride = row.demand_multiplier_override;
  const futurePenalty = row.future_conflict_penalty;

  return {
    scarcityWeight: scarcity,
    demandMultiplierOverride: demandOverride === null ? null : Number(demandOverride),
    futureConflictPenalty: futurePenalty === null ? null : Number(futurePenalty),
    updatedAt: row.updated_at ?? null,
    source: "db",
  };
}

async function fetchStrategicConfigFromDb(
  client: DbClient,
  restaurantId: string | null,
): Promise<StrategicConfigState | null> {
  const query = client
    .from("strategic_configs")
    .select("scarcity_weight, demand_multiplier_override, future_conflict_penalty, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data, error } = restaurantId
    ? await query.eq("restaurant_id", restaurantId).maybeSingle()
    : await query.is("restaurant_id", null).maybeSingle();

  if (error) {
    const errorCode = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
    const message = typeof error === "object" && error && "message" in error ? String((error as { message?: string }).message ?? "") : "";
    const isMissingTable = errorCode === "42P01" || /unexpected table\s+strategic_configs/i.test(message) || /relation .*strategic_configs.* does not exist/i.test(message);
    const isMissingColumns = errorCode === "42703" || /column\s+strategic_configs\./i.test(message);
    if (isMissingTable || isMissingColumns) {
      console.warn("[strategic-config] schema unavailable; falling back to env state", { error: message || errorCode });
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapRowToState(data as StrategicConfigRow);
}

function storeState(key: string, state: StrategicConfigState, ttlMs: number): void {
  const entry = ensureCacheEntry(key);
  entry.state = { ...state };
  entry.expiresAt = Date.now() + ttlMs;
}

export function getDemandProfileConfigPath(): string {
  if (testDemandProfilePath) {
    return testDemandProfilePath;
  }
  return resolveConfigPath(env.strategic.demandProfilePath);
}

export function getStrategicConfigSnapshot(options: StrategicConfigSnapshotOptions = {}): StrategicConfigState {
  const key = computeCacheKey(options.restaurantId ?? null);
  const entry = ensureCacheEntry(key);
  return applyTestOverrides({ ...entry.state });
}

export function getStrategicScarcityWeight(options: StrategicConfigSnapshotOptions = {}): number {
  const snapshot = getStrategicConfigSnapshot(options);
  return clamp(snapshot.scarcityWeight ?? DEFAULT_SCARCITY_WEIGHT, MIN_SCARCITY_WEIGHT, MAX_SCARCITY_WEIGHT);
}

export async function loadStrategicConfig(options: StrategicConfigLoadOptions = {}): Promise<StrategicConfigState> {
  const { restaurantId = null, client, force = false } = options;
  const key = computeCacheKey(restaurantId);
  const entry = ensureCacheEntry(key);
  const now = Date.now();

  if (!force && entry.expiresAt > now) {
    return getStrategicConfigSnapshot({ restaurantId });
  }

  const supabase = client ?? getServiceSupabaseClient();

  let loadedState: StrategicConfigState | null = null;

  try {
    if (restaurantId) {
      loadedState = await fetchStrategicConfigFromDb(supabase, restaurantId);
    }

    if (!loadedState) {
      loadedState = await fetchStrategicConfigFromDb(supabase, null);
      if (loadedState) {
        storeState(GLOBAL_CACHE_KEY, loadedState, CACHE_TTL_MS);
      }
    }
  } catch (error) {
    entry.expiresAt = now + CACHE_TTL_MS;
    throw error;
  }

  if (!loadedState) {
    loadedState = createEnvState();
  }

  storeState(key, loadedState, CACHE_TTL_MS);
  return getStrategicConfigSnapshot({ restaurantId });
}

export function applyStrategicConfigOverride(override: StrategicConfigOverride): void {
  const key = computeCacheKey(override.restaurantId ?? null);
  const entry = ensureCacheEntry(key);
  const next: StrategicConfigState = {
    ...entry.state,
    ...override,
    source: override.source ?? entry.state.source,
    scarcityWeight: clamp(
      typeof override.scarcityWeight === "number" ? override.scarcityWeight : entry.state.scarcityWeight,
      MIN_SCARCITY_WEIGHT,
      MAX_SCARCITY_WEIGHT,
    ),
  };

  entry.state = next;
  entry.expiresAt = Date.now() + CACHE_TTL_MS;
}

export function invalidateStrategicConfigCache(restaurantId?: string | null): void {
  if (typeof restaurantId === "undefined") {
    configCache.clear();
    return;
  }
  const key = computeCacheKey(restaurantId);
  configCache.delete(key);
}

export function setStrategicScarcityWeightForTests(weight?: number | null): void {
  testScarcityWeight = typeof weight === "number" ? weight : null;
}

export function setDemandProfileConfigPathForTests(overridePath?: string | null): void {
  testDemandProfilePath = overridePath && overridePath.length > 0 ? overridePath : null;
}

export function setStrategicConfigForTests(override: Partial<StrategicConfigState> | null): void {
  testConfigOverride = override;
}

export function resetStrategicConfigTestOverrides(): void {
  testScarcityWeight = null;
  testDemandProfilePath = null;
  testConfigOverride = null;
  configCache.clear();
}
