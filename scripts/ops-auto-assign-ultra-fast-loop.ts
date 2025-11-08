import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "node:path";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { Pool } from "pg";

import { runUltraFastAssignment } from "./ops-auto-assign-ultra-fast";

import { getServiceSupabaseClient } from "@/server/supabase";
import { createBookingWithCapacityCheck, type BookingRecord } from "@/server/capacity";
import { quoteTablesForBooking, confirmHoldAssignment } from "@/server/capacity/tables";
import { releaseTableHold } from "@/server/capacity/holds";
import type { CandidateSummary } from "@/server/capacity/telemetry";
import type { Database, Tables } from "@/types/supabase";
import { ensureBookingType } from "@/lib/enums";

loadEnv({ path: resolvePath(process.cwd(), ".env.local") });
loadEnv({ path: resolvePath(process.cwd(), ".env.development") });
loadEnv({ path: resolvePath(process.cwd(), ".env") });

const DEFAULT_SLUG = process.env.TARGET_RESTAURANT_SLUG || "white-horse-pub-waterbeach";
const DEFAULT_DATE = process.env.TARGET_DATE || DateTime.now().toISODate() || new Date().toISOString().split("T")[0];
const DEFAULT_MAX_ITERATIONS = Number(process.env.ASSIGN_LOOP_MAX_ITERATIONS ?? "6");
const DEFAULT_SLEEP_MS = Number(process.env.ASSIGN_LOOP_SLEEP_MS ?? "5000");
const DEFAULT_MAX_TABLES = clampTables(Number(process.env.ASSIGN_LOOP_MAX_TABLES ?? "4"));
const DEFAULT_MODE: LoopMode = process.env.ASSIGN_LOOP_MODE === "reserve" ? "reserve" : "assign";
const DEFAULT_HOLD_TTL = Math.max(30, Number(process.env.ASSIGN_LOOP_HOLD_TTL ?? "180") || 180);
const DEFAULT_CLONE_LIMIT = Math.max(1, Number(process.env.ASSIGN_LOOP_CLONE_LIMIT ?? "5") || 5);
const DEFAULT_SOURCE_DATE = process.env.ASSIGN_LOOP_SOURCE_DATE;
const DEFAULT_AVOID_USED_TABLES =
  String(process.env.ASSIGN_LOOP_AVOID_USED_TABLES ?? "").toLowerCase() === "true";

if (!process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL is required to run the assignment loop");
}

const VALID_STATUS_FOR_PENDING = ["pending", "pending_allocation", "confirmed"] as const;

type LoopMode = "assign" | "reserve";

type LoopJob = {
  slug: string;
  date: string;
  maxIterations: number;
  sleepMs: number;
  once: boolean;
  maxTables: number;
  verbose: boolean;
  forceAll: boolean;
  mode: LoopMode;
  holdTtlSeconds: number;
  sourceDate?: string;
  cloneLimit: number;
  sourceAfter?: string;
  avoidUsedTables: boolean;
};

type BookingStats = {
  total: number;
  assigned: number;
  unassigned: number;
  pendingState: number;
};

type Strategy = {
  label: string;
  requireAdjacency: boolean;
  maxTables: number;
};

type RestaurantRow = Pick<Tables<"restaurants">, "id" | "name" | "timezone">;

type CustomerSummary = Pick<Tables<"customers">, "id" | "full_name" | "email" | "phone">;

type CloneSource = Pick<
  Tables<"bookings">,
  | "id"
  | "booking_date"
  | "start_time"
  | "end_time"
  | "party_size"
  | "customer_id"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "seating_preference"
  | "booking_type"
  | "notes"
  | "marketing_opt_in"
  | "details"
>;

function clampTables(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.max(1, Math.min(5, Math.floor(value)));
}

function splitIntoJobs(argv: string[]): string[][] {
  const jobs: string[][] = [];
  let current: string[] = [];
  for (const token of argv) {
    if (token === "--") {
      if (current.length > 0) {
        jobs.push(current);
        current = [];
      }
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) {
    jobs.push(current);
  }
  if (jobs.length === 0) {
    jobs.push([]);
  }
  return jobs;
}

function parseJobArgs(tokens: string[]): LoopJob {
  const job: LoopJob = {
    slug: DEFAULT_SLUG,
    date: DEFAULT_DATE,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    sleepMs: DEFAULT_SLEEP_MS,
    once: false,
    maxTables: DEFAULT_MAX_TABLES,
    verbose: false,
    forceAll: false,
    mode: DEFAULT_MODE,
    holdTtlSeconds: DEFAULT_HOLD_TTL,
  sourceDate: DEFAULT_SOURCE_DATE,
  cloneLimit: DEFAULT_CLONE_LIMIT,
  sourceAfter: undefined,
  avoidUsedTables: DEFAULT_AVOID_USED_TABLES,
};

  for (let i = 0; i < tokens.length; i += 1) {
    const arg = tokens[i];
    switch (arg) {
      case "--slug":
        job.slug = tokens[i + 1] ?? job.slug;
        i += 1;
        break;
      case "--date":
        job.date = tokens[i + 1] ?? job.date;
        i += 1;
        break;
      case "--max-iterations":
        job.maxIterations = Number(tokens[i + 1] ?? job.maxIterations) || job.maxIterations;
        i += 1;
        break;
      case "--sleep-ms":
        job.sleepMs = Number(tokens[i + 1] ?? job.sleepMs) || job.sleepMs;
        i += 1;
        break;
      case "--max-tables":
        job.maxTables = clampTables(Number(tokens[i + 1] ?? job.maxTables));
        i += 1;
        break;
      case "--once":
        job.once = true;
        job.maxIterations = 1;
        job.cloneLimit = 1;
        break;
      case "--verbose":
        job.verbose = true;
        break;
      case "--force-all":
        job.forceAll = true;
        break;
      case "--mode":
        job.mode = (tokens[i + 1] === "reserve" ? "reserve" : "assign");
        i += 1;
        break;
      case "--source-date":
        job.sourceDate = tokens[i + 1] ?? job.sourceDate;
        i += 1;
        break;
      case "--source-after":
        job.sourceAfter = tokens[i + 1] ?? job.sourceAfter;
        i += 1;
        break;
      case "--clone-limit":
        job.cloneLimit = Math.max(1, Number(tokens[i + 1] ?? job.cloneLimit) || job.cloneLimit);
        i += 1;
        break;
      case "--hold-ttl":
        job.holdTtlSeconds = Math.max(30, Number(tokens[i + 1] ?? job.holdTtlSeconds) || job.holdTtlSeconds);
        i += 1;
        break;
      case "--avoid-used":
        job.avoidUsedTables = true;
        break;
      case "--allow-reuse":
        job.avoidUsedTables = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return job;
}

function buildStrategies(maxTables: number): Strategy[] {
  const strategies: Strategy[] = [];
  for (let tables = 1; tables <= maxTables; tables += 1) {
    strategies.push({ label: `adjacent-x${tables}`, requireAdjacency: true, maxTables: tables });
  }
  for (let tables = 1; tables <= maxTables; tables += 1) {
    strategies.push({ label: `relaxed-x${tables}`, requireAdjacency: false, maxTables: tables });
  }
  return strategies;
}

async function fetchBookingStats(pool: Pool, slug: string, date: string): Promise<BookingStats> {
  const query = `
    WITH scoped AS (
      SELECT b.id, b.status,
             EXISTS (
               SELECT 1 FROM booking_table_assignments bta
               WHERE bta.booking_id = b.id
             ) AS has_assignment
      FROM bookings b
      JOIN restaurants r ON r.id = b.restaurant_id
      WHERE r.slug = $1
        AND b.booking_date = $2::date
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE has_assignment)::int AS assigned,
      COUNT(*) FILTER (WHERE NOT has_assignment)::int AS unassigned,
      COUNT(*) FILTER (WHERE status = ANY($3))::int AS pending_state
    FROM scoped;
  `;

  const result = await pool.query(query, [slug, date, VALID_STATUS_FOR_PENDING]);
  if (result.rows.length === 0) {
    return { total: 0, assigned: 0, unassigned: 0, pendingState: 0 };
  }
  const row = result.rows[0];
  return {
    total: Number(row.total ?? 0),
    assigned: Number(row.assigned ?? 0),
    unassigned: Number(row.unassigned ?? 0),
    pendingState: Number(row.pending_state ?? 0),
  };
}

function applyStrategyEnv(strategy: Strategy): () => void {
  const overrides: Record<string, string> = {
    ULTRA_REQUIRE_ADJACENCY: strategy.requireAdjacency ? "true" : "false",
    ULTRA_MAX_TABLES: String(strategy.maxTables),
  };

  const previousEntries = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  Object.entries(overrides).forEach(([key, value]) => {
    process.env[key] = value;
  });

  return () => {
    for (const [key, prev] of previousEntries) {
      if (prev === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAssignLoopJob(job: LoopJob, pool: Pool): Promise<void> {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  AUTO-ASSIGN MODE · ${job.slug} · ${job.date}                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  let stats = await fetchBookingStats(pool, job.slug, job.date);
  if (stats.total === 0) {
    console.log(`No bookings found for ${job.slug} on ${job.date}. Skipping.`);
    return;
  }
  if (stats.unassigned === 0) {
    console.log(`All ${stats.total} bookings already have assignments. Nothing to do.`);
    return;
  }

  console.log(`Found ${stats.unassigned}/${stats.total} bookings without tables (pending states: ${stats.pendingState}).`);
  const strategies = buildStrategies(job.maxTables);

  let iteration = 0;
  while (stats.unassigned > 0 && iteration < job.maxIterations) {
    iteration += 1;
    console.log(`\n▶︎ Iteration ${iteration} — ${stats.unassigned} bookings remain unassigned`);

    for (const strategy of strategies) {
      console.log(`  • Strategy ${strategy.label} (adjacency=${strategy.requireAdjacency}, maxTables=${strategy.maxTables})`);
      const restoreEnv = applyStrategyEnv(strategy);
      let reportSummary = "";

      try {
        const report = await runUltraFastAssignment({
          TARGET_RESTAURANT_SLUG: job.slug,
          TARGET_DATE: job.date,
          MINIMAL_CONSOLE_OUTPUT: !job.verbose,
          FORCE_REASSIGN_ALL: job.forceAll,
        });
        reportSummary = `successRate=${report.successRate}% failed=${report.failed}`;
      } catch (error) {
        reportSummary = `error=${error instanceof Error ? error.message : String(error)}`;
      } finally {
        restoreEnv();
      }

      stats = await fetchBookingStats(pool, job.slug, job.date);
      console.log(`    → ${reportSummary} | remaining ${stats.unassigned}/${stats.total}`);

      if (stats.unassigned === 0 || job.once) {
        break;
      }
    }

    if (stats.unassigned === 0 || job.once) {
      break;
    }

    if (iteration < job.maxIterations) {
      console.log(`  Sleeping ${job.sleepMs}ms before next pass...`);
      await delay(job.sleepMs);
      stats = await fetchBookingStats(pool, job.slug, job.date);
    }
  }

  if (stats.unassigned === 0) {
    console.log(`\n✅ Completed in ${iteration} iteration(s). All bookings have tables.`);
  } else {
    console.log(`\n⚠️  ${stats.unassigned} bookings remain after ${iteration} iteration(s).`);
  }
}

async function runReserveFlowJob(job: LoopJob, pool: Pool): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const restaurant = await loadRestaurant(supabase, job.slug);
  const sourceDate = job.sourceDate ?? job.date;
  const targetDate = job.date;
  const strategies = buildStrategies(job.maxTables);
  const usedTableIds = new Set<string>();

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  RESERVE-FLOW MODE · ${restaurant.name} (${job.slug})           ║`);
  const filterLabel = job.sourceAfter ? ` start>=${job.sourceAfter}` : "";
  console.log(`║  source=${sourceDate}${filterLabel} → target=${targetDate} | limit=${job.cloneLimit} ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const baseBookings = await loadCloneSources({
    supabase,
    restaurantId: restaurant.id,
    sourceDate,
    limit: job.cloneLimit,
    sourceAfter: job.sourceAfter,
  });
  if (baseBookings.length === 0) {
    console.log(`No base bookings found on ${sourceDate} to clone. Aborting.`);
    return;
  }

  const fallbackCustomer = await loadFallbackCustomer(supabase, restaurant.id);
  let processed = 0;

  for (const source of baseBookings) {
    if (job.once && processed > 0) {
      break;
    }

    processed += 1;
    console.log(`\n[create] Source ${source.id.slice(0, 8)} · party=${source.party_size} @ ${source.start_time ?? "??"}`);

    try {
      const created = await cloneBooking({
        source,
        restaurant,
        fallbackCustomer,
        supabase,
        targetDate,
      });

      console.log(`  ↳ Booking ${created.id.slice(0, 8)} created (status=${created.status})`);
      const success = await assignBookingSequentially({
        booking: created,
        supabase,
        strategies,
        job,
        usedTableIds,
      });

      const stats = await fetchBookingStats(pool, job.slug, targetDate);
      console.log(
        `  ↳ Post-attempt stats: assigned=${stats.assigned} pending=${stats.unassigned} (total=${stats.total})`,
      );

      if (!success) {
        console.warn(`  ⚠️ Booking ${created.id.slice(0, 8)} remained pending after all combinations.`);
      }
    } catch (error) {
      console.error(
        `  ❌ Failed to replicate booking ${source.id.slice(0, 8)}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`\n✅ Reserve-flow mode complete. Processed ${processed} booking(s).`);
}

async function cloneBooking(params: {
  source: CloneSource;
  restaurant: RestaurantRow;
  fallbackCustomer: CustomerSummary;
  supabase: ReturnType<typeof getServiceSupabaseClient>;
  targetDate: string;
}): Promise<BookingRecord> {
  const { source, restaurant, fallbackCustomer, supabase, targetDate } = params;
  const customerPersona = buildCustomerPersona(source, fallbackCustomer);
  const bookingType = safeBookingType(source.booking_type);
  const startTime = normalizeTime(source.start_time);
  const endTime = resolveEndTime({
    startTime,
    explicitEnd: source.end_time,
    timezone: restaurant.timezone,
    bookingDate: targetDate,
  });

  const result = await createBookingWithCapacityCheck({
    restaurantId: restaurant.id,
    customerId: customerPersona.id,
    bookingDate: targetDate,
    startTime,
    endTime,
    partySize: source.party_size,
    bookingType,
    customerName: customerPersona.name,
    customerEmail: customerPersona.email,
    customerPhone: customerPersona.phone,
    seatingPreference: (source.seating_preference ?? "any") as Database["public"]["Enums"]["seating_preference_type"],
    notes: source.notes ?? null,
    marketingOptIn: source.marketing_opt_in ?? false,
    idempotencyKey: `reserve-flow-${source.id}-${Date.now()}-${randomUUID()}`,
    source: "reserve-flow-stress",
    clientRequestId: randomUUID(),
    details: source.details ?? {},
  });

  if (!result.success || !result.booking) {
    const reasonParts = [
      result.message,
      result.error,
      result.details && typeof result.details === "object" ? JSON.stringify(result.details) : null,
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(reasonParts || "createBookingWithCapacityCheck failed");
  }

  return result.booking;
}

async function assignBookingSequentially(params: {
  booking: BookingRecord;
  supabase: ReturnType<typeof getServiceSupabaseClient>;
  strategies: Strategy[];
  job: LoopJob;
  usedTableIds: Set<string>;
}): Promise<boolean> {
  const { booking, supabase, strategies, job, usedTableIds } = params;
  let attempt = 0;
  const globalAvoid = job.avoidUsedTables ? new Set(usedTableIds) : null;
  const localAvoid = new Set<string>();
  if (globalAvoid) {
    for (const tableId of globalAvoid) {
      localAvoid.add(tableId);
    }
  }

  for (const strategy of strategies) {
    attempt += 1;
    console.log(
      `  [assign] Attempt ${attempt}/${strategies.length} · ${strategy.label} (booking ${booking.id.slice(0, 8)})`,
    );

    try {
      const avoidTables = job.avoidUsedTables ? Array.from(localAvoid) : undefined;
      const quote = await quoteTablesForBooking({
        bookingId: booking.id,
        createdBy: "reserve-flow-loop",
        holdTtlSeconds: job.holdTtlSeconds,
        requireAdjacency: strategy.requireAdjacency,
        maxTables: strategy.maxTables,
        avoidTables,
      });

      logCandidate("selected", quote.candidate);
      if (quote.alternates.length > 0) {
        quote.alternates.forEach((alt, idx) => logCandidate(`alternate#${idx + 1}`, alt));
      }
      if (quote.skipped && quote.skipped.length > 0) {
        console.log(
          `    ⤷ Skipped candidates: ${quote.skipped.length} (ex: ${quote.skipped[0]?.reason ?? "n/a"})`,
        );
      }
      if (quote.reason) {
        console.log(`    ⤷ Reason: ${quote.reason}`);
      }

      const attemptedTables = quote.hold?.tableIds ?? quote.candidate?.tableIds ?? [];
      if (job.avoidUsedTables) {
        for (const tableId of attemptedTables) {
          localAvoid.add(tableId);
        }
      }

      if (!quote.hold) {
        console.log("    ❌ No hold created – continuing to next configuration.");
        continue;
      }

      console.log(
        `    🔒 Hold ${quote.hold.id} tables=${quote.candidate?.tableNumbers?.join(", ") ?? quote.hold.tableIds.join(",")}`,
      );

      try {
        await confirmHoldAssignment({
          holdId: quote.hold.id,
          bookingId: booking.id,
          idempotencyKey: `reserve-flow-confirm-${booking.id}-${attempt}`,
          assignedBy: null,
        });

        await markBookingConfirmed({
          supabase,
          bookingId: booking.id,
          previousStatus: booking.status ?? "pending",
        });

        if (job.avoidUsedTables) {
          for (const tableId of attemptedTables) {
            usedTableIds.add(tableId);
          }
        }

        const updated = await reloadBooking(supabase, booking.id);
        console.log(
          `    ✅ Confirmed → status=${updated?.status ?? "unknown"} tables=${quote.candidate?.tableNumbers?.join(", ") ?? "n/a"}`,
        );
        return true;
      } catch (error) {
        console.error(
          "    ⚠️ Confirm/transition failed:",
          error instanceof Error ? error.message : String(error),
        );
        await safeReleaseHold({ supabase, holdId: quote.hold.id });
      }
    } catch (error) {
      console.error(
        "    ⚠️ quoteTablesForBooking errored:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return false;
}

async function markBookingConfirmed(params: {
  supabase: ReturnType<typeof getServiceSupabaseClient>;
  bookingId: string;
  previousStatus: string | null;
}): Promise<void> {
  const { supabase, bookingId, previousStatus } = params;
  const nowIso = new Date().toISOString();
  const { error } = await supabase.rpc("apply_booking_state_transition", {
    p_booking_id: bookingId,
    p_status: "confirmed",
    p_checked_in_at: null,
    p_checked_out_at: null,
    p_updated_at: nowIso,
    p_history_from: previousStatus ?? "pending",
    p_history_to: "confirmed",
    p_history_changed_by: null,
    p_history_changed_at: nowIso,
    p_history_reason: "reserve_flow_auto_assign",
    p_history_metadata: { script: "reserve-flow-loop" },
  });

  if (error) {
    throw new Error(error.message ?? "apply_booking_state_transition failed");
  }
}

async function reloadBooking(supabase: ReturnType<typeof getServiceSupabaseClient>, bookingId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();
  return data as Pick<BookingRecord, "id" | "status"> | null;
}

async function safeReleaseHold(params: { supabase: ReturnType<typeof getServiceSupabaseClient>; holdId: string }) {
  try {
    await releaseTableHold({ holdId: params.holdId, client: params.supabase });
    console.log(`    ↺ Hold ${params.holdId} released.`);
  } catch (error) {
    console.error("    ⚠️ Failed to release hold:", error instanceof Error ? error.message : error);
  }
}

function logCandidate(label: string, candidate: CandidateSummary | null | undefined) {
  if (!candidate) {
    console.log(`    ⤷ ${label}: none`);
    return;
  }
  console.log(
    `    ⤷ ${label}: tables=${candidate.tableNumbers.join(", ")} capacity=${candidate.totalCapacity} slack=${candidate.slack ?? 0} score=${candidate.score ?? "n/a"}`,
  );
}

function buildCustomerPersona(source: CloneSource, fallback: CustomerSummary) {
  return {
    id: source.customer_id ?? fallback.id,
    name: source.customer_name ?? fallback.full_name,
    email: source.customer_email ?? fallback.email,
    phone: source.customer_phone ?? fallback.phone,
  };
}

function safeBookingType(value: string | null | undefined) {
  try {
    return ensureBookingType((value ?? "dinner") as string);
  } catch {
    return "dinner";
  }
}

function normalizeTime(value: string | null | undefined): string {
  if (!value) return "19:00";
  const parts = value.split(":");
  if (parts.length >= 2) {
    return `${parts[0]?.padStart(2, "0")}:${parts[1]?.padStart(2, "0")}`;
  }
  return value.slice(0, 5);
}

function resolveEndTime(params: {
  startTime: string;
  explicitEnd: string | null | undefined;
  timezone: string | null;
  bookingDate: string;
}): string {
  const { startTime, explicitEnd, timezone, bookingDate } = params;
  if (explicitEnd) {
    return normalizeTime(explicitEnd);
  }
  const zone = timezone || "UTC";
  const start = DateTime.fromISO(`${bookingDate}T${startTime}`, { zone });
  return start.plus({ minutes: 90 }).toFormat("HH:mm");
}

async function loadRestaurant(supabase: ReturnType<typeof getServiceSupabaseClient>, slug: string): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to load restaurant for slug ${slug}: ${error?.message ?? "not found"}`);
  }

  return data as RestaurantRow;
}

async function loadCloneSources(params: {
  supabase: ReturnType<typeof getServiceSupabaseClient>;
  restaurantId: string;
  sourceDate: string;
  limit: number;
  sourceAfter?: string;
}): Promise<CloneSource[]> {
  const { supabase, restaurantId, sourceDate, limit, sourceAfter } = params;
  let query = supabase
    .from("bookings")
    .select(
      "id, booking_date, start_time, end_time, party_size, customer_id, customer_name, customer_email, customer_phone, seating_preference, booking_type, notes, marketing_opt_in, details",
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", sourceDate);
  if (sourceAfter) {
    query = query.gte("start_time", sourceAfter);
  }
  const { data, error } = await query.order("start_time", { ascending: true }).limit(limit);

  if (error) {
    throw new Error(`Failed to load source bookings: ${error.message}`);
  }

  return (data ?? []) as CloneSource[];
}

async function loadFallbackCustomer(
  supabase: ReturnType<typeof getServiceSupabaseClient>,
  restaurantId: string,
): Promise<CustomerSummary> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, email, phone")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Restaurant ${restaurantId} is missing customers for stress testing.`);
  }

  return data as CustomerSummary;
}

async function runJob(job: LoopJob, pool: Pool): Promise<void> {
  if (job.mode === "reserve") {
    await runReserveFlowJob(job, pool);
  } else {
    await runAssignLoopJob(job, pool);
  }
}

async function main(): Promise<void> {
  const jobs = splitIntoJobs(process.argv.slice(2)).map(parseJobArgs);
  const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

  try {
    for (const job of jobs) {
      await runJob(job, pool);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\n❌ Loop runner failed:", error);
  process.exit(1);
});
