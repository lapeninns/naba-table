import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { getVenuePolicy } from "@/server/capacity/policy";
import { computeBookingWindow } from "@/server/capacity/table-assignment/booking-window";

function startJustBefore(serviceEndHour: number): string {
  return DateTime.fromObject({ year: 2025, month: 1, day: 1, hour: serviceEndHour - 1, minute: 30 }, { zone: "Europe/London" }).toUTC().toISO()!;
}

describe("computeBookingWindow allowOverrun", () => {
  it("clamps services that disallow overruns", () => {
    const policy = getVenuePolicy();
    if (policy.services.dinner) {
      policy.services.dinner.allowOverrun = false;
    }
    const startISO = startJustBefore(22); // dinner end 22:00
    const window = computeBookingWindow({
      startISO,
      partySize: 4,
      policy,
      serviceHint: "dinner",
    });
    expect(window.block.end.toISO()).toBe(DateTime.fromISO("2025-01-01T22:00:00.000Z").toISO());
    expect(window.clampedToServiceEnd).toBe(true);
  });

  it("allows lunch to overrun when configured", () => {
    const policy = getVenuePolicy();
    const startISO = startJustBefore(15);
    const window = computeBookingWindow({
      startISO,
      partySize: 4,
      policy,
      serviceHint: "lunch",
    });
    expect(window.block.end.toISO()).toBe(DateTime.fromISO("2025-01-01T15:50:00.000Z").toISO());
    expect(window.clampedToServiceEnd).toBe(false);
  });
});
