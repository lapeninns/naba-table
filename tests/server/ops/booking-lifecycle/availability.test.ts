import { describe, expect, it } from "vitest";

import { isBookingLifecycleAllowedToday } from "@/server/ops/booking-lifecycle/availability";

describe("isBookingLifecycleAllowedToday", () => {
  it("allows same-date actions even without a window", () => {
    const now = new Date("2025-12-18T10:00:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      now,
    });

    expect(allowed).toBe(true);
  });

  it("allows cross-midnight actions within the booking window", () => {
    const now = new Date("2025-12-19T00:30:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "23:00",
      endTime: "01:30",
      now,
    });

    expect(allowed).toBe(true);
  });

  it("allows cross-midnight actions within the grace period", () => {
    const now = new Date("2025-12-19T01:50:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "23:00",
      endTime: "01:30",
      now,
    });

    expect(allowed).toBe(true);
  });

  it("respects a shorter custom grace period", () => {
    const now = new Date("2025-12-19T01:50:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "23:00",
      endTime: "01:30",
      graceMinutes: 10,
      now,
    });

    expect(allowed).toBe(false);
  });

  it("blocks cross-midnight actions after the booking window", () => {
    const now = new Date("2025-12-19T02:30:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "23:00",
      endTime: "01:30",
      now,
    });

    expect(allowed).toBe(false);
  });

  it("blocks non-same-date actions when the window is incomplete", () => {
    const now = new Date("2025-12-19T10:00:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "18:00",
      endTime: null,
      now,
    });

    expect(allowed).toBe(false);
  });

  it("blocks non-overnight actions outside the window on a later date", () => {
    const now = new Date("2025-12-19T19:40:00Z");
    const allowed = isBookingLifecycleAllowedToday({
      bookingDate: "2025-12-18",
      timezone: "UTC",
      startTime: "18:00",
      endTime: "19:00",
      now,
    });

    expect(allowed).toBe(false);
  });
});
