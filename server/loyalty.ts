/**
 * Loyalty Programs Module
 * 
 * NOTE: Loyalty features have been disabled. The loyalty_programs, loyalty_points,
 * and loyalty_point_events tables were dropped during database cleanup on December 2, 2025.
 * 
 * These functions are kept as stubs to maintain API compatibility with existing code
 * that imports them. They return null/no-op values.
 */

import type { Database, Json } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const LOYALTY_SCHEMA_VERSION = 1;

// Stub type for backwards compatibility
export type LoyaltyProgramRow = {
  id: string;
  restaurant_id: string;
  is_active: boolean;
  pilot_only: boolean;
  accrual_rule: Json | null;
  tier_definitions: Json | null;
  created_at: string;
  updated_at: string;
};

type DbClient = SupabaseClient<Database>;

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
  tier: "bronze" | "silver" | "gold" | "platinum";
  min_points: number;
};

export async function getActiveLoyaltyProgram(
  _client: DbClient,
  _restaurantId: string,
): Promise<(LoyaltyProgramRow & { accrualRule: LoyaltyAccrualRule; tiers: TierDefinition[] }) | null> {
  // Loyalty programs feature has been disabled - table was dropped during database cleanup
  // Return null to indicate no active loyalty program
  return null;
}

export function calculateLoyaltyAward(
  _program: { accrualRule: LoyaltyAccrualRule },
  _params: { partySize: number },
): number {
  // Loyalty programs feature has been disabled
  return 0;
}

export async function applyLoyaltyAward(
  _client: DbClient,
  _params: {
    program: LoyaltyProgramRow & { tiers: TierDefinition[] };
    customerId: string;
    bookingId: string;
    points: number;
    metadata?: Json | null;
    occurredAt?: string;
  },
): Promise<void> {
  // Loyalty programs feature has been disabled - tables were dropped during database cleanup
  // This is now a no-op
  return;
}

export { LOYALTY_SCHEMA_VERSION };
