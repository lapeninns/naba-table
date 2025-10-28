import { describe, it, expect } from "vitest";

import { createAvailabilityBitset, markWindow } from "@/server/capacity/planner/bitset";
import { __internal, type ManualAssignmentConflict } from "@/server/capacity/tables";

import type { DateTime } from "luxon";

const { computeBookingWindow, extractConflictsForTables, windowsOverlap } = __internal;

type AvailabilityEntry = {
  bitset: ReturnType<typeof createAvailabilityBitset>;
  windows: Array<{
    tableId: string;
    startAt: string;
    endAt: string;
    bookingId: string | null;
    source: "booking" | "hold";
  }>;
};

type AvailabilityMap = Map<string, AvailabilityEntry>;

function toIsoUtc(dateTime: DateTime): string {
  return (
    dateTime.toUTC().toISO({ suppressMilliseconds: true }) ??
    dateTime.toUTC().toISO() ??
    dateTime.toUTC().toString()
  );
}

function legacyEnumerateConflicts(
  busy: AvailabilityMap,
  tableIds: string[],
  window: ReturnType<typeof computeBookingWindow>,
): ManualAssignmentConflict[] {
  const conflicts: ManualAssignmentConflict[] = [];
  const start = toIsoUtc(window.block.start);
  const end = toIsoUtc(window.block.end);

  for (const tableId of tableIds) {
    const entry = busy.get(tableId);
    if (!entry) continue;
    for (const other of entry.windows) {
      if (windowsOverlap({ start, end }, { start: other.startAt, end: other.endAt })) {
        conflicts.push({
          tableId,
          bookingId: other.bookingId,
          startAt: other.startAt,
          endAt: other.endAt,
          source: other.source,
        });
      }
    }
  }

  return conflicts;
}

function registerWindow(
  map: AvailabilityMap,
  tableId: string,
  window: { startAt: string; endAt: string; bookingId: string | null; source: "booking" | "hold" },
): void {
  if (!map.has(tableId)) {
    map.set(tableId, { bitset: createAvailabilityBitset(), windows: [] });
  }
  const entry = map.get(tableId)!;
  markWindow(entry.bitset, window.startAt, window.endAt);
  entry.windows.push({ tableId, ...window });
}

describe("extractConflictsForTables", () => {
  it("matches the legacy enumerator on dense schedules", () => {
    const busy: AvailabilityMap = new Map();
    const tableIds = ["t-1", "t-2", "t-3", "t-4"];

    registerWindow(busy, "t-1", {
      startAt: "2025-03-10T18:05:00Z",
      endAt: "2025-03-10T19:10:00Z",
      bookingId: "b-101",
      source: "booking",
    });
    registerWindow(busy, "t-1", {
      startAt: "2025-03-10T19:45:00Z",
      endAt: "2025-03-10T20:15:00Z",
      bookingId: "h-201",
      source: "hold",
    });
    registerWindow(busy, "t-2", {
      startAt: "2025-03-10T17:30:00Z",
      endAt: "2025-03-10T18:20:00Z",
      bookingId: "b-102",
      source: "booking",
    });
    registerWindow(busy, "t-2", {
      startAt: "2025-03-10T19:00:00Z",
      endAt: "2025-03-10T20:30:00Z",
      bookingId: "b-103",
      source: "booking",
    });
    registerWindow(busy, "t-3", {
      startAt: "2025-03-10T20:00:00Z",
      endAt: "2025-03-10T21:00:00Z",
      bookingId: "h-301",
      source: "hold",
    });
    registerWindow(busy, "t-4", {
      startAt: "2025-03-10T17:00:00Z",
      endAt: "2025-03-10T17:45:00Z",
      bookingId: "b-401",
      source: "booking",
    });

    const window = computeBookingWindow({
      startISO: "2025-03-10T18:30:00Z",
      partySize: 4,
    });

    const modern = extractConflictsForTables(busy, tableIds, window);
    const legacy = legacyEnumerateConflicts(busy, tableIds, window);

    expect(modern).toEqual(legacy);
  });
});
