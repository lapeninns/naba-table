import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/capacity/selector", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    buildScoredTablePlans: vi.fn().mockReturnValue({
      plans: [],
      fallbackReason: undefined,
      diagnostics: {
        singlesConsidered: 0,
        combinationsEnumerated: 0,
        combinationsAccepted: 0,
        skipped: Object.create(null) as Record<string, number>,
        limits: {
          kMax: 1,
          maxPlansPerSlack: 50,
          maxCombinationEvaluations: 500,
        },
      },
    }),
  };
});

const tablesModule = await import("@/server/capacity/tables");
const policyModule = await import("@/server/capacity/policy");

const { findSuitableTables } = tablesModule;

function createSupabaseStub(options: {
  booking: Record<string, unknown>;
  tables: Record<string, unknown>[];
  restaurantTimezone?: string | null;
}) {
  const restaurantsMaybeSingle = vi.fn(async () => ({
    data: options.restaurantTimezone ? { timezone: options.restaurantTimezone } : null,
    error: null,
  }));

  const client = {
    from(table: string) {
      switch (table) {
        case "bookings":
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: options.booking, error: null }),
                  };
                },
              };
            },
          };
        case "table_inventory":
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return Promise.resolve({ data: options.tables, error: null });
                    },
                  };
                },
              };
            },
          };
        case "table_adjacencies":
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        case "restaurants":
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: restaurantsMaybeSingle,
                  };
                },
              };
            },
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
  } as const;

  return { client, restaurantsMaybeSingle };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("findSuitableTables timezone handling", () => {
  it("uses booking-linked timezone without hitting restaurant lookup", async () => {
    const policySpy = vi.spyOn(policyModule, "getVenuePolicy");
    const { client: supabase, restaurantsMaybeSingle } = createSupabaseStub({
      booking: {
        id: "booking-1",
        restaurant_id: "r-1",
        booking_date: "2025-01-01",
        start_time: "18:00",
        end_time: "19:30",
        start_at: "2025-01-01T18:00:00.000Z",
        end_at: "2025-01-01T19:30:00.000Z",
        party_size: 2,
        restaurants: [{ timezone: "America/New_York" }],
      },
      tables: [
        {
          id: "t-1",
          table_number: "1",
          capacity: 2,
          min_party_size: null,
          max_party_size: null,
          section: null,
          category: null,
          seating_type: null,
          mobility: null,
          zone_id: "zone-1",
          status: "active",
          active: true,
          position: null,
        },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(findSuitableTables({ bookingId: "booking-1", client: supabase as any })).resolves.toEqual([]);

    expect(policySpy).toHaveBeenCalled();
    expect(restaurantsMaybeSingle).not.toHaveBeenCalled();
    const callArgs = policySpy.mock.calls.map((args) => args[0]);
    expect(callArgs.some((arg) => arg && "timezone" in arg && arg?.timezone === "America/New_York")).toBe(true);
  });

  it("falls back to restaurant timezone lookup when booking lacks timezone", async () => {
    const policySpy = vi.spyOn(policyModule, "getVenuePolicy");
    const { client: supabase, restaurantsMaybeSingle } = createSupabaseStub({
      booking: {
        id: "booking-2",
        restaurant_id: "r-2",
        booking_date: "2025-01-02",
        start_time: "18:00",
        end_time: "19:00",
        start_at: "2025-01-02T18:00:00.000Z",
        end_at: "2025-01-02T19:00:00.000Z",
        party_size: 2,
        restaurants: null,
      },
      tables: [
        {
          id: "t-10",
          table_number: "10",
          capacity: 2,
          min_party_size: null,
          max_party_size: null,
          section: null,
          category: null,
          seating_type: null,
          mobility: null,
          zone_id: "zone-1",
          status: "active",
          active: true,
          position: null,
        },
      ],
      restaurantTimezone: "Europe/Paris",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(findSuitableTables({ bookingId: "booking-2", client: supabase as any })).resolves.toEqual([]);

    expect(restaurantsMaybeSingle).toHaveBeenCalled();

    const policyArgs = policySpy.mock.calls.map((args) => args[0]);
    expect(policyArgs.some((arg) => arg && "timezone" in arg && arg?.timezone === "Europe/Paris")).toBe(true);
  });
});
