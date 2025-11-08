import { clearBookingTableAssignments, updateBookingRecord, type BookingRecord, type UpdateBookingPayload } from "@/server/bookings";
import { sendBookingModificationPendingEmail } from "@/server/emails/bookings";
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
