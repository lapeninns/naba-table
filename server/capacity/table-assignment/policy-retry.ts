import { AssignTablesRpcError } from "@/server/capacity/holds";
import { recordObservabilityEvent } from "@/server/observability";

import { DEFAULT_HOLD_TTL_SECONDS } from "./constants";
import { publishPolicyDriftNotification } from "./policy-drift";
import { quoteTablesForBooking } from "./quote";
import { releaseHoldWithRetry, type DbClient } from "./supabase";
import {
  PolicyDriftError,
  type PolicyDriftDetails,
  type PolicyDriftKind,
  type TableAssignmentMember,
  type ConfirmHoldTransition,
  type ConfirmHoldAssignmentOptions,
} from "./types";
import { serializeDetails } from "./utils";

export type ConfirmWithPolicyRetryParams = {
  supabase: DbClient;
  bookingId: string;
  restaurantId?: string | null;
  holdId: string;
  idempotencyKey: string;
  assignedBy: string | null;
  transition: ConfirmHoldTransition;
  signal?: AbortSignal;
  maxAttempts: number;
  enableRetry: boolean;
  contextRef: { currentHoldId: string };
  confirmFn: (options: ConfirmHoldAssignmentOptions & { client: DbClient }) => Promise<TableAssignmentMember[]>;
};

function isRetryableAssignmentConflict(error: unknown): error is AssignTablesRpcError {
  if (!(error instanceof AssignTablesRpcError)) {
    return false;
  }

  const code = (error.code ?? "").toUpperCase();
  const message = error.message.toLowerCase();

  return (
    code === "ASSIGNMENT_CONFLICT" ||
    code === "P0001" ||
    message.includes("assignment duplicate") ||
    message.includes("duplicate") ||
    message.includes("overlap") ||
    message.includes("conflict")
  );
}

export async function confirmWithPolicyRetry(
  params: ConfirmWithPolicyRetryParams,
): Promise<{ assignments: TableAssignmentMember[]; attempts: number }> {
  const {
    supabase,
    bookingId,
    restaurantId,
    idempotencyKey,
    assignedBy,
    transition,
    signal,
    maxAttempts,
    enableRetry,
    contextRef,
    confirmFn,
  } = params;

  const totalAttempts = enableRetry ? Math.max(1, maxAttempts) : 1;
  let attempt = 0;
  let driftDetected = false;
  let driftNotificationSent = false;
  let conflictDetected = false;
  let lastError: unknown = null;
  let lastDriftInfo: { kind: PolicyDriftKind; details: PolicyDriftDetails } | null = null;

  while (attempt < totalAttempts) {
    try {
      const assignments = await confirmFn({
        holdId: contextRef.currentHoldId,
        bookingId,
        idempotencyKey,
        assignedBy,
        client: supabase,
        signal,
        transition,
      });

      if (driftDetected) {
        const recoveryKind = lastDriftInfo?.kind ?? null;
        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "policy_drift.recovered",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempts: attempt + 1,
            holdId: contextRef.currentHoldId,
            kind: recoveryKind,
          },
        });

        await publishPolicyDriftNotification({
          bookingId,
          restaurantId,
          holdId: contextRef.currentHoldId,
          attempt: attempt + 1,
          recovered: true,
          details: lastDriftInfo?.details ?? { raw: null },
          kind: recoveryKind ?? "policy",
        });
      }

      if (conflictDetected) {
        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "assignment_conflict.recovered",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempts: attempt + 1,
            holdId: contextRef.currentHoldId,
          },
        });
      }

      return { assignments, attempts: attempt + 1 };
    } catch (error) {
      if (isRetryableAssignmentConflict(error) && enableRetry && attempt < totalAttempts - 1) {
        conflictDetected = true;

        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "assignment_conflict.detected",
          severity: "warning",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempt: attempt + 1,
            holdId: contextRef.currentHoldId,
            code: error.code ?? null,
            details: error.details ?? null,
          },
        });

        try {
          await releaseHoldWithRetry({ holdId: contextRef.currentHoldId, client: supabase });
        } catch (releaseError) {
          console.warn("[capacity.policy] failed to release hold during conflict retry", {
            holdId: contextRef.currentHoldId,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }

        const quote = await quoteTablesForBooking({
          bookingId,
          createdBy: assignedBy ?? "assignment-conflict-retry",
          holdTtlSeconds: DEFAULT_HOLD_TTL_SECONDS,
          client: supabase,
          signal,
        });

        if (!quote.hold) {
          lastError = new AssignTablesRpcError({
            message: "Failed to re-quote tables after assignment conflict",
            code: "ASSIGNMENT_REQUOTE_FAILED",
            details: serializeDetails({ reason: quote.reason ?? "NO_HOLD" }),
            hint: quote.reason ?? null,
          });
          break;
        }

        contextRef.currentHoldId = quote.hold.id;
        attempt += 1;
        continue;
      }

      if (error instanceof PolicyDriftError && enableRetry && attempt < totalAttempts - 1) {
        driftDetected = true;
        const details = error.driftDetails;
        lastDriftInfo = { kind: error.kind, details };

        await recordObservabilityEvent({
          source: "capacity.policy",
          eventType: "policy_drift.detected",
          severity: "warning",
          restaurantId: restaurantId ?? undefined,
          bookingId,
          context: {
            attempt: attempt + 1,
            holdId: contextRef.currentHoldId,
            details,
            kind: error.kind,
          },
        });

        if (!driftNotificationSent) {
          driftNotificationSent = true;
          await publishPolicyDriftNotification({
            bookingId,
            restaurantId,
            holdId: contextRef.currentHoldId,
            attempt: attempt + 1,
            recovered: false,
            details,
            kind: error.kind,
          });
        }

        try {
          await releaseHoldWithRetry({ holdId: contextRef.currentHoldId, client: supabase });
        } catch (releaseError) {
          console.warn("[capacity.policy] failed to release hold during policy drift retry", {
            holdId: contextRef.currentHoldId,
            error: releaseError instanceof Error ? releaseError.message : String(releaseError),
          });
        }

        const quote = await quoteTablesForBooking({
          bookingId,
          createdBy: assignedBy ?? "policy-retry",
          holdTtlSeconds: DEFAULT_HOLD_TTL_SECONDS,
          client: supabase,
          signal,
        });

        if (!quote.hold) {
          lastError = new AssignTablesRpcError({
            message: "Failed to re-quote tables after policy drift",
            code: "POLICY_REQUOTE_FAILED",
            details: serializeDetails({ reason: quote.reason ?? "NO_HOLD" }),
            hint: quote.reason ?? null,
          });
          break;
        }

        contextRef.currentHoldId = quote.hold.id;
        attempt += 1;
        continue;
      }

      lastError = error;
      break;
    }
  }

  if (driftDetected) {
    await recordObservabilityEvent({
      source: "capacity.policy",
      eventType: "policy_drift.failed",
      severity: "error",
      restaurantId: restaurantId ?? undefined,
      bookingId,
      context: {
        attempt: attempt + 1,
        holdId: contextRef.currentHoldId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
        kind: lastDriftInfo?.kind ?? null,
      },
    });
  }

  if (conflictDetected) {
    await recordObservabilityEvent({
      source: "capacity.policy",
      eventType: "assignment_conflict.failed",
      severity: "error",
      restaurantId: restaurantId ?? undefined,
      bookingId,
      context: {
        attempt: attempt + 1,
        holdId: contextRef.currentHoldId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
    });
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new AssignTablesRpcError({
    message: "Policy drift retry failed",
    code: "POLICY_RETRY_FAILED",
    details: serializeDetails({ reason: "UNKNOWN" }),
    hint: null,
  });
}
