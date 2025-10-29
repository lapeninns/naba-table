import type { Tables } from "@/types/supabase";

export type TableRow = {
  id: string;
  table_number: string;
  capacity: number;
  min_party_size: number;
  max_party_size: number | null;
  section: string | null;
  category?: "bar" | "dining" | "lounge" | "patio" | "private";
  seating_type?: "standard" | "sofa" | "booth" | "high_top";
  mobility?: "movable" | "fixed";
  zone_id?: string;
  status: string;
  active?: boolean;
  position?: Record<string, unknown> | null;
};

export type BookingRow = {
  id: string;
  party_size: number;
  status: Tables<"bookings">["status"];
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  booking_date: string | null;
  seating_preference: string | null;
  booking_table_assignments: { table_id: string | null }[] | null;
  restaurant_id?: string | null;
};

export type MockClientOptions = {
  tables: TableRow[];
  bookings: BookingRow[];
  adjacency?: { table_a: string; table_b: string }[];
  timezone?: string;
  holds?: Array<{
    id: string;
    restaurantId: string;
    tableIds: string[];
    startAt: string;
    endAt: string;
    expiresAt: string;
    zoneId?: string | null;
    bookingId?: string | null;
  }>;
};

export type AssignmentLogEntry = {
  bookingId: string;
  tableIds: string[];
  startAt: string | null;
  endAt: string | null;
};

export function createMockSupabaseClient(options: MockClientOptions) {
  const assignments: AssignmentLogEntry[] = [];
  const adjacencyRows = options.adjacency ?? [];
  const tableRows = options.tables.map((table) => ({
    category: "dining" as const,
    seating_type: "standard" as const,
    mobility: "movable" as const,
    zone_id: "zone-main",
    active: true,
    ...table,
  }));
  const holdsRows =
    options.holds?.map((hold) => ({
      id: hold.id,
      booking_id: hold.bookingId ?? null,
      restaurant_id: hold.restaurantId,
      zone_id: hold.zoneId ?? "zone-main",
      start_at: hold.startAt,
      end_at: hold.endAt,
      expires_at: hold.expiresAt,
      created_by: null,
      metadata: null,
      table_hold_members: hold.tableIds.map((tableId) => ({ table_id: tableId })),
    })) ?? [];

  type HoldsResult = { data: typeof holdsRows; error: null };

  const client = {
    from(table: string) {
      if (table === "table_inventory") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({ data: tableRows, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "table_adjacencies") {
        return {
          select() {
            return {
              in(column: string, ids: string[]) {
                if (column !== "table_a") {
                  return Promise.resolve({ data: [], error: null });
                }
                const data = adjacencyRows.filter((row) => ids.includes(row.table_a));
                return Promise.resolve({ data, error: null });
              },
            };
          },
        };
      }

      if (table === "table_holds") {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          gt() {
            return builder;
          },
          lt() {
            return builder;
          },
          then<TResult1 = HoldsResult, TResult2 = never>(
            onFulfilled?: ((value: HoldsResult) => TResult1 | PromiseLike<TResult1>) | null,
            onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) {
            return Promise.resolve<HoldsResult>({ data: holdsRows, error: null }).then(onFulfilled, onRejected);
          },
          catch<TResult = never>(
            onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
          ) {
            return Promise.resolve<HoldsResult>({ data: holdsRows, error: null }).catch(onRejected);
          },
          finally(onFinally?: (() => void) | null) {
            return Promise.resolve<HoldsResult>({ data: holdsRows, error: null }).finally(onFinally ?? undefined);
          },
        };
        return builder;
      }

      if (table === "bookings") {
        const filters: {
          eq: Record<string, unknown>;
          statusIn?: string[];
        } = { eq: {} };

        const selectBuilder = {
          eq(column: string, value: unknown) {
            filters.eq[column] = value;
            return selectBuilder;
          },
          in(column: string, values: unknown[]) {
            if (column === "status" && Array.isArray(values)) {
              filters.statusIn = values.map((entry) => String(entry));
            }
            return selectBuilder;
          },
          order() {
            const filtered = options.bookings.filter((booking) => {
              const matchRestaurant =
                filters.eq.restaurant_id === undefined ||
                booking.restaurant_id === filters.eq.restaurant_id ||
                booking.restaurant_id === undefined ||
                booking.restaurant_id === null;
              const matchDate =
                filters.eq.booking_date === undefined || booking.booking_date === filters.eq.booking_date;
              const matchStatus =
                !filters.statusIn || filters.statusIn.includes((booking.status ?? "").toString());
              return matchRestaurant && matchDate && matchStatus;
            });
            return Promise.resolve({ data: filtered, error: null });
          },
        };

        return {
          select() {
            return selectBuilder;
          },
        };
      }

      if (table === "restaurants") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({
                      data: { timezone: options.timezone ?? "Europe/London" },
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "booking_table_assignments") {
        return {
          select() {
            return {
              eq() {
                return {
                  in(_: string, tableIds: string[]) {
                    const active = assignments[assignments.length - 1];
                    const rows = tableIds.map((tableId) => ({
                      table_id: tableId,
                      id: `${active?.bookingId ?? "booking"}-${tableId}`,
                    }));
                    return Promise.resolve({ data: rows, error: null });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    rpc(name: string, args: Record<string, unknown>) {
      if (name === "assign_tables_atomic_v2") {
        assignments.push({
          bookingId: args.p_booking_id as string,
          tableIds: Array.isArray(args.p_table_ids) ? [...(args.p_table_ids as string[])] : [],
          startAt: typeof args.p_start_at === "string" ? args.p_start_at : null,
          endAt: typeof args.p_end_at === "string" ? args.p_end_at : null,
        });
        const data = (Array.isArray(args.p_table_ids) ? args.p_table_ids : []).map((tableId: string) => ({
          table_id: tableId,
          start_at: "2025-01-01T18:00:00.000Z",
          end_at: "2025-01-01T20:00:00.000Z",
          merge_group_id: null,
        }));
        return Promise.resolve({ data, error: null });
      }

      if (name === "unassign_tables_atomic") {
        const bookingId = args.p_booking_id as string;
        const tableIdsParam = Array.isArray(args.p_table_ids)
          ? (args.p_table_ids as string[])
          : args.p_table_id
            ? [args.p_table_id as string]
            : [];

        tableIdsParam.forEach((target) => {
          assignments.forEach((entry) => {
            if (entry.bookingId === bookingId) {
              entry.tableIds = entry.tableIds.filter((tableId) => tableId !== target);
            }
          });
        });

        const data = tableIdsParam.map((tableId) => ({ table_id: tableId }));
        return Promise.resolve({ data, error: null });
      }

      return Promise.resolve({ data: null, error: null });
    },
  } as const;

  return { client, assignments };
}
