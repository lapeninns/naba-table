import { describe, expect, it } from "vitest";

import { resolveQuoteZoneLock } from "@/server/capacity/table-assignment/quote";

describe("resolveQuoteZoneLock", () => {
  it("blocks mismatched zone lock", () => {
    const result = resolveQuoteZoneLock({
      bookingZoneId: "zone-a",
      requestedZoneId: "zone-b",
    });
    expect(result.ok).toBe(false);
    expect(result.zoneId).toBe("zone-a");
    expect(result.reason).toMatch("locked to zone");
  });

  it("uses booking zone when requested zone is absent", () => {
    const result = resolveQuoteZoneLock({
      bookingZoneId: "zone-a",
      requestedZoneId: null,
    });
    expect(result.ok).toBe(true);
    expect(result.zoneId).toBe("zone-a");
  });

  it("uses requested zone when booking has no lock", () => {
    const result = resolveQuoteZoneLock({
      bookingZoneId: null,
      requestedZoneId: "zone-b",
    });
    expect(result.ok).toBe(true);
    expect(result.zoneId).toBe("zone-b");
  });
});
