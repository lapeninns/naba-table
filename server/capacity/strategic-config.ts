import path from "node:path";

import { env } from "@/lib/env";


const DEFAULT_DEMAND_PROFILE_RELATIVE_PATH = "config/demand-profiles.json";
export const DEFAULT_SCARCITY_WEIGHT = 22;
const MIN_SCARCITY_WEIGHT = 0;
const MAX_SCARCITY_WEIGHT = 1000;
const CACHE_TTL_MS = 30_000;
const GLOBAL_CACHE_KEY = "__global__";

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
  const { restaurantId = null } = options;
  const key = computeCacheKey(restaurantId);
  ensureCacheEntry(key);
  const loadedState = createEnvState();
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
