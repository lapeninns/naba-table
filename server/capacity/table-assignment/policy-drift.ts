import { PolicyDriftError, type PolicyDriftDetails, type PolicyDriftKind } from "./types";

import type { AssignTablesRpcError } from "@/server/capacity/holds";
import type { Json } from "@/types/supabase";

export function extractPolicyDriftDetails(error: AssignTablesRpcError | PolicyDriftError): PolicyDriftDetails {
  if (error instanceof PolicyDriftError) {
    return error.driftDetails;
  }
  if (!error.details) {
    return { raw: null };
  }

  try {
    const parsed = JSON.parse(error.details) as Json;
    const parsedRecord = (typeof parsed === "object" && parsed !== null ? parsed : null) as
      | Record<string, Json>
      | null;
    const details: PolicyDriftDetails = { raw: parsed };

    if (parsedRecord) {
      if (typeof parsedRecord.expected === "string") {
        details.expectedHash = parsedRecord.expected;
      }
      if (typeof parsedRecord.actual === "string") {
        details.actualHash = parsedRecord.actual;
      }

      const adjacency = parsedRecord.adjacency as Record<string, Json> | undefined;
      if (adjacency && typeof adjacency === "object") {
        const expectedEdges = adjacency.expectedEdges;
        const actualEdges = adjacency.actualEdges;
        details.adjacency = {
          expectedEdges: Array.isArray(expectedEdges) ? (expectedEdges as string[]) : undefined,
          actualEdges: Array.isArray(actualEdges) ? (actualEdges as string[]) : undefined,
          expectedHash: typeof adjacency.expectedHash === "string" ? adjacency.expectedHash : undefined,
          actualHash: typeof adjacency.actualHash === "string" ? adjacency.actualHash : undefined,
        };
      }

      const zones = parsedRecord.zones as Record<string, Json> | undefined;
      if (zones && typeof zones === "object") {
        details.zones = {
          expected: zones.expected,
          actual: zones.actual,
        };
      }
    }

    return details;
  } catch {
    return { raw: error.details };
  }
}

export async function publishPolicyDriftNotification(params: {
  bookingId: string;
  restaurantId?: string | null;
  holdId: string;
  attempt: number;
  recovered: boolean;
  details: PolicyDriftDetails;
  kind: PolicyDriftKind;
}): Promise<void> {
  try {
    const { enqueueOutboxEvent } = await import("@/server/outbox");
    await enqueueOutboxEvent({
      eventType: "capacity.policy.drift",
      restaurantId: params.restaurantId ?? null,
      bookingId: params.bookingId,
      payload: {
        holdId: params.holdId,
        attempt: params.attempt,
        recovered: params.recovered,
        details: params.details,
        kind: params.kind,
      },
    });
  } catch (error) {
    console.warn("[capacity.policy] failed to enqueue drift notification", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
