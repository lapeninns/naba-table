import { quoteTablesForBooking, confirmHoldAssignment } from "@/server/capacity/tables";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import {
  isAutoAssignOnBookingEnabled,
  getAutoAssignMaxRetries,
  getAutoAssignRetryDelaysMs,
  getAutoAssignStartCutoffMinutes,
} from "@/server/feature-flags";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Tables } from "@/types/supabase";

/**
 * Attempts to automatically assign tables for a newly created booking and
 * flips status to confirmed. Sends the confirmed email on success.
 *
 * Best-effort: swallows errors and logs; safe to fire-and-forget.
 */
export async function autoAssignAndConfirmIfPossible(bookingId: string): Promise<void> {
  const SUPPRESS_EMAILS = process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';
  if (!isAutoAssignOnBookingEnabled()) return;

  const supabase = getServiceSupabaseClient();

  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "id, restaurant_id, status, booking_date, start_time, end_time, start_at, end_at, party_size, customer_email, customer_name, reference, seating_preference, booking_type, notes, source, loyalty_points_awarded, created_at, updated_at",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !booking) {
      console.error("[auto-assign] booking lookup failed", { bookingId, error: error?.message ?? error });
      return;
    }

    // Skip non-actionable states
    if (["cancelled", "no_show", "completed"].includes(String(booking.status))) {
      return;
    }

    // If already confirmed (e.g., manual/other flow), ensure guest receives the ticket.
    if (booking.status === "confirmed") {
      try {
        // Cast is safe for email template expectations
        if (!SUPPRESS_EMAILS) {
          await sendBookingConfirmationEmail(booking as unknown as Tables<"bookings">);
        }
      } catch (e) {
        console.error("[auto-assign] failed sending confirmation for already-confirmed", { bookingId, error: e });
      }
      return;
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.started",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      context: { status: booking.status },
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
      // If near service start, avoid further attempts (let ops handle)
      if (attempt > 0 && withinCutoff()) {
        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.cutoff_skipped",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: { attempt, cutoffMinutes },
        });
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
            },
          });
        } else {
          await confirmHoldAssignment({
            holdId: quote.hold.id,
            bookingId,
            idempotencyKey: `auto-${bookingId}`,
            assignedBy: null,
          });

          // Transition booking status -> confirmed with history
          const nowIso = new Date().toISOString();
          const { error: txError } = await supabase.rpc("apply_booking_state_transition", {
            p_booking_id: bookingId,
            p_status: "confirmed",
            p_checked_in_at: null,
            p_checked_out_at: null,
            p_updated_at: nowIso,
            p_history_from: booking.status,
            p_history_to: "confirmed",
            p_history_changed_by: null,
            p_history_changed_at: nowIso,
            p_history_reason: "auto_assign",
            p_history_metadata: { source: "auto-assign", holdId: quote.hold.id },
          });
          if (txError) {
            throw new Error(txError.message ?? String(txError));
          }

          // Reload booking and send confirmed email
          const { data: updated } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", bookingId)
            .maybeSingle();
          if (updated && !SUPPRESS_EMAILS) {
            await sendBookingConfirmationEmail(updated as unknown as Tables<"bookings">);
          }

          const durationMs = Date.now() - startedAt;
          await recordObservabilityEvent({
            source: "auto_assign",
            eventType: "auto_assign.succeeded",
            restaurantId: booking.restaurant_id,
            bookingId: booking.id,
            context: { attempt, durationMs },
          });
          return; // done
        }
      } catch (e) {
        await recordObservabilityEvent({
          source: "auto_assign",
          eventType: "auto_assign.attempt_error",
          severity: "warning",
          restaurantId: booking.restaurant_id,
          bookingId: booking.id,
          context: { attempt, error: e instanceof Error ? e.message : String(e) },
        });
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
          context: { attempt },
        });
        return;
      }
    }

    await recordObservabilityEvent({
      source: "auto_assign",
      eventType: "auto_assign.failed",
      severity: "warning",
      restaurantId: booking.restaurant_id,
      bookingId: booking.id,
      context: { attempts: attempt },
    });
  } catch (e) {
    console.error("[auto-assign] unexpected error", { bookingId, error: e });
  }
}
