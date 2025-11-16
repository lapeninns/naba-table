import { sweepExpiredHolds } from "@/server/capacity/holds";
import { emitHoldExpired } from "@/server/capacity/telemetry";
import { recordObservabilityEvent } from "@/server/observability";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

export async function runHoldSweeper(params?: { now?: string; limit?: number; client?: DbClient }): Promise<void> {
  const { now, limit = 100, client } = params ?? {};
  let swept = 0;
  let iterations = 0;
  const startedAt = Date.now();
  // Process up to 5 batches with simple jittered backoff
  for (let i = 0; i < 5; i += 1) {
    iterations += 1;
    const { total } = await sweepExpiredHolds({ now, limit, client });
    swept += total;
    if (total < limit) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
  }

  await recordObservabilityEvent({
    source: "capacity.hold_sweeper",
    eventType: "holds.sweeper.run",
    severity: swept === 0 ? "info" : "notice",
    context: {
      swept,
      iterations,
      limit,
      durationMs: Date.now() - startedAt,
      at: now ?? null,
    },
  }).catch(() => {
    /* non-blocking */
  });

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
