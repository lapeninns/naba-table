#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "path";
import { DateTime } from "luxon";

loadEnv({ path: resolvePath(process.cwd(), ".env.local") });
loadEnv({ path: resolvePath(process.cwd(), ".env.development") });
loadEnv({ path: resolvePath(process.cwd(), ".env") });

import type { PostgrestError } from "@supabase/supabase-js";
import { getServiceSupabaseClient } from "@/server/supabase";

function parseSinceArg(): string {
  const arg = process.argv.find((value) => value.startsWith("--since="));
  if (!arg) {
    return DateTime.utc().minus({ days: 7 }).startOf("day").toISO();
  }
  const value = arg.split("=")[1];
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid --since value: ${value}`);
  }
  return parsed.startOf("day").toISO();
}

async function main(): Promise<void> {
  const sinceIso = parseSinceArg();
  const supabase = getServiceSupabaseClient();

  const [selectorMetrics, holdMetrics, rpcConflicts, autoAssign] = await Promise.all([
    supabase
      .from("capacity_observability_selector_metrics")
      .select("restaurant_id, bucket_day, assignments, skipped, avg_total_duration_ms, p95_total_duration_ms")
      .gte("bucket_day", sinceIso),
    supabase
      .from("capacity_observability_hold_metrics")
      .select("restaurant_id, bucket_day, quotes, confirmations, strict_conflicts")
      .gte("bucket_day", sinceIso),
    supabase
      .from("capacity_observability_rpc_conflicts")
      .select("restaurant_id, bucket_day, conflict_code, occurrences")
      .gte("bucket_day", sinceIso),
    supabase
      .from("observability_events")
      .select("event_type, created_at, context")
      .gte("created_at", sinceIso)
      .in("event_type", [
        "auto_assign.attempt",
        "auto_assign.attempt_error",
        "auto_assign.failed",
        "auto_assign.cutoff_skipped",
      ]),
  ]);

  const response = {
    generatedAt: new Date().toISOString(),
    selector: selectorMetrics.data?.map((row) => {
      const attempts = Number(row.assignments ?? 0) + Number(row.skipped ?? 0);
      const successRate = attempts > 0 ? Number(row.assignments ?? 0) / attempts : null;
      return {
        restaurantId: row.restaurant_id,
        bucketDay: row.bucket_day,
        assignments: row.assignments,
        skipped: row.skipped,
        successRate,
        avgTotalMs: row.avg_total_duration_ms,
        p95TotalMs: row.p95_total_duration_ms,
      };
    }) ?? [],
    holds: holdMetrics.data?.map((row) => ({
      restaurantId: row.restaurant_id,
      bucketDay: row.bucket_day,
      quotes: row.quotes,
      confirmations: row.confirmations,
      strictConflicts: row.strict_conflicts,
      quoteToConfirmRate:
        row.quotes && row.quotes > 0 ? Number(row.confirmations ?? 0) / Number(row.quotes ?? 0) : null,
    })) ?? [],
    rpcConflicts: rpcConflicts.data ?? [],
    autoAssign: (() => {
      const attempts = autoAssign.data ?? [];
      const summary = { attempted: 0, failures: 0, cutoffSkipped: 0 };
      for (const row of attempts) {
        if (!row || typeof row.event_type !== "string") continue;
        if (row.event_type === "auto_assign.attempt" || row.event_type === "auto_assign.attempt_error") {
          summary.attempted += 1;
        }
        if (row.event_type === "auto_assign.attempt_error" || row.event_type === "auto_assign.failed") {
          summary.failures += 1;
        }
        if (row.event_type === "auto_assign.cutoff_skipped") {
          summary.cutoffSkipped += 1;
        }
      }
      return {
        events: attempts.length,
        ...summary,
      };
    })(),
    errors: [selectorMetrics.error, holdMetrics.error, rpcConflicts.error, autoAssign.error]
      .filter((error): error is PostgrestError => Boolean(error))
      .map((error) => error.message ?? String(error)),
  };

  console.log(JSON.stringify(response, null, 2));
}

main().catch((error) => {
  console.error("[observability][export] unexpected failure", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
