import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "@/server/supabase";
import { isLoyaltyPilotRestaurant } from "@/server/feature-flags";
import type { Database, Tables } from "@/types/supabase";
import { getLoyaltyPointsForCustomers } from "@/server/ops/loyalty";
import { getCustomerProfilesForCustomers } from "@/server/ops/customer-profiles";

type DbClient = SupabaseClient<Database, "public", any>;

export type VIPGuest = {
  bookingId: string;
  customerId: string;
  customerName: string;
  loyaltyTier: Tables<"loyalty_points">["tier"];
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

const CANCELLED_STATUSES = ["cancelled", "no_show"];

const TIER_PRIORITY: Record<string, number> = {
  platinum: 1,
  gold: 2,
  silver: 3,
  bronze: 4,
};

export async function getTodayVIPs(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<VIPGuestsResponse> {
  const supabase = client ?? getServiceSupabaseClient();

  const isLoyaltyEnabled = await isLoyaltyPilotRestaurant(restaurantId);
  if (!isLoyaltyEnabled) {
    return {
      date,
      vips: [],
      totalVipCovers: 0,
    };
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, customer_id, customer_name, start_time, party_size, status, marketing_opt_in`,
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", date)
    .not("status", "in", `(${CANCELLED_STATUSES.join(",")})`);

  if (error) {
    throw error;
  }

  const bookings = (data ?? []) as Tables<"bookings">[];

  const customerIds = bookings
    .map((booking) => booking.customer_id)
    .filter((customerId): customerId is string => typeof customerId === "string" && customerId.length > 0);

  const [loyaltyPointsMap, customerProfilesMap] = await Promise.all([
    getLoyaltyPointsForCustomers({
      restaurantId,
      customerIds,
      client: supabase,
    }),
    getCustomerProfilesForCustomers({
      customerIds,
      client: supabase,
    }),
  ]);

  const vips: VIPGuest[] = bookings
    .map((booking) => {
      if (!booking.customer_id) return null;

      const loyaltyData = loyaltyPointsMap.get(booking.customer_id);
      if (!loyaltyData) return null;

      const profileData = customerProfilesMap.get(booking.customer_id);

      return {
        bookingId: booking.id,
        customerId: booking.customer_id,
        customerName: booking.customer_name,
        loyaltyTier: loyaltyData.tier,
        totalPoints: loyaltyData.totalPoints,
        startTime: booking.start_time ?? "",
        partySize: booking.party_size,
        marketingOptIn: profileData?.marketingOptIn ?? false,
      };
    })
    .filter((vip): vip is VIPGuest => vip !== null)
    .sort((a, b) => {
      const tierDiff = (TIER_PRIORITY[a.loyaltyTier] ?? 99) - (TIER_PRIORITY[b.loyaltyTier] ?? 99);
      if (tierDiff !== 0) return tierDiff;

      return a.startTime.localeCompare(b.startTime);
    });

  const totalVipCovers = vips.reduce((sum, vip) => sum + vip.partySize, 0);

  return {
    date,
    vips,
    totalVipCovers,
  };
}
