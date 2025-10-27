process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/feature-flags", () => ({
  isSelectorScoringEnabled: () => true,
  isCombinationPlannerEnabled: () => true,
  isOpsMetricsEnabled: () => true,
  isAllocatorAdjacencyRequired: () => true,
  getAllocatorKMax: () => 3,
  isHoldsEnabled: () => false,
}));

vi.mock("@/server/capacity/holds", async () => {
  const actual = await vi.importActual<typeof import("@/server/capacity/holds")>("@/server/capacity/holds");
  return {
    ...actual,
    createTableHold: vi.fn(),
    findHoldConflicts: vi.fn(),
  };
});

const holdsModule = await import("@/server/capacity/holds");
const featureFlags = await import("@/server/feature-flags");
const telemetry = await import("@/server/capacity/telemetry");
const tablesModule = await import("@/server/capacity/tables");

const { HoldConflictError, createTableHold, findHoldConflicts } = holdsModule;
const { quoteTablesForBooking } = tablesModule;

const createTableHoldMock = createTableHold as unknown as ReturnType<typeof vi.fn>;
const findHoldConflictsMock = findHoldConflicts as unknown as ReturnType<typeof vi.fn>;

let emitSelectorQuoteSpy: ReturnType<typeof vi.spyOn>;
let emitHoldCreatedSpy: ReturnType<typeof vi.spyOn>;
let emitRpcConflictSpy: ReturnType<typeof vi.spyOn>;

function createStubClient() {
  const responses: Record<string, { list?: any[]; single?: any }> = {
    bookings: {
      single: {
        id: "booking-1",
        restaurant_id: "restaurant-1",
        party_size: 7,
        status: "confirmed",
        start_time: "18:00",
        end_time: "19:30",
        start_at: "2025-10-26T18:00:00Z",
        end_at: "2025-10-26T19:35:00Z",
        booking_date: "2025-10-26",
        seating_preference: null,
      },
      list: [],
    },
    table_inventory: {
      list: [
        {
          id: "combo-a",
          table_number: "A1",
          capacity: 4,
          min_party_size: 2,
          max_party_size: 8,
          section: "Main",
          category: "dining",
          seating_type: "standard",
          mobility: "fixed",
          zone_id: "zone-main",
          status: "available",
          active: true,
          position: null,
        },
        {
          id: "combo-b",
          table_number: "B1",
          capacity: 4,
          min_party_size: 2,
          max_party_size: 8,
          section: "Main",
          category: "dining",
          seating_type: "standard",
          mobility: "fixed",
          zone_id: "zone-main",
          status: "available",
          active: true,
          position: null,
        },
        {
          id: "combo-c",
          table_number: "C1",
          capacity: 4,
          min_party_size: 2,
          max_party_size: 8,
          section: "Main",
          category: "dining",
          seating_type: "standard",
          mobility: "fixed",
          zone_id: "zone-main",
          status: "available",
          active: true,
          position: null,
        },
        {
          id: "combo-d",
          table_number: "D1",
          capacity: 4,
          min_party_size: 2,
          max_party_size: 8,
          section: "Main",
          category: "dining",
          seating_type: "standard",
          mobility: "fixed",
          zone_id: "zone-main",
          status: "available",
          active: true,
          position: null,
        },
      ],
    },
    restaurants: {
      single: { timezone: "Europe/London" },
    },
    table_adjacencies: {
      list: [
        { table_a: "combo-a", table_b: "combo-b" },
        { table_a: "combo-b", table_b: "combo-a" },
        { table_a: "combo-b", table_b: "combo-c" },
        { table_a: "combo-c", table_b: "combo-b" },
        { table_a: "combo-c", table_b: "combo-d" },
        { table_a: "combo-d", table_b: "combo-c" },
      ],
    },
    table_holds: {
      list: [],
    },
  };

  return {
    from(table: string) {
      const dataset = responses[table] ?? { list: [], single: null };
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return Promise.resolve({ data: dataset.list ?? [], error: null });
        },
        order() {
          return Promise.resolve({ data: dataset.list ?? [], error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: dataset.single ?? null, error: null });
        },
      } as any;
      return builder;
    },
  } as any;
}

describe("quoteTablesForBooking - hold conflicts", () => {
  beforeEach(() => {
    createTableHoldMock.mockReset();
    findHoldConflictsMock.mockReset();
    emitSelectorQuoteSpy = vi.spyOn(telemetry, "emitSelectorQuote").mockResolvedValue();
    emitHoldCreatedSpy = vi.spyOn(telemetry, "emitHoldCreated").mockResolvedValue();
    emitRpcConflictSpy = vi.spyOn(telemetry, "emitRpcConflict").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns alternates with friendly reason when primary plan conflicts", async () => {
    const conflict = {
      holdId: "hold-existing",
      bookingId: "booking-2",
      tableIds: ["combo-a", "combo-b"],
      startAt: "2025-10-26T18:00:00Z",
      endAt: "2025-10-26T19:35:00Z",
      expiresAt: "2025-10-26T18:10:00Z",
    } satisfies HoldConflictInfo;

    createTableHoldMock
      .mockImplementationOnce(() => {
        throw new HoldConflictError("Tables already on hold", conflict.holdId ?? undefined);
      })
      .mockResolvedValueOnce({
        id: "hold-new",
        bookingId: "booking-1",
        restaurantId: "restaurant-1",
        zoneId: "zone-main",
        tableIds: ["combo-c", "combo-d"],
        startAt: "2025-10-26T18:00:00Z",
        endAt: "2025-10-26T19:35:00Z",
        expiresAt: "2025-10-26T18:10:00Z",
      });

    findHoldConflictsMock.mockResolvedValue([conflict]);

    const result = await quoteTablesForBooking({
      bookingId: "booking-1",
      client: createStubClient(),
    });

    expect(createTableHoldMock).toHaveBeenCalledTimes(2);
    expect(findHoldConflictsMock).toHaveBeenCalledTimes(1);
    expect(result.hold?.id).toBe("hold-new");
    expect(result.reason).toBeUndefined();
    expect(emitSelectorQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: "hold-new" }),
    );
    expect(emitRpcConflictSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: "create_hold_conflict" }),
    );
  });
});
