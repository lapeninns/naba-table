import fc from "fast-check";
import { DateTime } from "luxon";
import { describe, it, expect } from "vitest";

import { windowsOverlap } from "@/server/capacity/tables";

const BASE = DateTime.fromISO("2025-01-01T00:00:00Z");
const ZONES = ["UTC", "Europe/London", "America/New_York", "Asia/Tokyo"] as const;

const DST_TRANSITIONS = [
  {
    zone: "America/New_York",
    transitions: ["2025-03-09T02:00:00", "2025-11-02T02:00:00"],
  },
  {
    zone: "America/Los_Angeles",
    transitions: ["2025-03-09T02:00:00", "2025-11-02T02:00:00"],
  },
  {
    zone: "Europe/London",
    transitions: ["2025-03-30T01:00:00", "2025-10-26T02:00:00"],
  },
  {
    zone: "Europe/Berlin",
    transitions: ["2025-03-30T02:00:00", "2025-10-26T03:00:00"],
  },
  {
    zone: "Australia/Sydney",
    transitions: ["2025-04-06T03:00:00", "2025-10-05T02:00:00"],
  },
];

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

  it("does not overlap when intervals share a DST boundary", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DST_TRANSITIONS),
        fc.integer({ min: 15, max: 180 }),
        fc.integer({ min: 15, max: 180 }),
        ({ zone, transitions }, beforeMinutes, afterMinutes) => {
          for (const transitionIso of transitions) {
            const transition = DateTime.fromISO(transitionIso, { zone });
            const firstStart = transition.minus({ minutes: beforeMinutes });
            const secondEnd = transition.plus({ minutes: afterMinutes });

            expect(
              windowsOverlap(
                { start: firstStart.toISO(), end: transition.toISO() },
                { start: transition.toISO(), end: secondEnd.toISO() },
              ),
            ).toBe(false);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("detects overlaps that straddle DST changes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DST_TRANSITIONS),
        fc.integer({ min: 5, max: 120 }),
        fc.integer({ min: 5, max: 120 }),
        ({ zone, transitions }, beforeMinutes, overlapMinutes) => {
          for (const transitionIso of transitions) {
            const transition = DateTime.fromISO(transitionIso, { zone });
            const firstStart = transition.minus({ minutes: beforeMinutes });
            const secondStart = transition.minus({ minutes: overlapMinutes });
            const secondEnd = transition.plus({ minutes: overlapMinutes });

            expect(
              windowsOverlap(
                { start: firstStart.toISO(), end: transition.toISO() },
                { start: secondStart.toISO(), end: secondEnd.toISO() },
              ),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
