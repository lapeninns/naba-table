import { describe, expect, it, vi } from "vitest";

import { getVenuePolicy } from "@/server/capacity/policy";
import {
  calculateCapacityForTables,
  calculateRestaurantCapacityByService,
} from "@/server/capacity/rotations";

import type { Tables } from "@/types/supabase";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => {
    throw new Error("Supabase client should be injected in unit tests");
  },
}));

type TableRow = Pick<
  Tables<"table_inventory">,
  "id" | "table_number" | "capacity" | "min_party_size" | "max_party_size" | "status"
>;

const baseTables: TableRow[] = [
  {
    id: "2-top-1",
    table_number: "T1",
    capacity: 2,
    min_party_size: 2,
    max_party_size: 2,
    status: "available",
  },
  {
    id: "2-top-2",
    table_number: "T2",
    capacity: 2,
    min_party_size: 2,
    max_party_size: 2,
    status: "available",
  },
  {
    id: "2-top-3",
    table_number: "T3",
    capacity: 2,
    min_party_size: 2,
    max_party_size: 2,
    status: "available",
  },
  {
    id: "4-top-1",
    table_number: "T4",
    capacity: 4,
    min_party_size: 2,
    max_party_size: 4,
    status: "available",
  },
  {
    id: "4-top-2",
    table_number: "T5",
    capacity: 4,
    min_party_size: 2,
    max_party_size: 4,
    status: "available",
  },
  {
    id: "4-top-3",
    table_number: "T6",
    capacity: 4,
    min_party_size: 2,
    max_party_size: 4,
    status: "available",
  },
  {
    id: "4-top-4",
    table_number: "T7",
    capacity: 4,
    min_party_size: 2,
    max_party_size: 4,
    status: "available",
  },
  {
    id: "4-top-5",
    table_number: "T8",
    capacity: 4,
    min_party_size: 2,
    max_party_size: 4,
    status: "available",
  },
  {
    id: "7-top-1",
    table_number: "T9",
    capacity: 7,
    min_party_size: 3,
    max_party_size: 7,
    status: "available",
  },
  {
    id: "7-top-2",
    table_number: "T10",
    capacity: 7,
    min_party_size: 3,
    max_party_size: 7,
    status: "available",
  },
];

describe("table rotation capacity calculations", () => {
  const policy = getVenuePolicy();

  it("calculates lunch and dinner covers for the provided table mix", () => {
    const lunchSummary = calculateCapacityForTables("lunch", baseTables, { policy });
    const dinnerSummary = calculateCapacityForTables("dinner", baseTables, { policy });

    expect(lunchSummary).toMatchObject({
      service: "lunch",
      serviceMinutes: 180,
      totalCovers: 80,
    });

    expect(dinnerSummary).toMatchObject({
      service: "dinner",
      serviceMinutes: 300,
      totalCovers: 126,
    });

    const twoTopDinner = dinnerSummary?.tables.filter((table) => table.capacity === 2) ?? [];
    expect(twoTopDinner.every((table) => table.rotations === 4)).toBe(true);

    const fourTopDinner = dinnerSummary?.tables.filter((table) => table.capacity === 4) ?? [];
    expect(fourTopDinner.every((table) => table.rotations === 3)).toBe(true);

    const sevenTopDinner = dinnerSummary?.tables.filter((table) => table.capacity === 7) ?? [];
    expect(sevenTopDinner.every((table) => table.rotations === 3)).toBe(true);
  });

  it("excludes tables that are marked out of service", () => {
    const tables: TableRow[] = [
      ...baseTables,
      {
        id: "out",
        table_number: "B1",
        capacity: 4,
        min_party_size: 2,
        max_party_size: 4,
        status: "out_of_service",
      },
    ];

    const summary = calculateCapacityForTables("dinner", tables, { policy });
    expect(summary?.totalCovers).toBe(126);
    expect(summary?.tables.find((table) => table.tableId === "out")).toBeUndefined();
  });

  it("returns service order summaries when fetching from the database façade", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: baseTables,
              error: null,
            }),
        }),
      }),
    } as any;

    const summaries = await calculateRestaurantCapacityByService({
      restaurantId: "demo",
      client: supabase,
      referenceDate: "2025-10-18",
    });

    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.service).toBe("lunch");
    expect(summaries[1]?.service).toBe("dinner");
    expect(summaries.map((summary) => summary?.totalCovers)).toEqual([80, 126]);
  });
});
