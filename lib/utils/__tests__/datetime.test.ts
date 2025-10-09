import { describe, expect, it } from "vitest";

import { getDateInTimezone } from "@/lib/utils/datetime";

describe("getDateInTimezone", () => {
  it("formats date in UTC consistently", () => {
    const sample = new Date("2024-10-05T15:30:00Z");
    expect(getDateInTimezone(sample, "UTC")).toBe("2024-10-05");
  });

  it("resolves timezone-adjusted date", () => {
    const sample = new Date("2024-10-05T01:30:00Z"); // still 5th in UTC
    expect(getDateInTimezone(sample, "America/Los_Angeles")).toBe("2024-10-04");
  });
});

