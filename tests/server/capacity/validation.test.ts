process.env.BASE_URL ??= "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from: vi.fn(),
  }),
}));

import { validateBookingWindow } from "@/server/capacity/validation";

describe("validateBookingWindow", () => {
  it("approves bookings within lunch window", () => {
    const result = validateBookingWindow({
      bookingDate: "2025-05-10",
      startTime: "12:30",
      partySize: 2,
      timezone: "Europe/London",
    });

    expect(result.ok).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.dining?.end).toBeDefined();
  });

  it("rejects bookings outside service hours", () => {
    const result = validateBookingWindow({
      bookingDate: "2025-05-10",
      startTime: "23:30",
      partySize: 4,
      timezone: "Europe/London",
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("outside_service_hours");
  });
});
