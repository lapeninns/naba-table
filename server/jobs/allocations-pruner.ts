import { DateTime } from "luxon";

import { env } from "@/lib/env";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;
type PruneAllocationsRow =
  Database["public"]["Functions"]["prune_allocations_history"]["Returns"][number];

// Preserve compatibility with the legacy RPC payload shape that used plain
// archived/deleted keys before the SQL reshaped the return columns.
type LegacyPruneAllocationsRow = {
  archived?: number | null;
  deleted?: number | null;
};

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_LIMIT = 500;

export async function runAllocationsPruner(params?: {
  retentionDays?: number;
  limit?: number;
  client?: DbClient;
}): Promise<void> {
  const client = params?.client ?? getServiceSupabaseClient();
  const retentionDays = params?.retentionDays ?? env.raw.ALLOCATIONS_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS;
  const limit = params?.limit ?? DEFAULT_BATCH_LIMIT;
  const cutoff = DateTime.utc().minus({ days: retentionDays }).toISO();

  let totalArchived = 0;
  let totalDeleted = 0;
  let iterations = 0;
  const startedAt = Date.now();

  for (let i = 0; i < 5; i += 1) {
    iterations += 1;
    const { data, error } = await client.rpc("prune_allocations_history", {
      p_cutoff: cutoff,
      p_limit: limit,
    });

    if (error) {
      throw new Error(error.message ?? String(error));
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | (PruneAllocationsRow & LegacyPruneAllocationsRow)
      | undefined;
    const archived = Number(result?.archived_count ?? result?.archived ?? 0);
    const deleted = Number(result?.deleted_count ?? result?.deleted ?? archived);
    totalArchived += archived;
    totalDeleted += deleted;

    if (archived < limit) {
      break;
    }
  }

  await recordObservabilityEvent({
    source: "capacity.allocations_pruner",
    eventType: "allocations.pruner.run",
    severity: totalArchived === 0 ? "info" : "notice",
    context: {
      totalArchived,
      totalDeleted,
      iterations,
      limit,
      retentionDays,
      durationMs: Date.now() - startedAt,
    },
  }).catch(() => {
    /* non-blocking */
  });
}
