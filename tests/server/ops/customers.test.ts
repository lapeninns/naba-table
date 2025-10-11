import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: vi.fn(() => {
    throw new Error("Unexpected service client usage in tests");
  }),
}));

const customersModule = await import("@/server/ops/customers");
const { getCustomersWithProfiles, getAllCustomersWithProfiles } = customersModule;

type CustomerWithProfile = (typeof customersModule)["CustomerWithProfile"];

type RawCustomerRow = {
  id: string;
  restaurant_id: string;
  full_name: string;
  email: string;
  phone: string;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
  customer_profiles:
    | {
        first_booking_at: string | null;
        last_booking_at: string | null;
        total_bookings: number;
        total_covers: number;
        total_cancellations: number;
      }[]
    | null;
};

const RESTAURANT_ID = "2a7c8efa-1c93-4f91-a419-6a7d7b048fea";

type RangeHandler<T> = (from: number, to: number) => Promise<{ data: T[]; count: number; error: null }>;

function createSupabaseClient<T>(rows: T[], rangeHandler?: RangeHandler<T>) {
  const rangeMock = vi.fn(async (from: number, to: number) => {
    if (rangeHandler) {
      return rangeHandler(from, to);
    }
    const slice = rows.slice(from, to + 1);
    return { data: slice, count: rows.length, error: null };
  });

  return {
    from: (table: string) => {
      if (table !== "customers") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: rangeMock,
            })),
          })),
        })),
      };
    },
    __rangeMock: rangeMock,
  } as unknown as any;
}

const rawRow = (overrides: Partial<RawCustomerRow> = {}, profileOverrides: Partial<RawCustomerRow["customer_profiles"][number]> = {}): RawCustomerRow => ({
  id: crypto.randomUUID(),
  restaurant_id: RESTAURANT_ID,
  full_name: overrides.full_name ?? "Guest",
  email: overrides.email ?? "guest@example.com",
  phone: overrides.phone ?? "+10000000000",
  marketing_opt_in: overrides.marketing_opt_in ?? false,
  created_at: overrides.created_at ?? new Date().toISOString(),
  updated_at: overrides.updated_at ?? new Date().toISOString(),
  customer_profiles:
    overrides.customer_profiles ?? [
      {
        first_booking_at: profileOverrides.first_booking_at ?? null,
        last_booking_at: profileOverrides.last_booking_at ?? null,
        total_bookings: profileOverrides.total_bookings ?? 0,
        total_covers: profileOverrides.total_covers ?? 0,
        total_cancellations: profileOverrides.total_cancellations ?? 0,
      },
    ],
});

describe("getCustomersWithProfiles", () => {
  it("returns mapped customer records with pagination metadata", async () => {
    const rows: RawCustomerRow[] = [
      rawRow({ id: "cust-1" }, { total_bookings: 3, total_covers: 6 }),
      rawRow({ id: "cust-2" }, { total_bookings: 1, total_covers: 2 }),
    ];

    const client = createSupabaseClient(rows);

    const result = await getCustomersWithProfiles({
      restaurantId: RESTAURANT_ID,
      page: 1,
      pageSize: 10,
      client,
    });

    expect(result.customers).toHaveLength(2);
    expect(
      result.customers.some(
        (customer: CustomerWithProfile) => customer.totalBookings === 3 && customer.totalCovers === 6,
      ),
    ).toBe(true);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.hasNext).toBe(false);
  });

  it("caps the requested page size at the provided maxPageSize", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => rawRow({ id: `cust-${index}` }));
    const client = createSupabaseClient(rows);

    await getCustomersWithProfiles({
      restaurantId: RESTAURANT_ID,
      page: 1,
      pageSize: 100,
      maxPageSize: 3,
      client,
    });

    const rangeCall = (client as any).__rangeMock.mock.calls[0];
    expect(rangeCall[0]).toBe(0);
    expect(rangeCall[1]).toBe(2);
  });
});

describe("getAllCustomersWithProfiles", () => {
  it("iterates through result pages until no data remains", async () => {
    const rows: RawCustomerRow[] = Array.from({ length: 7 }, (_, index) =>
      rawRow({ id: `cust-${index}`, full_name: `Guest ${index}`, email: `guest${index}@example.com` }, {
        total_bookings: index,
        total_covers: index * 2,
      }),
    );

    const pageSize = 3;

    const client = createSupabaseClient(rows, async (from, to) => {
      const slice = rows.slice(from, to + 1);
      return { data: slice, count: rows.length, error: null };
    });

    const result = await getAllCustomersWithProfiles({
      restaurantId: RESTAURANT_ID,
      client,
      batchSize: pageSize,
    });

    expect(result).toHaveLength(rows.length);
    expect((client as any).__rangeMock).toHaveBeenCalledTimes(Math.ceil(rows.length / pageSize));
  });
});
