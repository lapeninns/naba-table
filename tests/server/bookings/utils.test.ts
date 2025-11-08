process.env.BASE_URL ??= "http://localhost:3000";

import { describe, expect, it, vi } from "vitest";

import {
  buildBookingAuditSnapshot,
  clearBookingTableAssignments,
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

describe("clearBookingTableAssignments", () => {
  const bookingId = "booking-123";

  function createMockClient(rows: Array<{ table_id: string | null }>, rpcError: Error | null = null) {
    const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: rpcError });

    return {
      from,
      rpc,
    } as unknown as Parameters<typeof clearBookingTableAssignments>[0];
  }

  it("invokes unassign RPC when booking has tables", async () => {
    const client = createMockClient([{ table_id: "tbl_a" }, { table_id: "tbl_b" }]);

    const released = await clearBookingTableAssignments(client, bookingId);

    expect(released).toBe(2);
    expect(client.from).toHaveBeenCalledWith("booking_table_assignments");
    expect(client.rpc).toHaveBeenCalledWith("unassign_tables_atomic", {
      p_booking_id: bookingId,
      p_table_ids: ["tbl_a", "tbl_b"],
    });
  });

  it("skips RPC when no assignments exist", async () => {
    const client = createMockClient([]);

    const released = await clearBookingTableAssignments(client, bookingId);

    expect(released).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("swallows RPC failures and logs a warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = createMockClient([{ table_id: "tbl_only" }], new Error("rpc failed"));

    const released = await clearBookingTableAssignments(client, bookingId);

    expect(released).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
