import { describe, expect, it, vi } from "vitest";

import { loadTablesByIds, loadTablesForRestaurant } from "../../../server/capacity/table-assignment/supabase";

import type { DbClient } from "@/server/capacity/table-assignment/types";

// Prevent cache side-effects
vi.mock("@/server/capacity/cache", () => ({
  getInventoryCache: () => null,
  setInventoryCache: vi.fn(),
}));

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

type TableInventoryRow = {
  id: string;
  table_number: string;
  capacity: number;
  min_party_size: number;
  max_party_size: number;
  section: string | null;
  category: string;
  seating_type: string;
  mobility: string;
  zone_id: string;
  status: string;
  active: boolean;
  position: unknown;
  zones?: { active: boolean | null } | null;
};

function createClient(rows: TableInventoryRow[]): DbClient {
  const queryResult = Promise.resolve({ data: rows, error: null });

  const client = {
    from: (table: string) => {
      if (table !== "table_inventory") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: (_col: string, _val: string) => ({
            in: (_col2: string, _vals: string[]) => queryResult,
          }),
        }),
      };
    },
  };

  return client as unknown as DbClient;
}

describe("table assignment inventory filtering", () => {
  const baseRow = {
    id: "table-1",
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

  it("marks tables in inactive zones as inactive for full restaurant load", async () => {
    const rows = [
      { ...baseRow, id: "table-1", zones: { active: true } },
      { ...baseRow, id: "table-2", table_number: "T2", zones: { active: false } },
    ];
    const client = createClient(rows);

    const result = await loadTablesForRestaurant(RESTAURANT_ID, client);

    expect(result.map((t) => t.id)).toEqual(["table-1", "table-2"]);
    const inactive = result.find((t) => t.id === "table-2")!;
    expect(inactive.active).toBe(false);
    expect(inactive.zoneActive).toBe(false);
  });

  it("marks tables in inactive zones when loading by ids", async () => {
    const rows = [
      { ...baseRow, id: "table-1", zones: { active: true } },
      { ...baseRow, id: "table-2", table_number: "T2", zones: { active: false } },
    ];
    const client = createClient(rows);

    const result = await loadTablesByIds(RESTAURANT_ID, ["table-1", "table-2"], client);

    expect(result.map((t) => t.id)).toEqual(["table-1", "table-2"]);
    const inactive = result.find((t) => t.id === "table-2")!;
    expect(inactive.active).toBe(false);
    expect(inactive.zoneActive).toBe(false);
  });

  it("marks individual inactive tables even when zone is active", async () => {
    const rows = [
      { ...baseRow, id: "table-1", zones: { active: true }, active: false },
    ];

    const client = createClient(rows);

    const result = await loadTablesForRestaurant(RESTAURANT_ID, client);

    expect(result).toHaveLength(1);
    expect(result[0]!.active).toBe(false);
    expect(result[0]!.zoneActive).toBe(true);
  });
});
