import { describe, expect, it } from "vitest";

import {
  convertIsoToVenueDateTime,
  convertOptionalIsoToVenueDateTime,
} from "@/server/bookings/timezoneConversion";

describe("convertIsoToVenueDateTime", () => {
  it("returns booking date/time in the venue timezone (BST example)", () => {
    const { date, time } = convertIsoToVenueDateTime("2025-10-22T18:00:00.000Z", "Europe/London");

    expect(date).toBe("2025-10-22");
    expect(time).toBe("19:00");
  });

  it("handles offsets that roll back to the previous calendar day", () => {
    const { date, time } = convertIsoToVenueDateTime("2025-06-01T01:15:00.000Z", "America/Los_Angeles");

    expect(date).toBe("2025-05-31");
    expect(time).toBe("18:15");
  });

  it("throws when provided ISO value is invalid", () => {
    expect(() => convertIsoToVenueDateTime("not-an-iso", "Europe/London")).toThrow("Invalid ISO datetime value.");
  });
});

describe("convertOptionalIsoToVenueDateTime", () => {
  it("returns null for empty input", () => {
    expect(convertOptionalIsoToVenueDateTime(null, "Europe/London")).toBeNull();
    expect(convertOptionalIsoToVenueDateTime(undefined, "Europe/London")).toBeNull();
  });

  it("delegates to the strict converter when value is present", () => {
    const result = convertOptionalIsoToVenueDateTime("2025-10-22T18:00:00.000Z", "Europe/London");
    expect(result?.time).toBe("19:00");
  });
});
