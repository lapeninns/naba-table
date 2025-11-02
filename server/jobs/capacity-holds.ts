import { sweepExpiredHolds } from "@/server/capacity/holds";
import { emitHoldExpired } from "@/server/capacity/telemetry";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

export async function runHoldSweeper(params?: { now?: string; limit?: number; client?: DbClient }): Promise<void> {
  const { now, limit = 100, client } = params ?? {};
  let swept = 0;
  // Process up to 5 batches with simple jittered backoff
  for (let i = 0; i < 5; i += 1) {
    const { total } = await sweepExpiredHolds({ now, limit, client });
    swept += total;
    if (total < limit) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
  }

  if (swept === 0) {
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
    reason: `Expired holds swept: ${swept}`,
  });
}
