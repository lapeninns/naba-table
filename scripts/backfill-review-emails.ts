import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { DateTime } from "luxon";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../types/supabase";
import type { TransitionResult } from "../server/ops/booking-lifecycle/actions";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const APPLY = process.argv.includes("--apply") || process.env.APPLY === "true";
const EMAIL_FILTER_RAW = process.env.EMAIL_FILTER ?? "amanshresthaaaaa@gmail.com";
const EMAIL_FILTER = EMAIL_FILTER_RAW.trim();
const EMAIL_FILTER_DISABLED =
  EMAIL_FILTER.length === 0 || EMAIL_FILTER === "*" || EMAIL_FILTER.toLowerCase() === "all";
const CUTOFF_DATE = (process.env.CUTOFF_DATE ?? "2026-01-19").trim();
const CUTOFF_TIME = (process.env.CUTOFF_TIME ?? "18:00").trim();
const ACTOR_ID_OVERRIDE = process.env.ACTOR_ID?.trim() || null;
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE ?? "200", 10);
const LIMIT = parseInt(process.env.LIMIT ?? "0", 10);
const UPDATE_EMAIL_PREFS = process.env.UPDATE_EMAIL_PREFS !== "false";

const TASK_DIR = path.join(projectRoot, "tasks", "review-email-backfill-20260119-1848");
const ARTIFACT_DIR = path.join(TASK_DIR, "artifacts");

type RestaurantRow = Pick<
  Tables<"restaurants">,
  "id" | "name" | "timezone" | "reservation_interval_minutes" | "email_send_review_request"
>;

type BookingRow = Pick<
  Tables<"bookings">,
  | "id"
  | "restaurant_id"
  | "status"
  | "start_at"
  | "end_at"
  | "booking_date"
  | "start_time"
  | "end_time"
  | "checked_in_at"
  | "checked_out_at"
  | "customer_email"
  | "customer_name"
>;

type CandidateBooking = {
  bookingId: string;
  restaurantId: string;
  restaurantName: string | null;
  timezone: string;
  startAtUtc: string | null;
  endAtUtc: string | null;
  cutoffUtc: string;
  customerEmail: string | null;
  status: string;
};

type AppliedBooking = CandidateBooking & {
  checkedInAt: string | null;
  checkedOutAt: string | null;
  completedAt: string | null;
  reviewScheduled: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function resolveActorId(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<string | null> {
  if (ACTOR_ID_OVERRIDE) return ACTOR_ID_OVERRIDE;

  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("user_id, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[actor-id] failed to resolve membership for restaurant ${restaurantId}`, error.message);
    return null;
  }

  const membershipUserId = data?.user_id ?? null;
  if (membershipUserId) {
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(membershipUserId);
      if (authData?.user?.id) {
        return membershipUserId;
      }
    } catch (authError) {
      console.warn(`[actor-id] failed to verify membership user for restaurant ${restaurantId}`, formatError(authError));
    }
  }

  try {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1 });
    const fallbackId = listData?.users?.[0]?.id ?? null;
    if (!fallbackId) {
      console.warn(`[actor-id] no auth users available for fallback on restaurant ${restaurantId}`);
    }
    return fallbackId;
  } catch (authError) {
    console.warn(`[actor-id] failed to resolve fallback auth user for restaurant ${restaurantId}`, formatError(authError));
    return null;
  }
}

function ensureArtifactsDir(): void {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function normalizeTimezone(timezone?: string | null): string {
  return timezone && timezone.trim().length > 0 ? timezone : "Europe/London";
}

function resolveLocalDateTime(
  date: string | null,
  time: string | null,
  timezone: string,
): DateTime | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  return dt.isValid ? dt : null;
}

function toUtcIso(dt: DateTime | null): string | null {
  if (!dt) return null;
  const utc = dt.toUTC();
  return utc.isValid ? utc.toISO() : null;
}

function computeStartAtUtc(booking: BookingRow, timezone: string): string | null {
  if (booking.start_at) return booking.start_at;
  const dt = resolveLocalDateTime(booking.booking_date, booking.start_time, timezone);
  return toUtcIso(dt);
}

function computeEndAtUtc(booking: BookingRow, timezone: string): string | null {
  if (booking.end_at) return booking.end_at;
  const dt = resolveLocalDateTime(booking.booking_date, booking.end_time, timezone);
  if (dt) return toUtcIso(dt);
  return computeStartAtUtc(booking, timezone);
}

function computeCutoffUtc(timezone: string): DateTime {
  const local = DateTime.fromISO(`${CUTOFF_DATE}T${CUTOFF_TIME}`, { zone: timezone });
  if (!local.isValid) {
    throw new Error(`Invalid cutoff date/time: ${CUTOFF_DATE} ${CUTOFF_TIME} for zone ${timezone}`);
  }
  return local.toUTC();
}

async function applyTransition(
  supabase: SupabaseClient<Database>,
  booking: BookingRow,
  transition: TransitionResult,
): Promise<{ status: string; checkedInAt: string | null; checkedOutAt: string | null; updatedAt: string | null } | null> {
  if (transition.skipUpdate) {
    return {
      status: transition.response.status,
      checkedInAt: transition.response.checkedInAt,
      checkedOutAt: transition.response.checkedOutAt,
      updatedAt: transition.response.updatedAt ?? null,
    };
  }

  const history = transition.history;
  if (!history) {
    throw new Error("Missing history payload for transition");
  }

  const targetStatus = (transition.updates.status ?? booking.status) as Tables<"bookings">["status"];
  const finalCheckedInAt =
    transition.updates.checked_in_at !== undefined
      ? transition.updates.checked_in_at ?? null
      : booking.checked_in_at ?? null;
  const finalCheckedOutAt =
    transition.updates.checked_out_at !== undefined
      ? transition.updates.checked_out_at ?? null
      : booking.checked_out_at ?? null;
  const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();

  const { data, error } = await supabase.rpc("apply_booking_state_transition", {
    p_booking_id: booking.id,
    p_status: targetStatus,
    p_checked_in_at: finalCheckedInAt,
    p_checked_out_at: finalCheckedOutAt,
    p_updated_at: finalUpdatedAt,
    p_history_from: history.from_status ?? booking.status,
    p_history_to: history.to_status,
    p_history_changed_by: history.changed_by ?? null,
    p_history_changed_at: history.changed_at ?? finalUpdatedAt,
    p_history_reason: history.reason ?? "status_change",
    p_history_metadata: history.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  const row = data?.[0];
  return {
    status: row?.status ?? targetStatus,
    checkedInAt: row?.checked_in_at ?? finalCheckedInAt,
    checkedOutAt: row?.checked_out_at ?? finalCheckedOutAt,
    updatedAt: row?.updated_at ?? finalUpdatedAt,
  };
}

async function fetchRestaurants(
  supabase: SupabaseClient<Database>,
): Promise<RestaurantRow[]> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, timezone, reservation_interval_minutes, email_send_review_request")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RestaurantRow[];
}

async function fetchConfirmedBookings(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  emailFilter: string,
  pageSize: number,
): Promise<BookingRow[]> {
  const results: BookingRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("bookings")
      .select(
        [
          "id",
          "restaurant_id",
          "status",
          "start_at",
          "end_at",
          "booking_date",
          "start_time",
          "end_time",
          "checked_in_at",
          "checked_out_at",
          "customer_email",
          "customer_name",
        ].join(","),
      )
      .eq("restaurant_id", restaurantId)
      .eq("status", "confirmed")
      .order("start_at", { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (!EMAIL_FILTER_DISABLED) {
      query = query.ilike("customer_email", emailFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as unknown as BookingRow[];
    if (rows.length === 0) {
      break;
    }

    results.push(...rows);
    if (rows.length < pageSize) {
      break;
    }

    offset += rows.length;
  }

  return results;
}

async function main(): Promise<void> {
  const { enqueueCheckOutSideEffects } = await import("../server/jobs/booking-side-effects");
  const { prepareCheckInTransition, prepareCheckOutTransition } = await import(
    "../server/ops/booking-lifecycle/actions",
  );
  const { BookingLifecycleError } = await import("../server/ops/booking-lifecycle/stateMachine");
  const { getServiceSupabaseClient } = await import("../server/supabase");

  const NOW_UTC = DateTime.utc();
  ensureArtifactsDir();

  const supabase = getServiceSupabaseClient();

  console.log("Backfill review emails");
  console.log("Mode:", APPLY ? "APPLY" : "DRY_RUN");
  console.log("Email filter:", EMAIL_FILTER_DISABLED ? "(disabled)" : EMAIL_FILTER);
  console.log("Cutoff:", `${CUTOFF_DATE} ${CUTOFF_TIME} (per restaurant local time)`);
  console.log("Now (UTC):", NOW_UTC.toISO());
  if (ACTOR_ID_OVERRIDE) {
    console.log("Actor ID override:", ACTOR_ID_OVERRIDE);
  } else {
    console.log("Actor ID: using first restaurant membership user_id per restaurant");
  }

  const restaurants = await fetchRestaurants(supabase);
  console.log(`Restaurants loaded: ${restaurants.length}`);

  const restaurantsToEnable = restaurants.filter((row) => row.email_send_review_request === false);
  if (restaurantsToEnable.length > 0) {
    console.log(`Restaurants with email_send_review_request=false: ${restaurantsToEnable.length}`);
    if (APPLY && UPDATE_EMAIL_PREFS) {
      const ids = restaurantsToEnable.map((row) => row.id);
      const { error } = await supabase
        .from("restaurants")
        .update({ email_send_review_request: true })
        .in("id", ids);
      if (error) {
        throw error;
      }
      console.log("Updated email_send_review_request to true for all flagged restaurants.");
    } else {
      console.log("Dry-run: no restaurant preference updates applied.");
    }
  }

  const candidates: CandidateBooking[] = [];
  const applied: AppliedBooking[] = [];
  const errors: Array<{ bookingId?: string; restaurantId?: string; error: string }> = [];

  for (const restaurant of restaurants) {
    const timezone = normalizeTimezone(restaurant.timezone);
    const cutoffUtc = computeCutoffUtc(timezone);
    const actorId = await resolveActorId(supabase, restaurant.id);
    if (!actorId) {
      console.warn(`Skipping restaurant ${restaurant.id} - no actorId resolved.`);
      continue;
    }

    const bookings = await fetchConfirmedBookings(supabase, restaurant.id, EMAIL_FILTER, PAGE_SIZE);
    if (bookings.length === 0) {
      continue;
    }

    for (const booking of bookings) {
      if (LIMIT > 0 && candidates.length >= LIMIT) {
        break;
      }

      const startAtUtc = computeStartAtUtc(booking, timezone);
      let endAtUtc = computeEndAtUtc(booking, timezone);

      if (!endAtUtc) {
        continue;
      }

      if (startAtUtc) {
        const startAt = DateTime.fromISO(startAtUtc);
        const endAt = DateTime.fromISO(endAtUtc);
        if (startAt.isValid && endAt.isValid && endAt < startAt) {
          endAtUtc = startAtUtc;
        }
      }

      const endAt = DateTime.fromISO(endAtUtc);
      if (!endAt.isValid) {
        continue;
      }

      if (endAt >= cutoffUtc) {
        continue;
      }

      if (endAt >= NOW_UTC) {
        continue;
      }

      const candidate: CandidateBooking = {
        bookingId: booking.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name ?? null,
        timezone,
        startAtUtc,
        endAtUtc,
        cutoffUtc: cutoffUtc.toISO() ?? cutoffUtc.toString(),
        customerEmail: booking.customer_email ?? null,
        status: booking.status ?? "unknown",
      };

      candidates.push(candidate);

      if (!APPLY) {
        continue;
      }

      try {
        if (!startAtUtc) {
          throw new Error("Missing start_at for check-in");
        }

        const checkIn = prepareCheckInTransition({
          booking: {
            id: booking.id,
            status: booking.status,
            checked_in_at: booking.checked_in_at,
            checked_out_at: booking.checked_out_at,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            restaurant_id: booking.restaurant_id,
          },
          actorId,
          performedAt: startAtUtc,
          reason: "backfill-review-email",
        });

        const checkInResult = await applyTransition(supabase, booking, checkIn);
        if (!checkInResult) {
          throw new Error("Check-in transition failed");
        }

        const bookingAfterCheckIn: BookingRow = {
          ...booking,
          status: checkInResult.status as BookingRow["status"],
          checked_in_at: checkInResult.checkedInAt,
          checked_out_at: checkInResult.checkedOutAt,
        };

        const performedCheckOutAt = endAtUtc;
        const checkOut = prepareCheckOutTransition({
          booking: {
            id: bookingAfterCheckIn.id,
            status: bookingAfterCheckIn.status,
            checked_in_at: bookingAfterCheckIn.checked_in_at,
            checked_out_at: bookingAfterCheckIn.checked_out_at,
            booking_date: bookingAfterCheckIn.booking_date,
            start_time: bookingAfterCheckIn.start_time,
            restaurant_id: bookingAfterCheckIn.restaurant_id,
          },
          actorId,
          performedAt: performedCheckOutAt,
          reason: "backfill-review-email",
        });

        const checkOutResult = await applyTransition(supabase, bookingAfterCheckIn, checkOut);
        if (!checkOutResult) {
          throw new Error("Check-out transition failed");
        }

        const { data: fullBooking, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", booking.id)
          .maybeSingle();

        if (error || !fullBooking) {
          throw error ?? new Error("Unable to fetch updated booking");
        }

        await enqueueCheckOutSideEffects(fullBooking as Tables<"bookings">, restaurant.id, { supabase });

        applied.push({
          ...candidate,
          checkedInAt: checkInResult.checkedInAt,
          checkedOutAt: checkOutResult.checkedOutAt,
          completedAt: checkOutResult.updatedAt ?? null,
          reviewScheduled: true,
        });
      } catch (error) {
        const message = formatError(error);
        errors.push({ bookingId: booking.id, restaurantId: booking.restaurant_id ?? undefined, error: message });
        if (error instanceof BookingLifecycleError) {
          console.error("Failed to process booking", booking.id, `[lifecycle] ${message}`);
        } else {
          console.error("Failed to process booking", booking.id, message);
        }
      }
    }

    if (LIMIT > 0 && candidates.length >= LIMIT) {
      break;
    }
  }

  const candidatePath = path.join(ARTIFACT_DIR, "candidates.json");
  const appliedPath = path.join(ARTIFACT_DIR, "applied.json");
  const errorsPath = path.join(ARTIFACT_DIR, "errors.json");
  const summaryPath = path.join(ARTIFACT_DIR, "summary.json");

  fs.writeFileSync(candidatePath, JSON.stringify(candidates, null, 2));
  fs.writeFileSync(appliedPath, JSON.stringify(applied, null, 2));
  fs.writeFileSync(errorsPath, JSON.stringify(errors, null, 2));

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    emailFilter: EMAIL_FILTER,
    cutoffDate: CUTOFF_DATE,
    cutoffTime: CUTOFF_TIME,
    nowUtc: NOW_UTC.toISO(),
    restaurantsProcessed: restaurants.length,
    candidates: candidates.length,
    applied: applied.length,
    errors: errors.length,
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log("Done.");
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Applied: ${applied.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log("Artifacts:", candidatePath, appliedPath, errorsPath, summaryPath);
}

main().catch((error) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
