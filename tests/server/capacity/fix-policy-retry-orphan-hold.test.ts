import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { confirmWithPolicyRetry } from "@/server/capacity/table-assignment/policy-retry";
import { quoteTablesForBooking } from "@/server/capacity/table-assignment/quote";
import { releaseHoldWithRetry } from "@/server/capacity/table-assignment/supabase";
import { recordObservabilityEvent } from "@/server/observability";

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/capacity/table-assignment/policy-drift", () => ({
  publishPolicyDriftNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/capacity/table-assignment/quote", () => ({
  quoteTablesForBooking: vi.fn(),
}));

vi.mock("@/server/capacity/table-assignment/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/server/capacity/table-assignment/supabase")>(
    "@/server/capacity/table-assignment/supabase",
  );

  return {
    ...actual,
    releaseHoldWithRetry: vi.fn(),
  };
});

/**
 * Regression for #17: a policy-drift / assignment-conflict retry releases the
 * old hold; if that release FAILS and the subsequent re-quote also fails, the
 * old hold would otherwise linger in the DB until TTL with no trace beyond a
 * console.warn. The fix records the orphaned hold id and emits structured
 * `hold.release_failed` + `hold.orphaned` events instead of silently dropping
 * it.
 */
describe("confirmWithPolicyRetry orphaned hold reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not silently orphan a hold when release fails and re-quote then fails (conflict path)", async () => {
    // Release always fails.
    vi.mocked(releaseHoldWithRetry).mockRejectedValue(new Error("release boom"));

    // Confirm always raises a retryable assignment conflict.
    const confirmFn = vi.fn().mockRejectedValue(
      new AssignTablesRpcError({
        message: "assign_tables_atomic_v2 assignment duplicate for table abc",
        code: "ASSIGNMENT_CONFLICT",
        details: null,
        hint: null,
      }),
    );

    // Re-quote fails to obtain a replacement hold.
    vi.mocked(quoteTablesForBooking).mockResolvedValue({
      hold: null,
      candidate: null,
      alternates: [],
      nextTimes: [],
      reason: "NO_HOLD",
    } as never);

    await expect(
      confirmWithPolicyRetry({
        supabase: {} as never,
        bookingId: "booking-1",
        restaurantId: "restaurant-1",
        holdId: "hold-1",
        idempotencyKey: "idem-1",
        assignedBy: null,
        transition: { targetStatus: "confirmed", historyReason: "test" },
        maxAttempts: 2,
        enableRetry: true,
        contextRef: { currentHoldId: "hold-1" },
        confirmFn,
      }),
    ).rejects.toMatchObject({ code: "ASSIGNMENT_REQUOTE_FAILED" });

    // The release was attempted (and failed).
    expect(releaseHoldWithRetry).toHaveBeenCalledWith({
      holdId: "hold-1",
      client: {} as never,
    });

    // The release failure is recorded as a structured event, not just console.warn.
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "hold.release_failed",
        severity: "error",
        context: expect.objectContaining({ holdId: "hold-1" }),
      }),
    );

    // The orphaned hold id is surfaced for reconciliation on the failure path.
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "hold.orphaned",
        severity: "error",
        context: expect.objectContaining({ holdIds: ["hold-1"] }),
      }),
    );
  });

  it("still reports the orphaned hold even when a later attempt ultimately succeeds", async () => {
    // First release fails, leaving hold-1 orphaned; the retry then succeeds.
    vi.mocked(releaseHoldWithRetry).mockRejectedValueOnce(new Error("release boom"));

    const confirmFn = vi
      .fn()
      .mockRejectedValueOnce(
        new AssignTablesRpcError({
          message: "assign_tables_atomic_v2 assignment duplicate for table abc",
          code: "ASSIGNMENT_CONFLICT",
          details: null,
          hint: null,
        }),
      )
      .mockResolvedValueOnce([
        {
          tableId: "table-2",
          assignmentId: "assignment-2",
          startAt: "2026-03-27T14:30:00.000Z",
          endAt: "2026-03-27T15:55:00.000Z",
          mergeGroupId: null,
        },
      ]);

    vi.mocked(quoteTablesForBooking).mockResolvedValue({
      hold: { id: "hold-2" },
      candidate: null,
      alternates: [],
      nextTimes: [],
    } as never);

    const result = await confirmWithPolicyRetry({
      supabase: {} as never,
      bookingId: "booking-1",
      restaurantId: "restaurant-1",
      holdId: "hold-1",
      idempotencyKey: "idem-1",
      assignedBy: null,
      transition: { targetStatus: "confirmed", historyReason: "test" },
      maxAttempts: 2,
      enableRetry: true,
      contextRef: { currentHoldId: "hold-1" },
      confirmFn,
    });

    expect(result.attempts).toBe(2);

    // Even on eventual success, the earlier release failure must not be swallowed.
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "hold.orphaned",
        context: expect.objectContaining({ holdIds: ["hold-1"] }),
      }),
    );
  });
});
