import { getServiceSupabaseClient } from "@/server/supabase";

import type { Json } from "@/types/supabase";

export type ObservabilitySeverity = "info" | "notice" | "warning" | "error" | "critical";

export async function recordObservabilityEvent(params: {
  source: string;
  eventType: string;
  severity?: ObservabilitySeverity;
  context?: Json | null;
  restaurantId?: string | null;
  bookingId?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceSupabaseClient();
    await supabase.from("observability_events").insert({
      source: params.source,
      event_type: params.eventType,
      severity: params.severity ?? "info",
      context: params.context ?? null,
      restaurant_id: params.restaurantId ?? null,
      booking_id: params.bookingId ?? null,
    });
  } catch (error) {
    console.error("[observability] failed to record event", {
      source: params.source,
      eventType: params.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
