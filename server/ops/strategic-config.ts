import { applyStrategicConfigOverride } from "@/server/capacity/strategic-config";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

export type StrategicConfigRecord = {
  id: string;
  restaurant_id: string | null;
  scarcity_weight: number;
  demand_multiplier_override: number | null;
  future_conflict_penalty: number | null;
  updated_at: string;
  updated_by: string | null;
};

const TABLE_NAME = "strategic_configs" as const;

export type StrategicConfigUpsertInput = {
  restaurantId: string | null;
  scarcityWeight: number;
  demandMultiplierOverride?: number | null;
  futureConflictPenalty?: number | null;
  updatedBy: string | null;
  client?: DbClient;
};

export async function fetchStrategicConfig(params: {
  restaurantId: string | null;
  client?: DbClient;
}): Promise<StrategicConfigRecord | null> {
  const { restaurantId, client = getServiceSupabaseClient() } = params;

  if (restaurantId) {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as StrategicConfigRecord;
    }
  }

  const { data: globalRow, error: globalError } = await client
    .from(TABLE_NAME)
    .select("*")
    .is("restaurant_id", null)
    .order("updated_at", { ascending: false })
    .maybeSingle();

  if (globalError) {
    throw globalError;
  }

  return (globalRow as StrategicConfigRecord | null) ?? null;
}

export async function upsertStrategicConfig(input: StrategicConfigUpsertInput): Promise<StrategicConfigRecord> {
  const { restaurantId, scarcityWeight, demandMultiplierOverride = null, futureConflictPenalty = null, updatedBy, client = getServiceSupabaseClient() } = input;

  const payload = {
    restaurant_id: restaurantId,
    scarcity_weight: scarcityWeight,
    demand_multiplier_override: demandMultiplierOverride,
    future_conflict_penalty: futureConflictPenalty,
    updated_by: updatedBy,
  };

  const { data, error } = await client
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: "restaurant_id" })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Failed to persist strategic config");
  }

  const record = data as StrategicConfigRecord;

  applyStrategicConfigOverride({
    restaurantId,
    scarcityWeight: record.scarcity_weight,
    demandMultiplierOverride: record.demand_multiplier_override,
    futureConflictPenalty: record.future_conflict_penalty,
    updatedAt: record.updated_at,
    source: "db",
  });

  return record;
}
