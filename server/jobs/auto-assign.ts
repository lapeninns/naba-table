import { quoteTablesForBooking, atomicConfirmAndTransition } from "@/server/capacity/tables";
import { sendBookingConfirmationEmail, sendBookingModificationConfirmedEmail } from "@/server/emails/bookings";
import {
  isAutoAssignOnBookingEnabled,
  getAutoAssignMaxRetries,
  getAutoAssignRetryDelaysMs,
  getAutoAssignStartCutoffMinutes,
} from "@/server/feature-flags";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Tables } from "@/types/supabase";

type AutoAssignReason = "creation" | "modification";
type AutoAssignEmailVariant = "standard" | "modified";

type AutoAssignOptions = {
  bypassFeatureFlag?: boolean;
  reason?: AutoAssignReason;
  emailVariant?: AutoAssignEmailVariant;
};

/**
 * Attempts to automatically assign tables for a booking and flips status to confirmed.
 * Sends the configured confirmation email variant on success.
 *
 * Best-effort: swallows errors and logs; safe to fire-and-forget.
 */
export async function autoAssignAndConfirmIfPossible(
  bookingId: string,
  options?: AutoAssignOptions,
): Promise<void> {
  const SUPPRESS_EMAILS = process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';
  const logJob = (stage: string, payload: Record<string, unknown> = {}) => {
    console.info("[auto-assign][job]", stage, { bookingId, ...payload });
  };

  const shouldRun = options?.bypassFeatureFlag || isAutoAssignOnBookingEnabled();
  if (!shouldRun) {
    logJob("skipped.feature-flag", { bypass: Boolean(options?.bypassFeatureFlag) });
    return;
  }

  const emailVariant: AutoAssignEmailVariant = options?.emailVariant ?? "standard";
  const reason: AutoAssignReason = options?.reason ?? "creation";
  logJob("scheduled", { reason, emailVariant, bypass: Boolean(options?.bypassFeatureFlag) });

  const supabase = getServiceSupabaseClient();

  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "id, restaurant_id, status, booking_date, start_time, end_time, start_at, end_at, party_size, customer_email, customer_name, reference, seating_preference, booking_type, notes, source, loyalty_points_awarded, created_at, updated_at, auto_assign_idempotency_key",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !booking) {
      console.error("[auto-assign] booking lookup failed", { bookingId, error: error?.message ?? error });
      logJob("failed.lookup", { error: error?.message ?? error });
      return;
    }

    // Skip non-actionable states
    if (["cancelled", "no_show", "completed"].includes(String(booking.status))) {
      logJob("skipped.status", { status: booking.status });
      return;
    }

    // If already confirmed (e.g., manual/other flow), ensure guest receives the ticket.
    if (booking.status === "confirmed") {
      try {
        // Cast is safe for email template expectations
        if (!SUPPRESS_EMAILS) {
          if (emailVariant === "modified") {
            await sendBookingModificationConfirmedEmail(booking as unknown as Tables<"bookings">);
          } else {
            await sendBookingConfirmationEmail(booking as unknown as Tables<"bookings">);
          }
        }
      } catch (e) {
        console.error("[auto-assign] failed sending confirmation for already-confirmed", { bookingId, error: e });
        logJob("failed.email_already_confirmed", { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.started",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      context: { status: booking.status, trigger: reason },
    });

    const maxRetries = getAutoAssignMaxRetries();
    const delays = getAutoAssignRetryDelaysMs();
    const cutoffMinutes = getAutoAssignStartCutoffMinutes();

    const startAt = typeof booking.start_at === 'string' ? new Date(booking.start_at) : null;
    const withinCutoff = () => {
      if (!startAt || Number.isNaN(startAt.getTime())) return false;
      const msUntilStart = startAt.getTime() - Date.now();
      return msUntilStart <= cutoffMinutes * 60_000;
    };

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // Attempt loop
    let attempt = 0;
    const startedAt = Date.now();
    // include initial attempt + retry count
    const maxAttempts = Math.max(1, Math.min(maxRetries + 1, 11));

    while (attempt < maxAttempts) {
      logJob("attempt.start", { attempt, maxAttempts });
      // If near service start, avoid further attempts (let ops handle)
      if (attempt > 0 && withinCutoff()) {
        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.cutoff_skipped",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: { attempt, cutoffMinutes },
        });
        logJob("attempt.cutoff_skipped", { attempt, cutoffMinutes });
        break;
      }

      const attemptStart = Date.now();
      try {
        const quote = await quoteTablesForBooking({
          bookingId,
          // createdBy is optional down the stack; pass undefined to store NULL
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createdBy: (undefined as any) as string,
          holdTtlSeconds: 180,
        });

        if (!quote.hold) {
          await recordObservabilityEvent({
            source: "auto_assign",
            eventType: "auto_assign.attempt",
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            context: {
              attempt,
              success: false,
              reason: quote.reason ?? 'NO_HOLD',
              alternates: (quote.alternates ?? []).length,
              trigger: reason,
            },
          });
          logJob("attempt.no_hold", {
            attempt,
            reason: quote.reason ?? "NO_HOLD",
            alternates: (quote.alternates ?? []).length,
          });
        } else {
          const idempotencyKey = booking.auto_assign_idempotency_key ?? `auto-${bookingId}`;

          await atomicConfirmAndTransition({
            bookingId,
            holdId: quote.hold.id,
            idempotencyKey,
            assignedBy: null,
            historyReason: "auto_assign",
            historyMetadata: { source: "auto-assign", holdId: quote.hold.id },
          });

          // Reload booking and send confirmed email
          const { data: updated } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", bookingId)
            .maybeSingle();
          if (updated && !SUPPRESS_EMAILS) {
            if (emailVariant === "modified") {
              await sendBookingModificationConfirmedEmail(updated as unknown as Tables<"bookings">);
            } else {
              await sendBookingConfirmationEmail(updated as unknown as Tables<"bookings">);
            }
          }

          const durationMs = Date.now() - startedAt;
          await recordObservabilityEvent({
            source: "auto_assign",
            eventType: "auto_assign.succeeded",
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            context: { attempt, durationMs, trigger: reason },
          });
          logJob("attempt.success", { attempt, holdId: quote.hold.id, durationMs });
          return; // done
        }
      } catch (e) {
        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.attempt_error",
          severity: "warning",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: { attempt, error: e instanceof Error ? e.message : String(e), trigger: reason },
        });
        logJob("attempt.error", { attempt, error: e instanceof Error ? e.message : String(e) });
      }

      attempt += 1;
      if (attempt >= maxAttempts) break;
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 5000;
      const elapsed = Date.now() - attemptStart;
      // Sleep remaining delay budget for this attempt slot
      const toSleep = Math.max(0, delay - elapsed);
      if (toSleep > 0) {
        await sleep(toSleep);
      }
      // Refresh latest booking state; if someone confirmed in between, stop
      const { data: latest } = await supabase.from('bookings').select('status').eq('id', bookingId).maybeSingle();
      if (latest?.status === 'confirmed') {
        await recordObservabilityEvent({
          source: 'auto_assign',
          eventType: 'auto_assign.exited_already_confirmed',
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: { attempt, trigger: reason },
        });
        logJob("attempt.success_race", { attempt });
        return;
      }
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.failed",
      severity: "warning",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      context: { attempts: attempt, trigger: reason },
    });
    logJob("exhausted", { attempts: attempt, maxAttempts });
  } catch (e) {
    console.error("[auto-assign] unexpected error", { bookingId, error: e });
    logJob("failed.unexpected", { error: e instanceof Error ? e.message : String(e) });
  }
}
