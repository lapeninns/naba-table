import { sweepExpiredHolds } from "@/server/capacity/holds";
import { emitHoldExpired } from "@/server/capacity/telemetry";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

export async function runHoldSweeper(params?: { now?: string; limit?: number; client?: DbClient }): Promise<void> {
  const { now, limit = 100, client } = params ?? {};
  const { total } = await sweepExpiredHolds({ now, limit, client });

  if (total === 0) {
    return;
  }

  // Emit aggregate telemetry event for observability.
  await emitHoldExpired({
    holdId: "bulk",
    bookingId: null,
    restaurantId: "*",
    zoneId: "*",
    tableIds: [],
    startAt: now ?? new Date().toISOString(),
    endAt: now ?? new Date().toISOString(),
    expiresAt: now ?? new Date().toISOString(),
    reason: `Expired holds swept: ${total}`,
  });
}
