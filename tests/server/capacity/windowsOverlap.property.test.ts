import fc from "fast-check";
import { DateTime } from "luxon";
import { describe, it, expect } from "vitest";

import { windowsOverlap } from "@/server/capacity/tables";

const BASE = DateTime.fromISO("2025-01-01T00:00:00Z");
const ZONES = ["UTC", "Europe/London", "America/New_York", "Asia/Tokyo"] as const;

const intervalArb = fc.record({
  startOffsetMinutes: fc.integer({ min: -24 * 60, max: 24 * 60 }),
  durationMinutes: fc.integer({ min: 1, max: 6 * 60 }),
  zone: fc.constantFrom(...ZONES),
});

describe("windowsOverlap property", () => {
  it("matches half-open semantics for randomized ISO intervals", () => {
    fc.assert(
      fc.property(intervalArb, intervalArb, (first, second) => {
        const firstStart = BASE.plus({ minutes: first.startOffsetMinutes }).setZone(first.zone);
        const firstEnd = firstStart.plus({ minutes: first.durationMinutes });
        const secondStart = BASE.plus({ minutes: second.startOffsetMinutes }).setZone(second.zone);
        const secondEnd = secondStart.plus({ minutes: second.durationMinutes });

        const a = { start: firstStart.toISO(), end: firstEnd.toISO() };
        const b = { start: secondStart.toISO(), end: secondEnd.toISO() };

        const expected = firstStart.toMillis() < secondEnd.toMillis() && secondStart.toMillis() < firstEnd.toMillis();

        expect(windowsOverlap(a, b)).toBe(expected);
        expect(windowsOverlap(b, a)).toBe(expected);
      }),
      { numRuns: 250 },
    );
  });
});
