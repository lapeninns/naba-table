
import { isLoyaltyPilotRestaurant } from "@/server/feature-flags";

import type { Database, Json, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOYALTY_SCHEMA_VERSION = 1;

export type LoyaltyProgramRow = Tables<"loyalty_programs">;

type DbClient = SupabaseClient<Database, any, any>;

type LoyaltyAccrualRule =
  | {
      type: "per_guest";
      base_points?: number;
      points_per_guest?: number;
      minimum_party_size?: number;
    }
  | {
      type: "flat";
      points: number;
    };

type TierDefinition = {
  tier: Tables<"loyalty_points">["tier"];
  min_points: number;
};

function parseAccrualRule(rule: Json | null): LoyaltyAccrualRule {
  if (!rule || typeof rule !== "object") {
    return { type: "per_guest", base_points: 10, points_per_guest: 5, minimum_party_size: 1 };
  }

  const candidate = rule as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : "per_guest";

  if (type === "flat") {
    const points = Number(candidate.points) || 0;
    return { type: "flat", points };
  }

  const base_points = Number(candidate.base_points) || 0;
  const points_per_guest = Number(candidate.points_per_guest) || 0;
  const minimum_party_size = Number(candidate.minimum_party_size) || 1;
  return { type: "per_guest", base_points, points_per_guest, minimum_party_size };
}

function parseTierDefinitions(definitions: Json | null): TierDefinition[] {
  if (!Array.isArray(definitions)) {
    return [
      { tier: "bronze", min_points: 0 },
      { tier: "silver", min_points: 100 },
      { tier: "gold", min_points: 250 },
      { tier: "platinum", min_points: 500 },
    ];
  }

  return (definitions as Array<Record<string, unknown>>)
    .map((entry) => ({
      tier: (entry.tier as TierDefinition["tier"]) ?? "bronze",
      min_points: Number(entry.min_points) || 0,
    }))
    .sort((a, b) => a.min_points - b.min_points);
}

function determineTier(definitions: TierDefinition[], balance: number): TierDefinition["tier"] {
  let current: TierDefinition["tier"] = "bronze";
  for (const def of definitions) {
    if (balance >= def.min_points) {
      current = def.tier;
    }
  }
  return current;
}

export async function getActiveLoyaltyProgram(
  client: DbClient,
  restaurantId: string,
): Promise<(LoyaltyProgramRow & { accrualRule: LoyaltyAccrualRule; tiers: TierDefinition[] }) | null> {
  const { data, error } = await client
    .from("loyalty_programs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  const program = data as LoyaltyProgramRow | null;
  if (!program) {
    return null;
  }

  if (program.pilot_only && !isLoyaltyPilotRestaurant(restaurantId)) {
    return null;
  }

  return {
    ...program,
    accrualRule: parseAccrualRule(program.accrual_rule),
    tiers: parseTierDefinitions(program.tier_definitions),
  };
}

export function calculateLoyaltyAward(
  program: { accrualRule: LoyaltyAccrualRule },
  params: { partySize: number },
): number {
  const partySize = Math.max(0, params.partySize);
  const rule = program.accrualRule;

  if (rule.type === "flat") {
    return Math.max(0, Math.round(rule.points));
  }

  const basePoints = Math.max(0, Math.round(rule.base_points ?? 0));
  const perGuest = Math.max(0, Math.round(rule.points_per_guest ?? 0));
  const minimumParty = Math.max(1, Math.round(rule.minimum_party_size ?? 1));

  const eligibleGuestCount = partySize >= minimumParty ? partySize : 0;
  return basePoints + eligibleGuestCount * perGuest;
}

export async function applyLoyaltyAward(
  client: DbClient,
  params: {
    program: LoyaltyProgramRow & { tiers: TierDefinition[] };
    customerId: string;
    bookingId: string;
    points: number;
    metadata?: Json | null;
    occurredAt?: string;
  },
): Promise<void> {
  const nowIso = params.occurredAt ?? new Date().toISOString();
  const positivePoints = Math.max(0, params.points);
  const delta = Math.round(params.points);

  if (delta === 0) {
    return;
  }

  const { data: existing, error: existingError } = await client
    .from("loyalty_points")
    .select("id,balance,lifetime_points")
    .eq("program_id", params.program.id)
    .eq("customer_id", params.customerId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const currentBalance = existing?.balance ?? 0;
  const newBalance = Math.max(0, currentBalance + delta);
  const currentLifetime = existing?.lifetime_points ?? 0;
  const newLifetime = currentLifetime + positivePoints;
  const tier = determineTier(params.program.tiers, newBalance);

  const upsertPayload = {
    program_id: params.program.id,
    customer_id: params.customerId,
    balance: newBalance,
    lifetime_points: newLifetime,
    tier,
    last_awarded_at: nowIso,
    updated_at: nowIso,
  };

  const { error: upsertError } = await client
    .from("loyalty_points")
    .upsert(upsertPayload, { onConflict: "program_id,customer_id" });

  if (upsertError) {
    throw upsertError;
  }

  const { error: eventError } = await client.from("loyalty_point_events").insert({
    program_id: params.program.id,
    customer_id: params.customerId,
    booking_id: params.bookingId,
    points_delta: delta,
    balance_after: newBalance,
    reason: delta >= 0 ? "booking.confirmed" : "booking.adjustment",
    metadata: params.metadata ?? {},
    occurred_at: nowIso,
  });

  if (eventError) {
    throw eventError;
  }
}

export { LOYALTY_SCHEMA_VERSION };
