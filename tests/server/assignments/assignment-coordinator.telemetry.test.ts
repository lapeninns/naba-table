import { describe, expect, it, vi, beforeEach } from "vitest";

import { emitCoordinatorEvent } from "@/server/assignments/assignment-coordinator";
import { recordObservabilityEvent } from "@/server/observability";

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("emitCoordinatorEvent", () => {
  const spy = vi.mocked(recordObservabilityEvent);

  beforeEach(() => {
    spy.mockClear();
  });

  it("includes trigger + detail fields in the context", () => {
    emitCoordinatorEvent("coordinator.test", {
      bookingId: "booking-123",
      restaurantId: "restaurant-456",
      trigger: "creation",
      severity: "warning",
      details: { strategy: "optimal_fit", attempts: 2 },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      source: "assignment.coordinator",
      eventType: "coordinator.test",
      bookingId: "booking-123",
      restaurantId: "restaurant-456",
      severity: "warning",
    });
    expect(payload?.context).toEqual({ trigger: "creation", strategy: "optimal_fit", attempts: 2 });
  });

  it("omits context when nothing is provided", () => {
    emitCoordinatorEvent("coordinator.no-context", {});

    const payload = spy.mock.calls.at(-1)?.[0];
    expect(payload?.context).toBeNull();
  });
});
