import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let getManualAssignmentContext: typeof import("@/server/capacity/tables")["getManualAssignmentContext"];
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let featureFlags: typeof import("@/server/feature-flags");

const BOOKING_ID = "booking-1";
const RESTAURANT_ID = "restaurant-1";
const TABLE_ID = "table-a";

beforeAll(async () => {
  Object.assign(process.env, {
    BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  });

  ({ getManualAssignmentContext } = await import("@/server/capacity/tables"));
  featureFlags = await import("@/server/feature-flags");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE_BOOKING = {
  id: BOOKING_ID,
  restaurant_id: RESTAURANT_ID,
  booking_date: "2025-01-01",
  start_time: "18:00",
  end_time: "20:00",
  start_at: "2025-01-01T18:00:00.000Z",
  end_at: "2025-01-01T20:00:00.000Z",
  party_size: 4,
  status: "confirmed",
};

function createSupabaseClient() {
  const fixtures = {
    booking: BASE_BOOKING,
    tables: [
      {
        id: TABLE_ID,
        table_number: "A1",
        capacity: 4,
        min_party_size: 1,
        max_party_size: 4,
        section: "Main",
        category: "dining",
        seating_type: "standard",
        mobility: "movable",
        zone_id: "zone-1",
        status: "available",
        active: true,
        position: { x: 10, y: 20 },
      },
    ],
    contextBookings: [
      {
        id: "other-booking",
        party_size: 2,
        status: "confirmed",
        start_time: "18:00",
        end_time: "19:30",
        start_at: "2025-01-01T18:00:00.000Z",
        end_at: "2025-01-01T19:30:00.000Z",
        booking_date: "2025-01-01",
        booking_table_assignments: [{ table_id: TABLE_ID }],
      },
    ],
    bookingAssignments: [{ table_id: TABLE_ID }],
    tableHolds: [
      {
        id: "hold-current",
        booking_id: BOOKING_ID,
        restaurant_id: RESTAURANT_ID,
        zone_id: "zone-1",
        start_at: "2025-01-01T18:00:00.000Z",
        end_at: "2025-01-01T20:00:00.000Z",
        expires_at: "2025-01-01T18:05:00.000Z",
        created_by: "user-1",
        metadata: {
          selection: {
            tableIds: [TABLE_ID],
            summary: {
              tableCount: 1,
              totalCapacity: 4,
              slack: 0,
              zoneId: "zone-1",
              tableNumbers: ["A1"],
              partySize: 4,
            },
          },
        },
        table_hold_members: [{ table_id: TABLE_ID }],
      },
      {
        id: "hold-other",
        booking_id: "booking-2",
        restaurant_id: RESTAURANT_ID,
        zone_id: "zone-1",
        start_at: "2025-01-01T21:00:00.000Z",
        end_at: "2025-01-01T22:00:00.000Z",
        expires_at: "2025-01-01T21:05:00.000Z",
        created_by: "user-2",
        metadata: null,
        table_hold_members: [{ table_id: TABLE_ID }],
      },
    ],
    profiles: [
      { id: "user-1", name: "Alice Ops", email: "alice@example.com" },
      { id: "user-2", name: "Bob Ops", email: "bob@example.com" },
    ],
  } as const;

  return {
    from(table: string) {
      switch (table) {
        case "bookings": {
          return {
            select(columns: string) {
              if (columns.includes("booking_table_assignments")) {
                const filters: {
                  eq: Record<string, unknown>;
                  statusIn?: string[];
                } = { eq: {} };

                const builder = {
                  eq(column: string, value: unknown) {
                    filters.eq[column] = value;
                    return builder;
                  },
                  in(column: string, values: unknown[]) {
                    if (column === "status" && Array.isArray(values)) {
                      filters.statusIn = values.map((entry) => String(entry));
                    }
                    return builder;
                  },
                  order() {
                    const data = fixtures.contextBookings.filter((booking) => {
                      const matchesEq = Object.entries(filters.eq).every(([key, value]) => {
                        if (!(key in booking) || booking[key] === undefined || booking[key] === null) {
                          return true;
                        }
                        return booking[key] === value;
                      });
                      const matchesStatus =
                        !filters.statusIn || filters.statusIn.includes(String(booking.status ?? ""));
                      return matchesEq && matchesStatus;
                    });
                    return Promise.resolve({ data, error: null });
                  },
                };

                return builder;
              }
              if (columns.includes("restaurant_id")) {
                if (columns.includes("booking_date")) {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({ data: fixtures.booking, error: null }),
                      };
                    },
                  };
                }
                if (columns.trim() === "restaurant_id") {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({ data: { restaurant_id: RESTAURANT_ID }, error: null }),
                      };
                    },
                  };
                }
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: fixtures.booking, error: null }),
                    };
                  },
                };
              }
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: fixtures.booking, error: null }),
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
                      return Promise.resolve({ data: fixtures.tables, error: null });
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
                    maybeSingle: async () => ({ data: { timezone: "UTC" }, error: null }),
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
 
                  return Promise.resolve({ data: [], error: null });
                },
              };
            },
          };
        }
        case "booking_table_assignments": {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({ data: fixtures.bookingAssignments, error: null });
                },
              };
            },
          };
        }
        case "table_holds": {
          return {
            select() {
              return {
                eq() {
                  return {
                    gt() {
                      return {
                        lt() {
                          return {
                            gt() {
                              return Promise.resolve({ data: fixtures.tableHolds, error: null });
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        case "profiles": {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({ data: fixtures.profiles, error: null });
                },
              };
            },
          };
        }
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as any;
}

describe('getManualAssignmentContext', () => {
  it('returns tables, holds, conflicts, and metadata for booking', async () => {
    const client = createSupabaseClient();

    const context = await getManualAssignmentContext({ bookingId: BOOKING_ID, client });

    expect(context.booking.id).toBe(BOOKING_ID);
    expect(context.bookingAssignments).toEqual([TABLE_ID]);
    expect(context.activeHold).not.toBeNull();
    expect(context.activeHold?.createdByName).toBe('Alice Ops');
    expect(context.holds).toHaveLength(2);
    expect(context.conflicts.some((conflict) => conflict.tableId === TABLE_ID)).toBe(true);
    expect(context.window.startAt).toBeTruthy();
  });

  it('skips holds hydration when holds feature flag is disabled', async () => {
    const client = createSupabaseClient();
    const holdsSpy = vi.spyOn(featureFlags, "isHoldsEnabled").mockReturnValue(false);

    const context = await getManualAssignmentContext({ bookingId: BOOKING_ID, client });

    expect(holdsSpy).toHaveBeenCalled();
    expect(context.holds).toEqual([]);
    expect(context.activeHold).toBeNull();
  });

  it('gracefully handles missing table_holds relation', async () => {
    const baseClient = createSupabaseClient();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = {
      from(table: string) {
        if (table === "table_holds") {
          return {
            select() {
              return {
                eq() {
                  return {
                    gt() {
                      return {
                        lt() {
                          return {
                            gt() {
                              return Promise.resolve({
                                data: null,
                                error: {
                                  code: "42P01",
                                  message: "relation \"public.table_holds\" does not exist",
                                  details: null,
                                  hint: null,
                                },
                              });
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (baseClient as any).from(table);
      },
    } as typeof baseClient;

    const context = await getManualAssignmentContext({ bookingId: BOOKING_ID, client });

    expect(context.holds).toEqual([]);
    expect(context.activeHold).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[capacity][manual][context] holds table unavailable; skipping hold hydration",
      expect.objectContaining({ bookingId: BOOKING_ID }),
    );
  });
});
