process.env.BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HoldConflictInfo } from "@/server/capacity/holds";
import type * as FeatureFlags from "@/server/feature-flags";

const isCombinationPlannerEnabledMock = vi.fn(() => true);

vi.mock("@/server/feature-flags", async () => {
  const actual = await vi.importActual<typeof FeatureFlags>("@/server/feature-flags");
  return {
    ...actual,
    isCombinationPlannerEnabled: isCombinationPlannerEnabledMock,
    isHoldsEnabled: () => false,
  };
});

vi.mock("@/server/capacity/holds", async () => {
  const actual = await vi.importActual("@/server/capacity/holds");
  return {
    ...actual,
    createTableHold: vi.fn(),
    findHoldConflicts: vi.fn(),
    releaseTableHold: vi.fn(),
  };
});

const holdsModule = await import("@/server/capacity/holds");
const telemetry = await import("@/server/capacity/telemetry");
const tablesModule = await import("@/server/capacity/tables");
const featureFlagsModule = await import("@/server/feature-flags");

const { createTableHold, findHoldConflicts, releaseTableHold, HoldConflictError } = holdsModule;
const { quoteTablesForBooking } = tablesModule;

const createTableHoldMock = vi.mocked(createTableHold);
const findHoldConflictsMock = vi.mocked(findHoldConflicts);
const releaseTableHoldMock = vi.mocked(releaseTableHold);

let emitSelectorQuoteSpy: ReturnType<typeof vi.spyOn>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let emitHoldCreatedSpy: ReturnType<typeof vi.spyOn>;
let emitRpcConflictSpy: ReturnType<typeof vi.spyOn>;
let emitHoldStrictConflictSpy: ReturnType<typeof vi.spyOn>;

type Dataset = {
  list?: unknown[];
  single?: unknown;
};

type QueryBuilder<TList = unknown, TSingle = unknown> = {
  select(): QueryBuilder<TList, TSingle>;
  eq(): QueryBuilder<TList, TSingle>;
  in(): QueryBuilder<TList, TSingle>;
  order(): QueryBuilder<TList, TSingle>;
  limit(): QueryBuilder<TList, TSingle>;
  is(): QueryBuilder<TList, TSingle>;
  maybeSingle(): Promise<{ data: TSingle | null; error: null }>;
  then<TResult1 = { data: TList[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: TList[]; error: null }) => TResult1 | Promise<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | Promise<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | Promise<TResult>) | null,
  ): Promise<{ data: TList[]; error: null } | TResult>;
};

type SupabaseMock = {
  from(table: string): QueryBuilder;
};

function createStubClient(): SupabaseMock {
  const responses: Record<string, Dataset> = {
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

  const createBuilder = <TList = unknown, TSingle = unknown>(dataset: Dataset): QueryBuilder<TList, TSingle> => {
    const listResult = { data: (dataset.list ?? []) as TList[], error: null } as const;
    const builder: QueryBuilder<TList, TSingle> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      is: () => builder,
      maybeSingle: () => Promise.resolve({ data: (dataset.single ?? null) as TSingle | null, error: null }),
      then: (onfulfilled, onrejected) => Promise.resolve(listResult).then(onfulfilled, onrejected),
      catch: (onrejected) => Promise.resolve(listResult).catch(onrejected ?? undefined),
    };
    return builder;
  };

  return {
    from(table: string): QueryBuilder {
      const dataset = responses[table] ?? { list: [], single: null };
      return createBuilder(dataset);
    },
  };
}

describe("quoteTablesForBooking - hold conflicts", () => {
  beforeEach(() => {
    createTableHoldMock.mockReset();
    findHoldConflictsMock.mockReset();
    releaseTableHoldMock.mockReset();
    emitSelectorQuoteSpy = vi.spyOn(telemetry, "emitSelectorQuote").mockResolvedValue();
    emitHoldCreatedSpy = vi.spyOn(telemetry, "emitHoldCreated").mockResolvedValue();
    emitRpcConflictSpy = vi.spyOn(telemetry, "emitRpcConflict").mockResolvedValue();
    emitHoldStrictConflictSpy = vi.spyOn(telemetry, "emitHoldStrictConflict").mockResolvedValue();
    isCombinationPlannerEnabledMock.mockReturnValue(true);
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

    createTableHoldMock.mockResolvedValue({
      id: "hold-new",
      bookingId: "booking-1",
      restaurantId: "restaurant-1",
      zoneId: "zone-main",
      tableIds: ["combo-c", "combo-d"],
      startAt: "2025-10-26T18:00:00Z",
      endAt: "2025-10-26T19:35:00Z",
      expiresAt: "2025-10-26T18:10:00Z",
    });

    findHoldConflictsMock
      .mockResolvedValueOnce([conflict])
      .mockResolvedValue([]);

    const result = await quoteTablesForBooking({
      bookingId: "booking-1",
      client: createStubClient(),
    });

    expect(createTableHoldMock).toHaveBeenCalledTimes(1);
    expect(findHoldConflictsMock).toHaveBeenCalledTimes(2);
    expect(result.hold?.id).toBe("hold-new");
    expect(result.reason).toBeUndefined();
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: expect.stringContaining("Conflicts with holds"),
        }),
      ]),
    );
    expect(result.metadata).toEqual({ usedFallback: false, fallbackService: null });
    expect(emitSelectorQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: "hold-new" }),
    );
    expect(emitRpcConflictSpy).not.toHaveBeenCalled();
  });

  it("skips candidate when strict conflict validation detects a persisted overlap", async () => {
    const strictFlagSpy = vi.spyOn(featureFlagsModule, "isHoldStrictConflictsEnabled").mockReturnValue(true);

    const holdRecord = {
      id: "hold-new",
      bookingId: "booking-1",
      restaurantId: "restaurant-1",
      zoneId: "zone-main",
      tableIds: ["combo-a", "combo-b"],
      startAt: "2025-10-26T18:00:00Z",
      endAt: "2025-10-26T19:35:00Z",
      expiresAt: "2025-10-26T18:10:00Z",
    };

    createTableHoldMock.mockResolvedValue(holdRecord);
    findHoldConflictsMock.mockImplementation(({ excludeHoldId }) => {
      if (excludeHoldId) {
        return Promise.resolve([
          {
            holdId: "existing-hold",
            bookingId: "booking-2",
            tableIds: ["combo-a", "combo-b"],
            startAt: "2025-10-26T18:00:00Z",
            endAt: "2025-10-26T19:35:00Z",
            expiresAt: "2025-10-26T18:15:00Z",
          },
        ]);
      }
      return Promise.resolve([]);
    });
    releaseTableHoldMock.mockResolvedValue();

    const result = await quoteTablesForBooking({
      bookingId: "booking-1",
      client: createStubClient(),
    });

    expect(result.hold).toBeNull();
    expect(result.reason).toBe("Hold conflicts prevented all candidates");
    expect(releaseTableHoldMock).toHaveBeenCalledWith(
      expect.objectContaining({ holdId: "hold-new" }),
    );
    expect(emitHoldStrictConflictSpy).toHaveBeenCalled();
    expect(emitHoldStrictConflictSpy.mock.calls[0]?.[0]).toMatchObject({
      bookingId: "booking-1",
    });
    expect(
      emitHoldStrictConflictSpy.mock.calls[0]?.[0]?.conflicts,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ holdId: "existing-hold" }),
      ]),
    );
    expect(findHoldConflictsMock).toHaveBeenCalled();
    expect(strictFlagSpy).toHaveBeenCalled();
  });

  it("permits only one hold across concurrent requests with strict conflicts enabled", async () => {
    const strictFlagSpy = vi.spyOn(featureFlagsModule, "isHoldStrictConflictsEnabled").mockReturnValue(true);

    createTableHoldMock
      .mockResolvedValueOnce({
        id: "hold-success",
        bookingId: "booking-1",
        restaurantId: "restaurant-1",
        zoneId: "zone-main",
        tableIds: ["combo-a", "combo-b"],
        startAt: "2025-10-26T18:00:00Z",
        endAt: "2025-10-26T19:35:00Z",
        expiresAt: "2025-10-26T18:10:00Z",
      })
      .mockRejectedValueOnce(new HoldConflictError("conflict"));

    findHoldConflictsMock.mockResolvedValue([]);

    const client = createStubClient();
    const runQuote = () =>
      quoteTablesForBooking({
        bookingId: "booking-1",
        client,
      });

    const [first, second] = await Promise.all([runQuote(), runQuote()]);

    const successes = [first, second].filter((result) => result.hold);
    const failures = [first, second].filter((result) => !result.hold);

    expect(successes).toHaveLength(1);
    expect(successes[0]?.hold?.id).toBe("hold-success");
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toBe("Hold conflicts prevented all candidates");
    expect(createTableHoldMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(strictFlagSpy).toHaveBeenCalled();
  });

  it("reports skip reason when combination planner is disabled", async () => {
    isCombinationPlannerEnabledMock.mockReturnValue(false);

    createTableHoldMock.mockResolvedValue({
      id: "hold-should-not-be-created",
    });

    const client = createStubClient();

    const result = await quoteTablesForBooking({
      bookingId: "booking-1",
      createdBy: "user-1",
      client,
    });

    expect(result.hold).toBeNull();
    expect(result.reason).toContain("No tables meet the capacity requirements");
    expect(emitSelectorQuoteSpy).not.toHaveBeenCalled();
    expect(createTableHoldMock).not.toHaveBeenCalled();
  });
});
