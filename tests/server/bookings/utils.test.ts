import { describe, expect, it } from "vitest";

import {
  buildBookingAuditSnapshot,
  deriveEndTime,
  inferMealTypeFromTime,
  minutesFromTime,
  minutesToTime,
} from "@/server/bookings";
import { makeBookingRecord } from "@/tests/helpers/opsFactories";

describe("booking time utilities", () => {
  it("infers lunch vs dinner break points at 17:00", () => {
    expect(inferMealTypeFromTime("11:30")).toBe("lunch");
    expect(inferMealTypeFromTime("16:59")).toBe("lunch");
    expect(inferMealTypeFromTime("17:00")).toBe("dinner");
    expect(inferMealTypeFromTime("21:15")).toBe("dinner");
  });

  it("derives end time based on booking type duration", () => {
    // drinks default duration 75 minutes
    expect(deriveEndTime("18:00", "drinks")).toBe("19:15");

    // lunch default duration 90 minutes
    expect(deriveEndTime("12:45", "lunch")).toBe("14:15");

    // dinner default duration 120 minutes
    expect(deriveEndTime("19:30", "dinner")).toBe("21:30");
  });

  it("converts minutes to HH:MM and back without drift", () => {
    const inputs = [0, 75, 12 * 60 + 5, 23 * 60 + 59];
    for (const value of inputs) {
      const formatted = minutesToTime(value);
      const roundTrip = minutesFromTime(formatted);
      expect(roundTrip).toBe(value % (24 * 60));
    }
  });
});

describe("buildBookingAuditSnapshot", () => {
  it("captures before and after changes with field-level diffs", () => {
    const previous = makeBookingRecord({
      party_size: 2,
      notes: "Window seat",
      status: "confirmed",
    });
    const current = {
      ...previous,
      party_size: 4,
      notes: "Updated to patio",
      status: "completed",
    };

    const snapshot = buildBookingAuditSnapshot(previous, current);

    expect(snapshot.previous?.party_size).toBe(2);
    expect(snapshot.current?.party_size).toBe(4);

    const changedFields = snapshot.changes.map((change) => change.field);
    expect(changedFields).toEqual(
      expect.arrayContaining(["party_size", "notes", "status"]),
    );

    const partyChange = snapshot.changes.find((change) => change.field === "party_size");
    expect(partyChange?.before).toBe(2);
    expect(partyChange?.after).toBe(4);
  });

  it("returns empty change list when records are identical", () => {
    const baseline = makeBookingRecord();
    const snapshot = buildBookingAuditSnapshot(baseline, { ...baseline });
    expect(snapshot.changes).toHaveLength(0);
  });
});
