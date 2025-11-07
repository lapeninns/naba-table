import { emitHoldConfirmed } from "@/server/capacity/telemetry";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Json } from "@/types/supabase";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

export type OutboxPayload = Record<string, unknown>;

export type EnqueueParams = {
  eventType: string;
  restaurantId?: string | null;
  bookingId?: string | null;
  idempotencyKey?: string | null;
  dedupeKey?: string | null;
  payload: OutboxPayload;
  client?: DbClient;
};

const ACTIVE_STATUSES = ["pending", "processing"] as const;

function isUniqueViolation(error: unknown): error is PostgrestError {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as Partial<PostgrestError>).code;
  return typeof code === "string" && code === "23505";
}

export async function enqueueOutboxEvent(params: EnqueueParams): Promise<void> {
  const { eventType, restaurantId, bookingId, idempotencyKey, dedupeKey, payload, client } = params;
  const supabase = client ?? getServiceSupabaseClient();
  try {
    const insert = {
      event_type: eventType,
      restaurant_id: restaurantId ?? null,
      booking_id: bookingId ?? null,
      idempotency_key: idempotencyKey ?? null,
      dedupe_key: dedupeKey ?? null,
      payload: payload as Json,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: null,
    };
    const { error } = await supabase.from("capacity_outbox").insert(insert);
    if (error) {
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  } catch (error) {
    // Best-effort enqueue — do not throw in hot paths
    console.warn("[outbox] enqueue failed", { eventType, bookingId, restaurantId, error });
  }
}

type OutboxRow = {
  id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string | null;
  restaurant_id: string | null;
  booking_id: string | null;
  idempotency_key: string | null;
  payload: Json;
  created_at: string;
};

function computeBackoffMs(attempt: number): number {
  const base = 250; // ms
  const max = 30_000; // 30s
  const exp = Math.min(attempt, 8);
  const jitter = Math.random() * base;
  return Math.min(max, Math.pow(2, exp) * base + jitter);
}

async function handleEvent(row: OutboxRow): Promise<void> {
  const { event_type: type, payload } = row;
  if (type === "capacity.hold.confirmed") {
    await emitHoldConfirmed(payload as unknown as Parameters<typeof emitHoldConfirmed>[0]);
    return;
  }
  if (type === "capacity.assignment.sync") {
    // For now, emit an observability event to trace sync; extend with real downstreams when available.
    await recordObservabilityEvent({
      source: "capacity.sync",
      eventType: "capacity.assignment.synchronized",
      severity: "info",
      context: payload,
      restaurantId: row.restaurant_id ?? undefined,
      bookingId: row.booking_id ?? undefined,
    });
    return;
  }
  // Unknown event — mark done to avoid infinite loop, but log for follow-up
  console.warn("[outbox] unknown event type", { type, id: row.id });
}

export async function processOutboxBatch(params?: { limit?: number; client?: DbClient }): Promise<{ processed: number; failed: number; dead: number; pending: number; }>
{
  const { limit = 100, client } = params ?? {};
  const supabase = client ?? getServiceSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("capacity_outbox")
    .select("*")
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("status", { ascending: true })
    .order("next_attempt_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !Array.isArray(data) || data.length === 0) {
    return { processed: 0, failed: 0, dead: 0, pending: 0 };
  }

  let processed = 0;
  let failed = 0;
  let dead = 0;

  for (const row of data as OutboxRow[]) {
    // Mark as processing
    try {
      await supabase
        .from("capacity_outbox")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq("status", row.status);
    } catch {
      // skip race
    }

    try {
      await handleEvent(row);
      await supabase.from("capacity_outbox").update({ status: "done" }).eq("id", row.id);
      processed += 1;
    } catch (err) {
      const attempts = (row.attempt_count ?? 0) + 1;
      const backoffMs = computeBackoffMs(attempts);
      const next = new Date(Date.now() + backoffMs).toISOString();
      const isDead = attempts >= 10;
      await supabase
        .from("capacity_outbox")
        .update({
          status: isDead ? "dead" : "pending",
          attempt_count: attempts,
          next_attempt_at: isDead ? null : next,
        })
        .eq("id", row.id);
      if (isDead) {
        dead += 1;
      } else {
        failed += 1;
      }
      console.warn("[outbox] handler failed", { id: row.id, eventType: row.event_type, attempts, error: err });
    }
  }

  const summary = { processed, failed, dead, pending: Math.max(0, (data?.length ?? 0) - processed) };
  try {
    await recordObservabilityEvent({
      source: "outbox",
      eventType: "outbox.batch",
      severity: failed > 0 || dead > 0 ? "warning" : "info",
      context: summary,
    });
  } catch {
    // ignore telemetry failures
  }
  return summary;
}
