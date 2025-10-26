import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualSelectionOptions, ManualHoldOptions } from "@/server/capacity/tables";

const BASE_BOOKING = {
  id: "booking-1",
  restaurant_id: "restaurant-1",
  booking_date: "2025-01-01",
  start_time: "18:00",
  end_time: "20:00",
  start_at: "2025-01-01T18:00:00.000Z",
  end_at: "2025-01-01T20:00:00.000Z",
  party_size: 4,
  status: "confirmed",
};

const TABLE_A = {
  id: "table-a",
  table_number: "T1",
  capacity: 4,
  min_party_size: 1,
  max_party_size: 4,
  section: null,
  category: "dining",
  seating_type: "standard",
  mobility: "movable",
  zone_id: "zone-1",
  status: "available",
  active: true,
  position: null,
};

const TABLE_B_FIXED = {
  id: "table-b",
  table_number: "T2",
  capacity: 4,
  min_party_size: 1,
  max_party_size: 4,
  section: null,
  category: "dining",
  seating_type: "standard",
  mobility: "fixed",
  zone_id: "zone-1",
  status: "available",
  active: true,
  position: null,
};

type ManualSupabaseFixture = {
  booking?: Record<string, unknown> | null;
  tables?: Record<string, unknown>[];
  contextBookings?: Record<string, unknown>[];
  adjacency?: { table_a: string; table_b: string }[];
  restaurantTimezone?: string;
};

let evaluateManualSelection: typeof import("@/server/capacity/tables")['evaluateManualSelection'];
let createManualHold: typeof import("@/server/capacity/tables")['createManualHold'];
let holdsModule: typeof import("@/server/capacity/holds");

beforeAll(async () => {
  process.env.BASE_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  ({ evaluateManualSelection, createManualHold } = await import("@/server/capacity/tables"));
  holdsModule = await import("@/server/capacity/holds");
});

function createMockSupabaseClient(fixtures: ManualSupabaseFixture) {
  return {
    from(table: string) {
      switch (table) {
        case "bookings": {
          return {
            select(columns: string) {
              if (columns === "restaurant_id") {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: fixtures.booking ?? BASE_BOOKING, error: null }),
                    };
                  },
                };
              }

              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: fixtures.booking ?? BASE_BOOKING, error: null }),
                    eq() {
                      return {
                        order() {
                          return Promise.resolve({ data: fixtures.contextBookings ?? [], error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        case "table_inventory": {
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return Promise.resolve({ data: fixtures.tables ?? [TABLE_A], error: null });
                    },
                  };
                },
              };
            },
          };
        }
        case "restaurants": {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { timezone: fixtures.restaurantTimezone ?? "UTC" },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }
        case "table_adjacencies": {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({ data: fixtures.adjacency ?? [], error: null });
                },
              };
            },
          };
        }
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  } as unknown as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createManualHold", () => {
  it("creates hold when validation passes", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A],
      contextBookings: [],
      adjacency: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);
    vi.spyOn(holdsModule, "listActiveHoldsForBooking").mockResolvedValue([]);
    vi.spyOn(holdsModule, "releaseTableHold").mockResolvedValue();
    vi.spyOn(holdsModule, "createTableHold").mockResolvedValue({
      id: "hold-new",
      bookingId: BASE_BOOKING.id,
      restaurantId: BASE_BOOKING.restaurant_id,
      zoneId: TABLE_A.zone_id,
      startAt: "2025-01-01T18:00:00.000Z",
      endAt: "2025-01-01T20:00:00.000Z",
      expiresAt: "2025-01-01T18:03:00.000Z",
      tableIds: [TABLE_A.id],
    });

    const result = await createManualHold({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      createdBy: "user-1",
      client,
    } satisfies ManualHoldOptions);

    expect(result.hold).not.toBeNull();
    expect(result.validation.ok).toBe(true);
    expect(result.validation.summary.partySize).toBe(BASE_BOOKING.party_size);
  });

  it("returns validation failure without creating hold", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A, { ...TABLE_A, id: "table-x", zone_id: "zone-2", table_number: "X" }],
      contextBookings: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);
    const createSpy = vi.spyOn(holdsModule, "createTableHold");
    vi.spyOn(holdsModule, "listActiveHoldsForBooking").mockResolvedValue([]);

    const result = await createManualHold({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id, "table-x"],
      createdBy: "user-1",
      client,
    } satisfies ManualHoldOptions);

    expect(result.hold).toBeNull();
    expect(result.validation.ok).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("allows only one concurrent hold when conflicts arise", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A],
      contextBookings: [],
      adjacency: [],
    });

    let callCount = 0;
    vi.spyOn(holdsModule, "findHoldConflicts").mockImplementation(async () => {
      callCount += 1;
      return callCount > 1
        ? [
            {
              holdId: "existing-hold",
              bookingId: "other",
              tableIds: [TABLE_A.id],
              startAt: "2025-01-01T18:00:00.000Z",
              endAt: "2025-01-01T20:00:00.000Z",
              expiresAt: "2025-01-01T18:03:00.000Z",
            },
          ]
        : [];
    });
    vi.spyOn(holdsModule, "listActiveHoldsForBooking").mockResolvedValue([]);
    vi.spyOn(holdsModule, "releaseTableHold").mockResolvedValue();
    vi.spyOn(holdsModule, "createTableHold").mockResolvedValue({
      id: "hold-1",
      bookingId: BASE_BOOKING.id,
      restaurantId: BASE_BOOKING.restaurant_id,
      zoneId: TABLE_A.zone_id,
      startAt: "2025-01-01T18:00:00.000Z",
      endAt: "2025-01-01T20:00:00.000Z",
      expiresAt: "2025-01-01T18:03:00.000Z",
      tableIds: [TABLE_A.id],
    });

    const options: ManualHoldOptions = {
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      createdBy: "user-1",
      client,
    };

    const [first, second] = await Promise.all([
      createManualHold(options),
      createManualHold(options),
    ]);

    expect(first.hold || second.hold).not.toBeNull();
    expect(first.validation.ok || second.validation.ok).toBe(true);
    expect(first.validation.ok && second.validation.ok).toBe(false);
  });
});

describe("evaluateManualSelection", () => {
  it("returns ok when selection satisfies all rules", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A],
      contextBookings: [],
      adjacency: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      client,
    } satisfies ManualSelectionOptions);

    expect(result.ok).toBe(true);
    expect(result.summary.tableCount).toBe(1);
    expect(result.summary.partySize).toBe(BASE_BOOKING.party_size);
    expect(result.checks.every((check) => check.status === "ok")).toBe(true);
  });

  it("flags mobility error for merged fixed tables", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A, TABLE_B_FIXED],
      contextBookings: [],
      adjacency: [
        { table_a: TABLE_A.id, table_b: TABLE_B_FIXED.id },
        { table_a: TABLE_B_FIXED.id, table_b: TABLE_A.id },
      ],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id, TABLE_B_FIXED.id],
      client,
    } satisfies ManualSelectionOptions);

    const mobilityCheck = result.checks.find((check) => check.id === "movable");
    expect(mobilityCheck?.status).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("errors when adjacency required and tables disconnected", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A, { ...TABLE_B_FIXED, mobility: "movable" }],
      contextBookings: [],
      adjacency: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id, TABLE_B_FIXED.id],
      requireAdjacency: true,
      client,
    } satisfies ManualSelectionOptions);

    const adjacencyCheck = result.checks.find((check) => check.id === "adjacency");
    expect(adjacencyCheck?.status).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("detects assignment conflict when schedule overlaps", async () => {
    const contextBooking = {
      id: "booking-2",
      party_size: 2,
      status: "confirmed",
      start_time: "18:00",
      end_time: "20:00",
      start_at: "2025-01-01T18:00:00.000Z",
      booking_date: "2025-01-01",
      seating_preference: null,
      booking_table_assignments: [{ table_id: TABLE_A.id }],
    };

    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A],
      contextBookings: [contextBooking],
      adjacency: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      client,
    } satisfies ManualSelectionOptions);

    const conflictCheck = result.checks.find((check) => check.id === "conflict");
    expect(conflictCheck?.status).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("detects hold conflict", async () => {
    const client = createMockSupabaseClient({
      booking: BASE_BOOKING,
      tables: [TABLE_A],
      contextBookings: [],
      adjacency: [],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([
      {
        holdId: "hold-1",
        bookingId: "other-booking",
        tableIds: [TABLE_A.id],
        startAt: "2025-01-01T18:00:00.000Z",
        endAt: "2025-01-01T20:00:00.000Z",
        expiresAt: "2025-01-01T18:03:00.000Z",
      },
    ]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      client,
    } satisfies ManualSelectionOptions);

    const conflictCheck = result.checks.find((check) => check.id === "conflict");
    expect(conflictCheck?.status).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("flags capacity shortfall", async () => {
    const client = createMockSupabaseClient({
      booking: { ...BASE_BOOKING, party_size: 10 },
      tables: [TABLE_A],
    });

    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);

    const result = await evaluateManualSelection({
      bookingId: BASE_BOOKING.id,
      tableIds: [TABLE_A.id],
      client,
    } satisfies ManualSelectionOptions);

    const capacityCheck = result.checks.find((check) => check.id === "capacity");
    expect(capacityCheck?.status).toBe("error");
    expect(result.ok).toBe(false);
  });
});

describe("manual selection invariants", () => {
  it("flags conflicts under random schedules", async () => {
    const tables = [TABLE_A];
    vi.spyOn(holdsModule, "findHoldConflicts").mockResolvedValue([]);
    vi.spyOn(holdsModule, "listActiveHoldsForBooking").mockResolvedValue([]);

    for (let i = 0; i < 100; i++) {
      const overlap = Math.random() < 0.6; // bias towards overlap scenarios
      const startTime = overlap ? '18:00' : '13:00';
      const endTime = overlap ? '20:00' : '14:30';
      const client = createMockSupabaseClient({
        booking: BASE_BOOKING,
        tables,
        contextBookings: [
          {
            id: `other-${i}`,
            party_size: 2,
            status: 'confirmed',
            start_time: startTime,
            end_time: endTime,
            start_at: `2025-01-01T${startTime}:00.000Z` ,
            end_at: `2025-01-01T${endTime}:00.000Z`,
            booking_date: '2025-01-01',
            booking_table_assignments: [{ table_id: TABLE_A.id }],
          },
        ],
      });

      const result = await evaluateManualSelection({
        bookingId: BASE_BOOKING.id,
        tableIds: [TABLE_A.id],
        client,
      } satisfies ManualSelectionOptions);

      const conflictCheck = result.checks.find((check) => check.id === 'conflict');
      expect(conflictCheck).toBeDefined();
      if (overlap) {
        expect(conflictCheck?.status).toBe('error');
      } else {
        expect(conflictCheck?.status).not.toBe('error');
      }
    }
  });
});
