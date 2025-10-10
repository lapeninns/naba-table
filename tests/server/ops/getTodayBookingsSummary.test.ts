import assert from "node:assert/strict";
import test from "node:test";

import type { TodayBookingsSummary } from "../../../server/ops/bookings";

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
  source: string | null;
};

type MockClientOptions = {
  restaurant: RestaurantRow;
  bookings: BookingRow[];
};

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const bookingsModulePromise = import("../../../server/ops/bookings");

function createMockSupabaseClient({ restaurant, bookings }: MockClientOptions) {
  const captured = {
    restaurantIdFilter: null as string | null,
    bookingRestaurantFilter: null as string | null,
    bookingDateFilter: null as string | null,
    order: null as { column: string; params: { ascending: boolean } } | null,
  };

  const client = {
    from(table: string) {
      if (table === "restaurants") {
        return {
          select(_fields?: string) {
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
          select(_fields?: string) {
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

test("getTodayBookingsSummary aggregates bookings respecting timezone and status buckets", async () => {
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
    },
  ];

  const { client, captured } = createMockSupabaseClient({
    restaurant: { id: "rest-1", timezone: "America/Los_Angeles" },
    bookings,
  });

  const summary = await getTodayBookingsSummary("rest-1", {
    client,
    referenceDate,
  });

  assert.equal(summary.restaurantId, "rest-1");
  assert.equal(summary.timezone, "America/Los_Angeles");
  assert.equal(summary.date, "2025-03-01");

  assert.equal(captured.restaurantIdFilter, "rest-1");
  assert.equal(captured.bookingRestaurantFilter, "rest-1");
  assert.equal(captured.bookingDateFilter, "2025-03-01");
  assert.deepEqual(captured.order, { column: "start_time", params: { ascending: true } });

  assert.equal(summary.totals.total, 6);
  assert.equal(summary.totals.pending, 2);
  assert.equal(summary.totals.confirmed, 2);
  assert.equal(summary.totals.completed, 1);
  assert.equal(summary.totals.cancelled, 1);
  assert.equal(summary.totals.noShow, 1);
  assert.equal(summary.totals.upcoming, 3);
  assert.equal(summary.totals.covers, 14);

  assert.equal(summary.bookings.length, bookings.length);
  summary.bookings.forEach((booking, index) => {
    assert.equal(booking.id, bookings[index]!.id);
    assert.equal(booking.status, bookings[index]!.status);
    assert.equal(booking.customerEmail, bookings[index]!.customer_email);
    assert.equal(booking.customerPhone, bookings[index]!.customer_phone);
    assert.equal(booking.reference, bookings[index]!.reference);
    assert.deepEqual(booking.details, bookings[index]!.details);
  });
});

test("getTodayBookingsSummary falls back to UTC when restaurant timezone missing", async () => {
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

  assert.equal(summary.timezone, "UTC");
  assert.equal(summary.date, "2025-06-10");
  assert.equal(captured.bookingDateFilter, "2025-06-10");
  assert.equal(summary.totals.total, 1);
  assert.equal(summary.totals.confirmed, 1);
  assert.equal(summary.totals.pending, 0);
  assert.equal(summary.totals.cancelled, 0);
  assert.equal(summary.totals.completed, 0);
  assert.equal(summary.totals.noShow, 0);
  assert.equal(summary.totals.upcoming, 1);
  assert.equal(summary.totals.covers, 2);
});

test("getTodayBookingsSummary respects explicit targetDate override", async () => {
  const { getTodayBookingsSummary } = await bookingsModulePromise;
  const bookings: BookingRow[] = [];

  const targetDate = "2025-12-24";

  const { client, captured } = createMockSupabaseClient({
    restaurant: { id: "rest-explicit", timezone: "Europe/London" },
    bookings,
  });

  const summary = await getTodayBookingsSummary("rest-explicit", {
    client,
    referenceDate: new Date("2025-01-01T00:00:00Z"),
    targetDate,
  });

  assert.equal(summary.date, targetDate);
  assert.equal(captured.bookingDateFilter, targetDate);
  assert.equal(summary.totals.total, 0);
});

test("getBookingsHeatmap aggregates covers and booking counts", async () => {
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

  assert.deepEqual(result["2025-10-01"], { bookings: 2, covers: 4 });
  assert.deepEqual(result["2025-10-02"], { bookings: 2, covers: 5 });
});
