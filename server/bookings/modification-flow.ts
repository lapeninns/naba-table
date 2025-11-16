import { randomUUID } from "crypto";

import { env } from "@/lib/env";
import { clearBookingTableAssignments, updateBookingRecord, type BookingRecord, type UpdateBookingPayload } from "@/server/bookings";
import { buildInlineLastResult } from "@/server/capacity/auto-assign-last-result";
import { atomicConfirmAndTransition, quoteTablesForBooking } from "@/server/capacity/tables";
import { sendBookingModificationPendingEmail } from "@/server/emails/bookings";
import { sendBookingModificationConfirmedEmail } from "@/server/emails/bookings";
import { recordObservabilityEvent } from "@/server/observability";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

export type ModificationFlowSource = "guest" | "ops";

type BeginFlowParams = {
  client: DbClient;
  bookingId: string;
  payload: UpdateBookingPayload;
  existingBooking: Tables<"bookings">;
  source: ModificationFlowSource;
};

const SUPPRESS_EMAILS = process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

type InlineAttemptResult =
  | { ok: true; booking: Tables<"bookings">; durationMs: number; alternates: number }
  | { ok: false; reason: string; durationMs: number; alternates: number };

async function attemptInlineModificationAssign(params: {
  booking: Tables<"bookings">;
  client: DbClient;
  timeoutMs: number;
}): Promise<InlineAttemptResult> {
  const { booking, client } = params;
  const timeoutMs = Math.max(500, params.timeoutMs);
  const start = Date.now();

  const run = async (): Promise<InlineAttemptResult> => {
    const quote = await quoteTablesForBooking({
      bookingId: booking.id,
      // createdBy is optional downstream; pass undefined to store NULL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdBy: (undefined as any) as string,
      holdTtlSeconds: 180,
      requireAdjacency: undefined,
      maxTables: undefined,
    });
    const durationMs = Date.now() - start;
    if (!quote.hold) {
      return { ok: false as const, reason: quote.reason ?? "NO_HOLD", durationMs, alternates: quote.alternates?.length ?? 0 };
    }

    const idempotencyKey = booking.auto_assign_idempotency_key ?? `mod-inline-${booking.id}`;
    await atomicConfirmAndTransition({
      bookingId: booking.id,
      holdId: quote.hold.id,
      idempotencyKey,
      assignedBy: null,
      historyReason: "modification_inline_auto_assign",
      historyMetadata: { source: "modification-inline", holdId: quote.hold.id },
    });

    const { data: reloaded } = await client.from("bookings").select("*").eq("id", booking.id).maybeSingle();
    const nextBooking = (reloaded ?? booking) as Tables<"bookings">;
    return { ok: true as const, booking: nextBooking, durationMs, alternates: quote.alternates?.length ?? 0 };
  };

  try {
    const result = await run();
    if (!result.ok && result.reason === "NO_HOLD" && result.durationMs >= timeoutMs) {
      return { ...result, reason: "INLINE_TIMEOUT" };
    }
    return result;
  } catch (error) {
    console.error("[booking.modification] inline auto-assign failed", error);
    return { ok: false, reason: "INLINE_ERROR", durationMs: Date.now() - start, alternates: 0 };
  }
}

export async function beginBookingModificationFlow(params: BeginFlowParams): Promise<BookingRecord> {
  const { client, bookingId, payload, source, existingBooking } = params;

  const pendingPayload: UpdateBookingPayload = {
    ...payload,
    status: "pending",
  };

  const updated = await updateBookingRecord(client, bookingId, pendingPayload);

  await clearBookingTableAssignments(client, bookingId);

  try {
    await recordObservabilityEvent({
      source: "booking.modification",
      eventType: "booking.modification.pending",
      severity: "info",
      restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id ?? undefined,
      bookingId: updated.id,
      context: {
        trigger: source,
        previousStatus: existingBooking.status ?? null,
      },
    });
  } catch (telemetryError) {
    console.warn("[booking.modification] telemetry failed", telemetryError);
  }

  const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;
  const inlinePlannerStrategy = { requireAdjacency: null, maxTables: null };
  const inlinePlannerTrigger = "inline_modification";
  const inlineAttemptId = randomUUID();

  const persistInlineResult = async (result: {
    success: boolean;
    reason: string | null;
    durationMs: number;
    alternates: number;
    emailSent: boolean;
  }) => {
    const inlineLastResult = buildInlineLastResult({
      durationMs: result.durationMs,
      success: result.success,
      reason: result.reason,
      strategy: inlinePlannerStrategy,
      trigger: inlinePlannerTrigger,
      alternates: result.alternates,
      attemptId: inlineAttemptId,
      emailSent: result.emailSent,
      emailVariant: "modified",
    });
    try {
      await updateBookingRecord(client, updated.id, { auto_assign_last_result: inlineLastResult });
    } catch (persistError) {
      console.warn("[booking.modification] failed to persist inline result", persistError);
    }
  };

  const inlineResult = await attemptInlineModificationAssign({
    booking: updated,
    client,
    timeoutMs: inlineTimeoutMs,
  });

  if (inlineResult.ok) {
    const confirmed = inlineResult.booking;
    await persistInlineResult({
      success: true,
      reason: null,
      durationMs: inlineResult.durationMs,
      alternates: inlineResult.alternates,
      emailSent: !SUPPRESS_EMAILS,
    });

    try {
      await recordObservabilityEvent({
        source: "booking.modification",
        eventType: "booking.modification.inline_confirmed",
        severity: "info",
        restaurantId: confirmed.restaurant_id ?? existingBooking.restaurant_id ?? undefined,
        bookingId: confirmed.id,
        context: {
          trigger: source,
          duration_ms: inlineResult.durationMs,
          alternates: inlineResult.alternates,
        },
      });
    } catch (telemetryError) {
      console.warn("[booking.modification] telemetry inline_confirmed failed", telemetryError);
    }

    if (!SUPPRESS_EMAILS && confirmed.customer_email?.trim()) {
      try {
        await sendBookingModificationConfirmedEmail(confirmed as BookingRecord);
      } catch (emailError) {
        console.error("[booking.modification] inline confirmation email failed", emailError);
      }
    }

    return confirmed as BookingRecord;
  }

  await persistInlineResult({
    success: false,
    reason: inlineResult.reason,
    durationMs: inlineResult.durationMs,
    alternates: inlineResult.alternates,
    emailSent: false,
  });

  if (!SUPPRESS_EMAILS && updated.customer_email?.trim()) {
    try {
      await sendBookingModificationPendingEmail(updated);
    } catch (emailError) {
      console.error("[booking.modification] pending email failed", emailError);
    }
  }

  try {
    const { autoAssignAndConfirmIfPossible } = await import("@/server/jobs/auto-assign");
    void autoAssignAndConfirmIfPossible(updated.id, {
      bypassFeatureFlag: true,
      reason: "modification",
      emailVariant: "modified",
    });
  } catch (schedulerError) {
    console.error("[booking.modification] scheduling auto-assign failed", schedulerError);
  }

  return updated;
}
