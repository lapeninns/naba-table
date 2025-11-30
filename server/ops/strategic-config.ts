import { getStrategicConfigSnapshot } from "@/server/capacity/strategic-config";

export type StrategicConfigRecord = {
  id: string;
  restaurant_id: string | null;
  scarcity_weight: number;
  demand_multiplier_override: number | null;
  future_conflict_penalty: number | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type StrategicConfigUpsertInput = {
  restaurantId: string | null;
  scarcityWeight: number;
  demandMultiplierOverride?: number | null;
  futureConflictPenalty?: number | null;
  updatedBy: string | null;
};

export async function fetchStrategicConfig(params: { restaurantId: string | null }): Promise<StrategicConfigRecord | null> {
  const snapshot = getStrategicConfigSnapshot({ restaurantId: params.restaurantId ?? null });

  return {
    id: params.restaurantId ?? "global",
    restaurant_id: params.restaurantId ?? null,
    scarcity_weight: snapshot.scarcityWeight,
    demand_multiplier_override: snapshot.demandMultiplierOverride,
    future_conflict_penalty: snapshot.futureConflictPenalty,
    updated_at: snapshot.updatedAt ?? null,
    updated_by: null,
  } as StrategicConfigRecord;
}

export async function upsertStrategicConfig(): Promise<StrategicConfigRecord> {
  throw new Error("Strategic configuration is now defined in code/env and cannot be mutated at runtime.");
}
