/**
 * Loyalty Points Module for Ops
 * 
 * NOTE: Loyalty features have been disabled. The loyalty_points table was dropped
 * during database cleanup on December 2, 2025.
 * 
 * These functions are kept as stubs to maintain API compatibility with existing code
 * that imports them. They return empty results.
 */

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

// Stub type for loyalty tier
type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export type LoyaltyPointSnapshot = {
  customerId: string;
  tier: LoyaltyTier;
  totalPoints: number;
};

type LoyaltyPointQueryOptions = {
  restaurantId: string;
  customerIds: string[];
  client?: DbClient;
};

export async function getLoyaltyPointsForCustomers(
  _options: LoyaltyPointQueryOptions
): Promise<Map<string, LoyaltyPointSnapshot>> {
  // Loyalty features have been disabled - table was dropped during database cleanup
  // Return empty map to indicate no loyalty data
  return new Map();
}
