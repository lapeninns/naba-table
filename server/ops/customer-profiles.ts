
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

export type CustomerProfileSnapshot = {
  customerId: string;
  marketingOptIn: boolean;
  notes: string | null;
  preferences: Tables<"customer_profiles">["preferences"];
};

type CustomerProfileQueryOptions = {
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

export async function getCustomerProfilesForCustomers({
  customerIds,
  client,
}: CustomerProfileQueryOptions): Promise<Map<string, CustomerProfileSnapshot>> {
  const uniqueIds = dedupeCustomerIds(customerIds);
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const supabase = client ?? getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("customer_id, marketing_opt_in, preferences, notes")
    .in("customer_id", uniqueIds);

  if (error) {
    throw error;
  }

  const profileMap = new Map<string, CustomerProfileSnapshot>();
  for (const row of data ?? []) {
    if (!row?.customer_id) {
      continue;
    }

    profileMap.set(row.customer_id, {
      customerId: row.customer_id,
      marketingOptIn: row.marketing_opt_in ?? false,
      notes: row.notes ?? null,
      preferences: row.preferences as Tables<"customer_profiles">["preferences"],
    });
  }

  return profileMap;
}
