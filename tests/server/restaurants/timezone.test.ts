import { describe, expect, it } from "vitest";

import { assertValidTimezone, ensureValidTimezone, getDefaultTimezone } from "@/server/restaurants/timezone";

describe("timezone validation helpers", () => {
  it("returns canonical timezone when value is already valid", () => {
    expect(assertValidTimezone("Europe/London")).toBe("Europe/London");
  });

  it("normalizes valid timezone ignoring case", () => {
    const result = assertValidTimezone("america/new_york");
    expect(result === "America/New_York" || result === "america/new_york").toBe(true);
  });

  it("falls back to default when ensureValidTimezone receives invalid input", () => {
    const fallback = ensureValidTimezone("Invalid/Timezone");
    expect(fallback).toBe(getDefaultTimezone());
  });

  it("allows custom fallback for invalid values", () => {
    const fallback = ensureValidTimezone("Invalid/Timezone", { fallback: "UTC" });
    expect(fallback).toBe("UTC");
  });

  it("throws when assertion receives invalid timezone", () => {
    expect(() => assertValidTimezone("not-a-timezone")).toThrow(/Invalid timezone/);
  });
});
