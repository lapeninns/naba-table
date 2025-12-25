import { describe, expect, it } from "vitest";

import { PastBookingError, assertBookingNotInPast, __test__ } from "@/server/bookings/pastTimeValidation";

describe("normalizeIsoLocal24HourRollover", () => {
  it("normalizes 24:xx:xx to 00:xx:xx on the next day", () => {
    expect(__test__.normalizeIsoLocal24HourRollover("2025-01-01T24:30:15")).toBe("2025-01-02T00:30:15");
    expect(__test__.normalizeIsoLocal24HourRollover("2025-01-01T24:00:00")).toBe("2025-01-02T00:00:00");
  });

  it("handles month and year rollovers", () => {
    expect(__test__.normalizeIsoLocal24HourRollover("2025-12-31T24:59:59")).toBe("2026-01-01T00:59:59");
    expect(__test__.normalizeIsoLocal24HourRollover("2025-02-28T24:00:00")).toBe("2025-03-01T00:00:00");
  });

  it("leaves non-24 hour values unchanged", () => {
    expect(__test__.normalizeIsoLocal24HourRollover("2025-01-01T23:59:59")).toBe("2025-01-01T23:59:59");
    expect(__test__.normalizeIsoLocal24HourRollover("not-a-date")).toBe("not-a-date");
  });
});

describe("assertBookingNotInPast", () => {
  it("accepts startTime values with 24:xx:xx by rolling over to next day", () => {
    expect(() =>
      assertBookingNotInPast("UTC", "2099-01-01", "24:15:00", {
        graceMinutes: 0,
      }),
    ).not.toThrow();
  });

  it("throws PastBookingError (not parse errors) when 24:xx:xx is in the past", () => {
    expect(() =>
      assertBookingNotInPast("UTC", "2000-01-01", "24:15:00", {
        graceMinutes: 0,
      }),
    ).toThrow(PastBookingError);
  });
});

