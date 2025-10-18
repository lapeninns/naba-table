import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from() {
      throw new Error("Unexpected Supabase call in bookings summary tests");
    },
  }),
}));

import type { TodayBookingsSummary } from "@/server/ops/bookings";

type RestaurantRow = {
  id: string;
  timezone: string | null;
};

type BookingRow = {
  id: string;
  status: TodayBookingsSummary["bookings"][number]["status"];
  start_time: string | null;
  end_time: string | null;
  party_size: number;
  customer_name: string;
  notes: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  reference: string | null;
  details: TodayBookingsSummary["bookings"][number]["details"];
  source?: string | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  booking_table_assignments?: {
    table_id: string | null;
    table_inventory?: {
      table_number: string | null;
      capacity: number | null;
      section: string | null;
    } | null;
  }[];
};

type MockClientOptions = {
  restaurant: RestaurantRow;
  bookings: BookingRow[];
};

const bookingsModulePromise = import("@/server/ops/bookings");

type CapturedFilters = {
  restaurantIdFilter: string | null;
  bookingRestaurantFilter: string | null;
  bookingDateFilter: string | null;
  order: { column: string; params: { ascending: boolean } } | null;
};

function createMockSupabaseClient({ restaurant, bookings }: MockClientOptions) {
  const captured: CapturedFilters = {
    restaurantIdFilter: null,
    bookingRestaurantFilter: null,
    bookingDateFilter: null,
    order: null,
  };

  const client = {
    from(table: string) {
      if (table === "restaurants") {
        return {
          select() {
            return {
              eq(_column: string, value: string) {
                captured.restaurantIdFilter = value;
                return {
                  async maybeSingle() {
                    return { data: restaurant, error: null as unknown };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "bookings") {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                if (column === "restaurant_id") {
                  captured.bookingRestaurantFilter = value;
                  return {
                    eq(nextColumn: string, nextValue: string) {
                      if (nextColumn === "booking_date") {
                        captured.bookingDateFilter = nextValue;
                      }
                      return {
                        order(orderColumn: string, params: { ascending: boolean }) {
                          captured.order = { column: orderColumn, params };
                          return Promise.resolve({ data: bookings, error: null as unknown });
                        },
                      };
                    },
                  };
                }

                if (column === "booking_date") {
                  captured.bookingDateFilter = value;
                  return {
                    eq(nextColumn: string, nextValue: string) {
                      if (nextColumn === "restaurant_id") {
                        captured.bookingRestaurantFilter = nextValue;
                      }
                      return {
                        order(orderColumn: string, params: { ascending: boolean }) {
                          captured.order = { column: orderColumn, params };
                          return Promise.resolve({ data: bookings, error: null as unknown });
                        },
                      };
                    },
                  };
                }

                throw new Error(`Unexpected filter column: ${column}`);
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client: client as unknown as any, captured };
}

describe("getTodayBookingsSummary", () => {
  it("aggregates bookings respecting timezone and status buckets", async () => {
    const { getTodayBookingsSummary } = await bookingsModulePromise;
    const referenceDate = new Date("2025-03-02T02:30:00Z"); // 18:30 on 2025-03-01 in America/Los_Angeles

    const bookings: BookingRow[] = [
      {
        id: "b-1",
        status: "confirmed",
        start_time: "17:00",
        end_time: "18:30",
        party_size: 2,
        customer_name: "Alex Reid",
        notes: "Window seat",
        customer_email: "alex@example.com",
        customer_phone: "+447700900001",
        reference: "REF-001",
        details: { source: "online" },
        source: "web",
        checked_in_at: null,
        checked_out_at: null,
        booking_table_assignments: [
          {
            table_id: "table-1",
            table_inventory: {
              table_number: "A1",
              capacity: 2,
              section: "Window",
            },
          },
        ],
      },
      {
        id: "b-2",
        status: "completed",
        start_time: "19:00",
        end_time: "20:30",
        party_size: 5,
        customer_name: "Sasha Lee",
        notes: null,
        customer_email: "sasha@example.com",
        customer_phone: "+447700900002",
        reference: "REF-002",
        details: null,
        source: "web",
        checked_in_at: "2025-03-01T19:05:00.000Z",
        checked_out_at: null,
        booking_table_assignments: [
          {
            table_id: "table-2",
            table_inventory: {
              table_number: "B4",
              capacity: 6,
              section: "Main",
            },
          },
        ],
      },
      {
        id: "b-3",
        status: "pending",
        start_time: "16:30",
        end_time: null,
        party_size: 3,
        customer_name: "Taylor Fox",
        notes: null,
        customer_email: null,
        customer_phone: null,
        reference: null,
        details: null,
        source: "api",
        checked_in_at: null,
        checked_out_at: null,
      },
      {
        id: "b-4",
        status: "pending_allocation",
        start_time: "20:15",
        end_time: null,
        party_size: 4,
        customer_name: "Robin Singh",
        notes: null,
        customer_email: null,
        customer_phone: null,
        reference: null,
        details: null,
        source: "api",
        checked_in_at: null,
        checked_out_at: null,
      },
      {
        id: "b-5",
        status: "cancelled",
        start_time: "18:45",
        end_time: null,
        party_size: 6,
        customer_name: "Jamie Y.",
        notes: "Change of plans",
        customer_email: "jamie@example.com",
        customer_phone: "+447700900005",
        reference: "REF-005",
        details: { reason: "personal" },
        source: "web",
        checked_in_at: null,
        checked_out_at: null,
      },
      {
        id: "b-6",
        status: "no_show",
        start_time: null,
        end_time: null,
        party_size: 2,
        customer_name: "Morgan L.",
        notes: null,
        customer_email: "morgan@example.com",
        customer_phone: "+447700900006",
        reference: "REF-006",
        details: null,
        source: "web",
        checked_in_at: null,
        checked_out_at: null,
      },
    ];

    const { client, captured } = createMockSupabaseClient({
      restaurant: {
        id: "restaurant-123",
        timezone: "America/Los_Angeles",
      },
      bookings,
    });

    const summary = await getTodayBookingsSummary("restaurant-123", {
      client,
      referenceDate,
    });

    expect(captured.restaurantIdFilter).toBe("restaurant-123");
    expect(captured.bookingRestaurantFilter).toBe("restaurant-123");
    expect(captured.bookingDateFilter).toBe("2025-03-01");
    expect(captured.order).toEqual({ column: "start_time", params: { ascending: true } });

    expect(summary.totals.total).toBe(6);
    expect(summary.totals.confirmed).toBe(2); // includes confirmed + completed
    expect(summary.totals.pending).toBe(2);
    expect(summary.totals.completed).toBe(1);
    expect(summary.totals.cancelled).toBe(1);
    expect(summary.totals.noShow).toBe(1);
    expect(summary.totals.upcoming).toBe(3);
    expect(summary.totals.covers).toBe(14);

    const firstBooking = summary.bookings.find((booking) => booking.id === 'b-1');
    expect(firstBooking?.tableAssignments).toEqual([
      expect.objectContaining({
        tableId: 'table-1',
        tableNumber: 'A1',
        capacity: 2,
        section: 'Window',
      }),
    ]);
    expect(firstBooking?.requiresTableAssignment).toBe(false);

    const completedBooking = summary.bookings.find((booking) => booking.id === 'b-2');
    expect(completedBooking?.checkedInAt).toBe('2025-03-01T19:05:00.000Z');
    expect(completedBooking?.checkedOutAt).toBeNull();

    const pendingAllocation = summary.bookings.find((booking) => booking.id === 'b-4');
    expect(pendingAllocation?.tableAssignments).toEqual([]);
    expect(pendingAllocation?.requiresTableAssignment).toBe(true);
  });

  it("falls back to UTC when restaurant timezone missing", async () => {
    const { getTodayBookingsSummary } = await bookingsModulePromise;
    const referenceDate = new Date("2025-06-10T12:00:00Z");

    const bookings: BookingRow[] = [
      {
        id: "b-a",
        status: "confirmed",
        start_time: "11:00",
        end_time: null,
        party_size: 2,
        customer_name: "Jordan P.",
        notes: null,
        customer_email: null,
        customer_phone: null,
        reference: null,
        details: null,
        checked_in_at: null,
        checked_out_at: null,
      },
    ];

    const { client, captured } = createMockSupabaseClient({
      restaurant: { id: "rest-utc", timezone: "" },
      bookings,
    });

    const summary = await getTodayBookingsSummary("rest-utc", {
      client,
      referenceDate,
    });

    expect(summary.timezone).toBe("UTC");
    expect(summary.date).toBe("2025-06-10");
    expect(captured.bookingDateFilter).toBe("2025-06-10");
    expect(summary.totals.total).toBe(1);
    expect(summary.totals.confirmed).toBe(1);
    expect(summary.totals.upcoming).toBe(1);
    expect(summary.totals.covers).toBe(2);
  });

  it("respects explicit targetDate override", async () => {
    const { getTodayBookingsSummary } = await bookingsModulePromise;
    const targetDate = "2025-12-24";

    const { client, captured } = createMockSupabaseClient({
      restaurant: { id: "rest-explicit", timezone: "Europe/London" },
      bookings: [],
    });

    const summary = await getTodayBookingsSummary("rest-explicit", {
      client,
      referenceDate: new Date("2025-01-01T00:00:00Z"),
      targetDate,
    });

    expect(summary.date).toBe(targetDate);
    expect(captured.bookingDateFilter).toBe(targetDate);
    expect(summary.totals.total).toBe(0);
  });
});

describe("getBookingsHeatmap", () => {
  it("aggregates covers and booking counts", async () => {
    const { getBookingsHeatmap } = await bookingsModulePromise;

    const mockData = [
      { booking_date: "2025-10-01", party_size: 4, status: "confirmed" },
      { booking_date: "2025-10-01", party_size: 2, status: "cancelled" },
      { booking_date: "2025-10-02", party_size: 5, status: "completed" },
      { booking_date: "2025-10-02", party_size: 3, status: "no_show" },
    ];

    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: async () => ({
                data: mockData,
                error: null as unknown,
              }),
            }),
          }),
        }),
      }),
    } as any;

    const result = await getBookingsHeatmap("rest-heat", {
      client,
      startDate: "2025-10-01",
      endDate: "2025-10-31",
    });

    expect(result["2025-10-01"]).toEqual({ bookings: 2, covers: 4 });
    expect(result["2025-10-02"]).toEqual({ bookings: 2, covers: 5 });
  });
});
