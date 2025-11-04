import * as fsp from "node:fs/promises";

import { getServiceSupabaseClient } from "@/server/supabase";

import { LruCache } from "./lru-cache";
import { getDemandProfileConfigPath } from "./strategic-config";

import type { ServiceKey } from "./policy";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DateTime } from "luxon";

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MINUTES_PER_DAY = 24 * 60;

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^([0-2]?\d):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * Normalize a [start, end) service window (in HH:mm strings) into minutes-of-day.
 *
 * Semantics:
 * - Missing/invalid `start` → 00:00 (0 minutes)
 * - Missing/invalid `end` → 24:00 (1440 minutes)
 * - If both provided and `end <= start`, treat as same-day remainder `[start, 24:00)` and emit a warning.
 *   Cross-midnight windows are not implicitly supported — define two rules instead.
 */
function normalizeWindow(start?: string, end?: string): { startMinute: number; endMinute: number } {
  const startParsed = parseTimeToMinutes(start);
  const endParsed = parseTimeToMinutes(end);

  const startMinute = startParsed ?? 0;
  let endMinute = endParsed ?? MINUTES_PER_DAY;

  if (typeof startParsed === "number" && typeof endParsed === "number" && endMinute <= startMinute) {
    // Explicit inputs but inverted/non-increasing: treat as remainder-of-day, not 24h wrap.
    // This avoids accidentally spanning into the next day-of-week.
    console.warn("[demand-profiles] normalizeWindow adjusted non-increasing window", {
      start,
      end,
      normalized: { startMinute, endMinute: MINUTES_PER_DAY },
    });
    endMinute = MINUTES_PER_DAY;
  }

  // Guarantee at least one minute duration when both are equal after defaults.
  if (endMinute <= startMinute) {
    endMinute = Math.min(startMinute + 1, MINUTES_PER_DAY);
  }

  return { startMinute, endMinute };
}

function isWithinWindow(rule: PreparedFallbackRule, minuteOfDay: number): boolean {
  if (minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    return false;
  }
  return minuteOfDay >= rule.startMinute && minuteOfDay < rule.endMinute;
}

function compareRules(a: PreparedFallbackRule, b: PreparedFallbackRule): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  const durationA = a.endMinute - a.startMinute;
  const durationB = b.endMinute - b.startMinute;
  if (durationA !== durationB) {
    return durationA - durationB;
  }
  if (a.startMinute !== b.startMinute) {
    return a.startMinute - b.startMinute;
  }
  return 0;
}

function minutesToTimeString(minutes: number): string {
  const bounded = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.floor(minutes)));
  const hours = Math.floor(bounded / 60)
    .toString()
    .padStart(2, "0");
  const mins = (bounded % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${mins}`;
}

type DbClient = SupabaseClient<Database, "public">;

export type DemandProfileRule = {
  label?: string;
  serviceWindow: string;
  days: string[];
  start?: string;
  end?: string;
  multiplier: number;
  priority?: number;
};

export type DemandMultiplierResult = {
  multiplier: number;
  rule?: {
    label?: string;
    source: "restaurant" | "default" | "fallback";
    serviceWindow?: string;
    days?: string[];
    start?: string;
    end?: string;
    priority?: number | null;
  };
};

type PreparedFallbackRule = {
  label?: string;
  serviceWindow: string;
  multiplier: number;
  start?: string;
  end?: string;
  startMinute: number;
  endMinute: number;
  dayNumbers: number[];
  source: "default" | "restaurant";
  priority: number;
};

type PreparedFallbackProfiles = {
  default: PreparedFallbackRule[];
  restaurants: Map<string, PreparedFallbackRule[]>;
};


const DEMAND_CACHE_MAX_ENTRIES = Number.parseInt(process.env.DEMAND_CACHE_MAX_ENTRIES ?? "8192", 10) || 8192;
const DEMAND_CACHE_SCAVENGE_MS = Number.parseInt(process.env.DEMAND_CACHE_SCAVENGE_MS ?? "60000", 10) || 60_000;
const demandCache = new LruCache<DemandMultiplierResult>(DEMAND_CACHE_MAX_ENTRIES, CACHE_TTL_MS);
demandCache.startScavenger(DEMAND_CACHE_SCAVENGE_MS);

const EMBEDDED_DEFAULTS: DemandProfileRule[] = [
  {
    label: "weekday-lunch",
    serviceWindow: "lunch",
    days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    start: "11:30",
    end: "14:30",
    multiplier: 0.85,
  },
  {
    label: "weekday-dinner",
    serviceWindow: "dinner",
    days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"],
    start: "17:30",
    end: "21:30",
    multiplier: 1.15,
  },
  {
    label: "weekend-dinner-peak",
    serviceWindow: "dinner",
    days: ["FRIDAY", "SATURDAY"],
    start: "18:00",
    end: "22:30",
    multiplier: 1.35,
  },
  {
    label: "weekend-brunch",
    serviceWindow: "lunch",
    days: ["SATURDAY", "SUNDAY"],
    start: "10:00",
    end: "13:00",
    multiplier: 1.1,
  },
];

type FallbackConfig = {
  default: DemandProfileRule[];
  restaurants?: Record<string, DemandProfileRule[]>;
};

let preparedFallbackProfilesPromise: Promise<PreparedFallbackProfiles> | null = null;

function toDayNumber(day: string): number | null {
  const normalized = day.trim().toUpperCase();
  return DAY_NAME_TO_NUMBER[normalized] ?? null;
}

async function readFallbackConfigAsync(): Promise<FallbackConfig> {
  const profilePath = getDemandProfileConfigPath();
  try {
    const raw = await fsp.readFile(profilePath, "utf8");
    return JSON.parse(raw) as FallbackConfig;
  } catch (error) {
    console.warn("[demand-profiles] failed to load fallback config, using embedded defaults", {
      error: error instanceof Error ? error.message : String(error),
      path: profilePath,
    });
    return { default: EMBEDDED_DEFAULTS };
  }
}

async function prepareFallbackProfilesAsync(): Promise<PreparedFallbackProfiles> {
  if (preparedFallbackProfilesPromise) {
    return preparedFallbackProfilesPromise;
  }

  const loader = (async () => {
    const config = await readFallbackConfigAsync();
    const defaultRules: PreparedFallbackRule[] = [];
    const restaurantRules = new Map<string, PreparedFallbackRule[]>();

  const processRuleSet = (rules: DemandProfileRule[] | undefined, source: "default" | "restaurant"): PreparedFallbackRule[] => {
    if (!Array.isArray(rules)) {
      return [];
    }

    const prepared: PreparedFallbackRule[] = [];
    for (const rule of rules) {
      if (!rule) {
        continue;
      }
      const dayNumbers = (rule.days ?? [])
        .map((day) => toDayNumber(day))
        .filter((value): value is number => value !== null);

      if (dayNumbers.length === 0) {
        continue;
      }

      const serviceWindow = (rule.serviceWindow ?? rule.label ?? "dinner").toString().toLowerCase();
      const { startMinute, endMinute } = normalizeWindow(rule.start, rule.end);
      const priority = typeof rule.priority === "number" ? rule.priority : 0;

      prepared.push({
        label: rule.label,
        serviceWindow,
        multiplier: rule.multiplier,
        start: rule.start,
        end: rule.end,
        startMinute,
        endMinute,
        dayNumbers,
        source,
        priority,
      });
    }

    return prepared;
  };

    defaultRules.push(...processRuleSet(config.default ?? EMBEDDED_DEFAULTS, "default"));

    if (config.restaurants) {
      for (const [restaurantId, rules] of Object.entries(config.restaurants)) {
        if (!Array.isArray(rules) || rules.length === 0) {
          continue;
        }
        restaurantRules.set(restaurantId, processRuleSet(rules, "restaurant"));
      }
    }

    return {
      default: defaultRules,
      restaurants: restaurantRules,
    } satisfies PreparedFallbackProfiles;
  })();

  preparedFallbackProfilesPromise = loader;
  return loader;
}

async function getFallbackRuleAsync(
  restaurantId: string | null | undefined,
  dayOfWeek: number,
  serviceWindow: string,
  minuteOfDay: number,
): Promise<PreparedFallbackRule | null> {
  const profiles = await prepareFallbackProfilesAsync();
  const candidates: PreparedFallbackRule[] = [];

  if (restaurantId) {
    const restaurantSpecific = profiles.restaurants.get(restaurantId);
    if (restaurantSpecific) {
      candidates.push(...restaurantSpecific);
    }
  }

  candidates.push(...profiles.default);
  const normalizedWindow = serviceWindow.toLowerCase();

  const matching = candidates
    .filter(
      (rule) =>
        rule.serviceWindow === normalizedWindow &&
        rule.dayNumbers.includes(dayOfWeek) &&
        isWithinWindow(rule, minuteOfDay),
    )
    .sort(compareRules);

  return matching[0] ?? null;
}

function buildCacheKey(
  restaurantId: string | null | undefined,
  dayOfWeek: number,
  serviceWindow: string,
  minuteOfDay: number,
): string {
  const boundedMinute = Math.max(0, Math.min(MINUTES_PER_DAY - 1, minuteOfDay));
  return `${restaurantId ?? "default"}|${dayOfWeek}|${serviceWindow.toLowerCase()}|${boundedMinute}`;
}

async function fetchRestaurantMultiplier(params: {
  restaurantId: string;
  dayOfWeek: number;
  serviceWindow: string;
  client: DbClient;
}): Promise<{ multiplier: number; rule: DemandMultiplierResult["rule"] } | null> {
  const { restaurantId, dayOfWeek, serviceWindow, client } = params;

  const query = client
    .from("demand_profiles")
    .select("multiplier, service_window, start_minute, end_minute, priority, label")
    .eq("restaurant_id", restaurantId)
    .eq("day_of_week", dayOfWeek)
    .eq("service_window", serviceWindow)
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error) {
    if ((error as { code?: string } | null)?.code === "42703") {
      return fetchRestaurantMultiplierLegacy(params);
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    multiplier: number | null;
    service_window: string | null;
    start_minute?: number | null;
    end_minute?: number | null;
    priority?: number | null;
    label?: string | null;
  };

  const multiplier = Number(row.multiplier ?? 1);
  const startMinuteRaw = typeof row.start_minute === "number" ? row.start_minute : null;
  const endMinuteRaw = typeof row.end_minute === "number" ? row.end_minute : null;
  const normalizedWindow = normalizeWindow(
    typeof startMinuteRaw === "number" ? minutesToTimeString(startMinuteRaw) : undefined,
    typeof endMinuteRaw === "number" ? minutesToTimeString(endMinuteRaw) : undefined,
  );

  const startLabel = startMinuteRaw !== null ? minutesToTimeString(normalizedWindow.startMinute) : null;
  const endLabel = endMinuteRaw !== null ? minutesToTimeString(normalizedWindow.endMinute - 1) : null;
  const priority = typeof row.priority === "number" ? row.priority : null;

  return {
    multiplier,
    rule: {
      label: row.label ?? row.service_window ?? serviceWindow,
      serviceWindow,
      source: "restaurant",
      start: startLabel ?? undefined,
      end: endLabel ?? undefined,
      priority,
    },
  };
}

async function fetchRestaurantMultiplierLegacy(params: {
  restaurantId: string;
  dayOfWeek: number;
  serviceWindow: string;
  client: DbClient;
}): Promise<{ multiplier: number; rule: DemandMultiplierResult["rule"] } | null> {
  const { restaurantId, dayOfWeek, serviceWindow, client } = params;
  const { data, error } = await client
    .from("demand_profiles")
    .select("multiplier, service_window")
    .eq("restaurant_id", restaurantId)
    .eq("day_of_week", dayOfWeek)
    .eq("service_window", serviceWindow)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const multiplier = Number(data.multiplier ?? 1);

  return {
    multiplier,
    rule: {
      label: data.service_window ?? serviceWindow,
      serviceWindow,
      source: "restaurant",
    },
  };
}

function toDemandRuleFromFallback(
  fallback: PreparedFallbackRule,
  localized: DateTime,
): DemandMultiplierResult["rule"] {
  const dayName = localized.setLocale("en").weekdayLong ?? "Unknown";

  return {
    label: fallback.label,
    serviceWindow: fallback.serviceWindow,
    source: fallback.source,
    days: [dayName],
    start: fallback.start,
    end: fallback.end,
    priority: fallback.priority,
  };
}

export async function resolveDemandMultiplier(params: {
  restaurantId?: string | null;
  serviceStart: DateTime;
  serviceKey?: ServiceKey | string | null;
  timezone?: string | null;
  client?: DbClient;
}): Promise<DemandMultiplierResult> {
  const client = params.client ?? getServiceSupabaseClient();
  const targetTimezone = params.timezone ?? params.serviceStart.zoneName ?? "UTC";
  const localized = params.serviceStart.setZone(targetTimezone);

  if (!localized.isValid) {
    return { multiplier: 1, rule: { source: "fallback" } };
  }

  const dayOfWeek = localized.weekday % 7; // Luxon weekday: 1 (Mon) .. 7 (Sun)
  const serviceWindow = (params.serviceKey ?? "dinner").toString().toLowerCase();
  const weekdayLabel = localized.setLocale("en").weekdayLong ?? localized.weekdayLong ?? "Unknown";
  const minuteOfDay = localized.hour * 60 + localized.minute;
  const cacheKey = buildCacheKey(params.restaurantId, dayOfWeek, serviceWindow, minuteOfDay);
  const cached = demandCache.get(cacheKey);
  if (cached) return cached;

  let multiplier = 1;
  let rule: DemandMultiplierResult["rule"] | undefined;

  if (params.restaurantId) {
    const restaurantResult = await fetchRestaurantMultiplier({
      restaurantId: params.restaurantId,
      dayOfWeek,
      serviceWindow,
      client,
    });

    if (restaurantResult) {
      multiplier = restaurantResult.multiplier;
      const normalizedRule = restaurantResult.rule ?? { source: "restaurant" as const };
      rule = {
        ...normalizedRule,
        source: normalizedRule.source ?? ("restaurant" as const),
        days: [weekdayLabel],
        priority: normalizedRule.priority ?? null,
      };

      demandCache.set(cacheKey, { multiplier, rule }, CACHE_TTL_MS);

      return { multiplier, rule };
    }
  }

  const fallbackRule = await getFallbackRuleAsync(
    params.restaurantId ?? undefined,
    dayOfWeek,
    serviceWindow,
    minuteOfDay,
  );
  if (fallbackRule) {
    multiplier = fallbackRule.multiplier;
    rule = toDemandRuleFromFallback(fallbackRule, localized);
  } else {
    rule = {
      source: "fallback",
      serviceWindow,
      days: [weekdayLabel],
      priority: null,
    };
  }

  const result: DemandMultiplierResult = { multiplier, rule };
  demandCache.set(cacheKey, result, CACHE_TTL_MS);
  return result;
}

export function clearDemandMultiplierCache(): void { demandCache.clear(); }

export function clearDemandProfileFallbackCache(): void {
  preparedFallbackProfilesPromise = null;
}

export function clearAllDemandProfileCaches(): void {
  clearDemandMultiplierCache();
  clearDemandProfileFallbackCache();
}

// Internal utilities for testing
export const __internal = {
  normalizeWindow,
};
