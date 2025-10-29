import fc from "fast-check";
import { DateTime } from "luxon";
import { describe, it, expect } from "vitest";

import { createAvailabilityBitset, markWindow, isWindowFree } from "@/server/capacity/planner/bitset";

describe("availability bitset", () => {
  it("marks each registered window as occupied for sub-intervals inside [start, end)", () => {
    const bitset = createAvailabilityBitset();
    const windows = [
      { start: "2025-03-10T18:00:00Z", end: "2025-03-10T18:45:00Z" },
      { start: "2025-03-10T19:15:00Z", end: "2025-03-10T19:55:00Z" },
      { start: "2025-03-10T21:00:00Z", end: "2025-03-10T21:30:00Z" },
    ];

    for (const window of windows) {
      markWindow(bitset, window.start, window.end);
    }

    for (const window of windows) {
      const start = DateTime.fromISO(window.start);
      const end = DateTime.fromISO(window.end);
      const mid = start.plus({ minutes: 10 });

      expect(isWindowFree(bitset, window.start, window.end)).toBe(false);
      expect(isWindowFree(bitset, mid.minus({ minutes: 5 }).toISO(), mid.toISO())).toBe(false);
      expect(isWindowFree(bitset, start.plus({ minutes: 1 }).toISO(), end.minus({ minutes: 1 }).toISO())).toBe(false);
      expect(isWindowFree(bitset, window.end, end.plus({ minutes: 10 }).toISO())).toBe(true);
    }
  });

  it("treats registered ranges as half-open intervals under random sampling", () => {
    fc.assert(
      fc.property(
        fc.record({
          startMinutes: fc.integer({ min: 0, max: 12 * 60 }),
          durationMinutes: fc.integer({ min: 5, max: 3 * 60 }),
        }),
        ({ startMinutes, durationMinutes }) => {
          const start = DateTime.fromISO("2025-01-01T00:00:00Z").plus({ minutes: startMinutes });
          const end = start.plus({ minutes: durationMinutes });
          const bitset = createAvailabilityBitset();
          markWindow(bitset, start.toISO(), end.toISO());

          // Occupied for entire window
          expect(isWindowFree(bitset, start.toISO(), end.toISO())).toBe(false);
          // Occupied for any strict sub-range inside the window
          const midStart = start.plus({ minutes: 1 });
          const midEnd = end.minus({ minutes: 1 });
          if (midStart < midEnd) {
            expect(isWindowFree(bitset, midStart.toISO(), midEnd.toISO())).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("does not mark a zero-length interval as occupied", () => {
    const start = "2025-03-10T18:00:00Z";
    const bitset = createAvailabilityBitset();
    markWindow(bitset, start, start);
    expect(isWindowFree(bitset, start, start)).toBe(true);
  });

  it("treats back-to-back intervals as non-overlapping at the boundary", () => {
    const bitset = createAvailabilityBitset();
    const firstEnd = "2025-03-10T19:00:00Z";
    markWindow(bitset, "2025-03-10T18:00:00Z", firstEnd);
    expect(isWindowFree(bitset, firstEnd, "2025-03-10T19:30:00Z")).toBe(true);
    expect(isWindowFree(bitset, "2025-03-10T17:30:00Z", "2025-03-10T18:30:00Z")).toBe(false);
  });
});
