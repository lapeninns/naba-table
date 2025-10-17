import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Tables } from "@/types/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

export type BookingHistoryEntry = {
  id: number;
  bookingId: string;
  fromStatus: Tables<"booking_state_history">["from_status"];
  toStatus: Tables<"booking_state_history">["to_status"];
  changedAt: string;
  changedBy: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type HistoryOptions = {
  client?: DbClient;
};

export async function listBookingHistory(bookingId: string, options: HistoryOptions = {}): Promise<BookingHistoryEntry[]> {
  const client = options.client ?? getServiceSupabaseClient();

  const { data, error } = await client
    .from("booking_state_history")
    .select("id, booking_id, from_status, to_status, changed_at, changed_by, reason, metadata")
    .eq("booking_id", bookingId)
    .order("changed_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Tables<"booking_state_history">[];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.changed_by).filter((value): value is string => typeof value === "string" && value.length > 0)),
  );

  const actorMap = new Map<string, { id: string; name: string | null; email: string | null }>();

  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await client
      .from("profiles")
      .select("id, name, email")
      .in("id", actorIds);

    if (actorError) {
      throw actorError;
    }

    for (const actor of actors ?? []) {
      actorMap.set(actor.id, {
        id: actor.id,
        name: actor.name ?? null,
        email: actor.email ?? null,
      });
    }
  }

  return rows.map((row) => ({
    id: row.id,
    bookingId,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
    reason: row.reason,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    actor: row.changed_by ? actorMap.get(row.changed_by) ?? null : null,
  }));
}
