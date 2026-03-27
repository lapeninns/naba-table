import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignTablesRpcError } from "@/server/capacity/holds";
import { confirmWithPolicyRetry } from "@/server/capacity/table-assignment/policy-retry";
import { publishPolicyDriftNotification } from "@/server/capacity/table-assignment/policy-drift";
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
    releaseHoldWithRetry: vi.fn().mockResolvedValue(undefined),
  };
});

describe("confirmWithPolicyRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-quotes once when confirm fails with an assignment conflict", async () => {
    const confirmFn = vi
      .fn()
      .mockRejectedValueOnce(
        new AssignTablesRpcError({
          message: "assign_tables_atomic_v2 assignment duplicate for table 2430cb58-e5b6-40c8-a868-d72972e96b5a",
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
      transition: {
        targetStatus: "confirmed",
        historyReason: "test",
      },
      maxAttempts: 2,
      enableRetry: true,
      contextRef: { currentHoldId: "hold-1" },
      confirmFn,
    });

    expect(result.attempts).toBe(2);
    expect(result.assignments).toHaveLength(1);
    expect(releaseHoldWithRetry).toHaveBeenCalledWith({
      holdId: "hold-1",
      client: {} as never,
    });
    expect(quoteTablesForBooking).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        holdId: "hold-2",
        bookingId: "booking-1",
        idempotencyKey: "idem-1",
      }),
    );
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "assignment_conflict.detected",
      }),
    );
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "assignment_conflict.recovered",
      }),
    );
    expect(publishPolicyDriftNotification).not.toHaveBeenCalled();
  });

  it("fails clearly when conflict retry cannot obtain a replacement hold", async () => {
    const confirmFn = vi.fn().mockRejectedValue(
      new AssignTablesRpcError({
        message: "assign_tables_atomic_v2 assignment duplicate for table 2430cb58-e5b6-40c8-a868-d72972e96b5a",
        code: "ASSIGNMENT_CONFLICT",
        details: null,
        hint: null,
      }),
    );

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
        transition: {
          targetStatus: "confirmed",
          historyReason: "test",
        },
        maxAttempts: 2,
        enableRetry: true,
        contextRef: { currentHoldId: "hold-1" },
        confirmFn,
      }),
    ).rejects.toMatchObject({
      code: "ASSIGNMENT_REQUOTE_FAILED",
      message: "Failed to re-quote tables after assignment conflict",
    });

    expect(releaseHoldWithRetry).toHaveBeenCalledWith({
      holdId: "hold-1",
      client: {} as never,
    });
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "assignment_conflict.failed",
      }),
    );
  });
});
