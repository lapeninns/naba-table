import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingRecord } from "@/server/bookings";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const persistPayloads: Array<Record<string, unknown>> = [];
const observabilityEvents: Array<Record<string, unknown>> = [];

const booking: BookingRecord = {
  id: "booking-1",
  restaurant_id: "rest-1",
  status: "pending",
} as BookingRecord;

const supabaseStub = {} as SupabaseClient<Database, "public">;

describe("attemptInlineAutoAssign overlap handling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    persistPayloads.length = 0;
    observabilityEvents.length = 0;
  });

  it("marks inline attempt as failed and does not throw when allocations_no_overlap occurs", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        featureFlags: {
          autoAssignOnBooking: true,
          inlineAutoAssignTimeoutMs: 5000,
        },
      },
    }));

    vi.doMock("@/server/capacity/auto-assign-last-result", () => ({
      buildInlineLastResult: (params: Record<string, unknown>) => params,
    }));

    vi.doMock("@/server/bookings", () => ({
      updateBookingRecord: async (_client: unknown, _id: string, payload: Record<string, unknown>) => {
        persistPayloads.push(payload);
        return {
          ...booking,
          ...payload,
        };
      },
    }));

    const quoteTablesForBooking = vi.fn().mockResolvedValue({
      hold: { id: "hold-1" },
      reason: null,
      alternates: [],
      plannerStats: null,
    });

    const atomicConfirmAndTransition = vi.fn().mockRejectedValue(new Error("allocations_no_overlap"));

    vi.doMock("@/server/capacity/tables", () => ({
      quoteTablesForBooking,
      atomicConfirmAndTransition,
    }));

    vi.doMock("@/server/observability", () => ({
      recordObservabilityEvent: vi.fn((event: Record<string, unknown>) => {
        observabilityEvents.push(event);
        return Promise.resolve();
      }),
    }));

    vi.doMock("@/server/capacity/planner-telemetry", () => ({
      recordPlannerQuoteTelemetry: vi.fn(),
    }));

    vi.doMock("@/server/capacity/planner-reason", () => ({
      classifyPlannerReason: () => ({ category: "transient", code: "transient.allocations_overlap" }),
    }));

    const { attemptInlineAutoAssign } = await import("@/server/bookings/inline-auto-assign");

    const result = await attemptInlineAutoAssign(supabaseStub, booking, "rest-1");

    expect(result.id).toBe(booking.id);
    expect(atomicConfirmAndTransition).toHaveBeenCalledOnce();
    expect(quoteTablesForBooking).toHaveBeenCalledOnce();

    const lastPersist = persistPayloads.at(-1);
    expect(lastPersist?.auto_assign_last_result).toBeDefined();
    expect((lastPersist?.auto_assign_last_result as Record<string, unknown>).reason).toBe("allocations_no_overlap");

    const overlapEvent = observabilityEvents.find((e) => e?.eventType === "inline_auto_assign.confirm_overlap");
    expect(overlapEvent).toBeTruthy();
  });
});
