import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/ops/capacity-cache", () => ({
  invalidateRestaurantCapacityCaches: vi.fn(),
}));

import { invalidateRestaurantCapacityCaches } from "@/server/ops/capacity-cache";
import { insertTable, updateTable, deleteTable } from "@/server/ops/tables";
import { createZone, updateZone, deleteZone } from "@/server/ops/zones";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const mockInvalidate = vi.mocked(invalidateRestaurantCapacityCaches);

const BASE_TABLE = {
  id: "table-1",
  restaurant_id: "rest-1",
  table_number: "T1",
  capacity: 4,
  min_party_size: 1,
  max_party_size: 4,
  section: null,
  status: "available",
  position: null,
  notes: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  zone_id: "zone-1",
  category: "dining",
  seating_type: "standard",
  mobility: "movable",
  active: true,
};

const BASE_ZONE = {
  id: "zone-1",
  restaurant_id: "rest-1",
  name: "Main",
  sort_order: 1,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

function createInsertTableClient(result = BASE_TABLE): SupabaseClient<Database, "public", Database["public"]> {
  return {
    from(table: string) {
      expect(table).toBe("table_inventory");
      return {
        insert() {
          return {
            select() {
              return {
                single: async () => ({ data: result, error: null }),
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database, "public", Database["public"]>;
}

function createUpdateTableClient(result = BASE_TABLE): SupabaseClient<Database, "public", Database["public"]> {
  return {
    from(table: string) {
      expect(table).toBe("table_inventory");
      return {
        update() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: result, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database, "public", Database["public"]>;
}

function createDeleteTableClient(restaurantId = "rest-1"): SupabaseClient<Database, "public", Database["public"]> {
  return {
    from(table: string) {
      expect(table).toBe("table_inventory");
      return {
        delete() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: { restaurant_id: restaurantId }, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database, "public", Database["public"]>;
}

function createZoneClient(result = BASE_ZONE): SupabaseClient<Database, "public", Database["public"]> {
  return {
    from(table: string) {
      expect(table).toBe("zones");
      return {
        insert() {
          return {
            select() {
              return {
                single: async () => ({ data: result, error: null }),
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: result, error: null }),
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: result, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database, "public", Database["public"]>;
}

beforeEach(() => {
  mockInvalidate.mockReset();
});

describe("capacity cache invalidation", () => {
  it("invalidates after table insert/update/delete", async () => {
    await insertTable(createInsertTableClient(), {
      restaurant_id: "rest-1",
      table_number: "T1",
      capacity: 4,
      min_party_size: 1,
      zone_id: "zone-1",
      category: "dining",
      seating_type: "standard",
      mobility: "movable",
      active: true,
    });
    await updateTable(createUpdateTableClient(), "table-1", { notes: "Updated" });
    await deleteTable(createDeleteTableClient(), "table-1");

    expect(mockInvalidate).toHaveBeenCalledTimes(3);
    expect(mockInvalidate).toHaveBeenCalledWith("rest-1");
  });

  it("invalidates after zone mutations", async () => {
    await createZone(createZoneClient(), { restaurantId: "rest-1", name: "Patio" });
    await updateZone(createZoneClient(), "zone-1", { name: "New" });
    await deleteZone(createZoneClient(), "zone-1");

    expect(mockInvalidate).toHaveBeenCalledTimes(3);
    expect(mockInvalidate).toHaveBeenCalledWith("rest-1");
  });
});
