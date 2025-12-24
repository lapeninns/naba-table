import { afterEach, describe, expect, it, vi } from "vitest";

import * as pastTimeValidation from "../bookings/pastTimeValidation";

describe("assertBookingNotInPast", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows midnight inputs expressed as 24:xx in the restaurant timezone", () => {
    const timezone = "America/New_York";

    vi.spyOn(pastTimeValidation, "getCurrentTimeInTimezone").mockReturnValue(
      new Date("2025-12-25T04:55:00.000Z")
    );

    expect(() =>
      pastTimeValidation.assertBookingNotInPast(
        timezone,
        "2025-12-24",
        "24:02:56"
      )
    ).not.toThrow();
  });

  it("rejects inputs with hours above 24", () => {
    const timezone = "UTC";

    vi.spyOn(pastTimeValidation, "getCurrentTimeInTimezone").mockReturnValue(
      new Date("2025-12-24T00:00:00.000Z")
    );

    expect(() =>
      pastTimeValidation.assertBookingNotInPast(timezone, "2025-12-24", "25:00:00")
    ).toThrow(/Invalid date value for timezone conversion/);
  });
});
