/**
 * VIP Guests Module
 * 
 * NOTE: Loyalty features have been disabled. The loyalty_points table was dropped
 * during database cleanup on December 2, 2025.
 * 
 * The VIP functionality is now disabled and will return empty results.
 */

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

// Stub type for loyalty tier
type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export type VIPGuest = {
  bookingId: string;
  customerId: string;
  customerName: string;
  loyaltyTier: LoyaltyTier;
  totalPoints: number;
  startTime: string;
  partySize: number;
  marketingOptIn: boolean;
};

export type VIPGuestsResponse = {
  date: string;
  vips: VIPGuest[];
  totalVipCovers: number;
};

export async function getTodayVIPs(
  _restaurantId: string,
  date: string,
  _client?: DbClient,
): Promise<VIPGuestsResponse> {
  // Loyalty features have been disabled - tables were dropped during database cleanup
  // VIP functionality requires loyalty data, so return empty results
  return {
    date,
    vips: [],
    totalVipCovers: 0,
  };
}
