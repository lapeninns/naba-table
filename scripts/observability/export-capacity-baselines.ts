import "dotenv/config";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ObservabilityRow = Record<string, unknown>;

function parseDaysArg(): number {
  const arg = process.argv.find((value) => value.startsWith("--days="));
  if (!arg) {
    return 3;
  }
  const parsed = Number.parseInt(arg.split("=")[1] ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid --days value "${arg}". Provide a positive integer.`);
  }
  return parsed;
}

function computeSinceTimestamp(days: number): string {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - (days - 1));
  return now.toISOString();
}

async function fetchRows(
  client: SupabaseClient,
  table: string,
  since: string,
): Promise<ObservabilityRow[]> {
  const { data, error } = await client.from(table).select("*").gte("bucket_day", since).order("bucket_day", {
    ascending: true,
  });

  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`);
  }

  return data ?? [];
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set to export baselines.",
    );
  }

  const days = parseDaysArg();
  const sinceIso = computeSinceTimestamp(days);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const [selectorMetrics, holdMetrics, rpcConflicts] = await Promise.all([
    fetchRows(supabase, "capacity_observability_selector_metrics", sinceIso),
    fetchRows(supabase, "capacity_observability_hold_metrics", sinceIso),
    fetchRows(supabase, "capacity_observability_rpc_conflicts", sinceIso),
  ]);

  console.log(`\nAllocator baseline export (last ${days} day(s))`);
  console.log(`Window starting ${sinceIso}`);

  console.log("\nSelector Metrics");
  console.table(selectorMetrics);

  console.log("\nHold Metrics");
  console.table(holdMetrics);

  console.log("\nRPC Conflicts");
  console.table(rpcConflicts);
}

void main().catch((error) => {
  console.error("[baseline-export] failed", error);
  process.exit(1);
});
