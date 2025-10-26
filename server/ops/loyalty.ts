
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

export type LoyaltyPointSnapshot = {
  customerId: string;
  tier: Tables<"loyalty_points">["tier"];
  totalPoints: number;
};

type LoyaltyPointQueryOptions = {
  restaurantId: string;
  customerIds: string[];
  client?: DbClient;
};

function dedupeCustomerIds(customerIds: string[]): string[] {
  const seen = new Set<string>();
  for (const id of customerIds) {
    if (id) {
      seen.add(id);
    }
  }
  return Array.from(seen);
}

export async function getLoyaltyPointsForCustomers({
  restaurantId,
  customerIds,
  client,
}: LoyaltyPointQueryOptions): Promise<Map<string, LoyaltyPointSnapshot>> {
  const uniqueCustomerIds = dedupeCustomerIds(customerIds);
  if (uniqueCustomerIds.length === 0) {
    return new Map();
  }

  const supabase = client ?? getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("loyalty_points")
    .select("customer_id, tier, total_points")
    .eq("restaurant_id", restaurantId)
    .in("customer_id", uniqueCustomerIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, LoyaltyPointSnapshot>();
  for (const row of data ?? []) {
    if (!row) continue;

    const customerId = row.customer_id;
    if (!customerId) continue;

    map.set(customerId, {
      customerId,
      tier: row.tier as Tables<"loyalty_points">["tier"],
      totalPoints: row.total_points,
    });
  }

  return map;
}
