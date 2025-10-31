import { computeScarcityScore, deriveTableType, clearScarcityCache } from "@/server/capacity/scarcity";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Table } from "@/server/capacity/tables";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

type TableInventoryRow = {
  id: string;
  restaurant_id: string | null;
  capacity: number | null;
  category: string | null;
  seating_type: string | null;
  status: string | null;
  active: boolean | null;
  zone_id: string | null;
};

function isTableActive(row: TableInventoryRow): boolean {
  if (row.active === false) {
    return false;
  }
  const status = (row.status ?? "available").toString().toLowerCase();
  return status !== "out_of_service";
}

export async function recomputeTableScarcityMetrics(params?: {
  restaurantId?: string;
  client?: DbClient;
  now?: string;
}): Promise<{ restaurantsProcessed: number; upserted: number; deleted: number }> {
  const client = params?.client ?? getServiceSupabaseClient();
  const nowIso = params?.now ?? new Date().toISOString();

  let query = client
    .from("table_inventory")
    .select("id, restaurant_id, capacity, category, seating_type, status, active, zone_id");

  if (params?.restaurantId) {
    query = query.eq("restaurant_id", params.restaurantId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[table-scarcity] failed to load table inventory: ${error.message}`);
  }

  const tables = (data as TableInventoryRow[] | null) ?? [];

  const tablesByRestaurant = new Map<string, TableInventoryRow[]>();
  for (const row of tables) {
    if (!row.restaurant_id || !isTableActive(row)) {
      continue;
    }
    if (!tablesByRestaurant.has(row.restaurant_id)) {
      tablesByRestaurant.set(row.restaurant_id, []);
    }
    tablesByRestaurant.get(row.restaurant_id)!.push(row);
  }

  if (tablesByRestaurant.size === 0) {
    return { restaurantsProcessed: 0, upserted: 0, deleted: 0 };
  }

  let totalUpserts = 0;
  let totalDeleted = 0;

  for (const [restaurantId, rows] of tablesByRestaurant.entries()) {
    const countsByType = new Map<string, number>();
    for (const row of rows) {
      const tableLike: Table = {
        id: row.id,
        tableNumber: row.id,
        capacity: row.capacity ?? 0,
        zoneId: row.zone_id ?? "unknown",
        section: null,
        category: row.category,
        seatingType: row.seating_type,
        mobility: null,
        status: row.status,
        active: row.active,
        minPartySize: null,
        maxPartySize: null,
        position: null,
      };
      const tableType = deriveTableType(tableLike);
      countsByType.set(tableType, (countsByType.get(tableType) ?? 0) + 1);
    }

    const records = Array.from(countsByType.entries()).map(([tableType, count]) => ({
      restaurant_id: restaurantId,
      table_type: tableType,
      scarcity_score: computeScarcityScore(count),
      computed_at: nowIso,
    }));

    if (records.length > 0) {
      const { error: upsertError } = await client
        .from("table_scarcity_metrics")
        .upsert(records, { onConflict: "restaurant_id,table_type" });
      if (upsertError) {
        throw new Error(`[table-scarcity] upsert failed for restaurant ${restaurantId}: ${upsertError.message}`);
      }
      totalUpserts += records.length;
    }

    const { data: existingRows, error: existingError } = await client
      .from("table_scarcity_metrics")
      .select("table_type")
      .eq("restaurant_id", restaurantId);

    if (!existingError && Array.isArray(existingRows)) {
      const existingTypes = new Set<string>(existingRows.map((row) => row.table_type).filter(Boolean));
      const currentTypes = new Set<string>(countsByType.keys());
      const toDelete: string[] = [];
      for (const type of existingTypes) {
        if (!currentTypes.has(type)) {
          toDelete.push(type);
        }
      }
      if (toDelete.length > 0) {
        const { error: deleteError } = await client
          .from("table_scarcity_metrics")
          .delete()
          .eq("restaurant_id", restaurantId)
          .in("table_type", toDelete);
        if (deleteError) {
          throw new Error(`[table-scarcity] delete failed for restaurant ${restaurantId}: ${deleteError.message}`);
        }
        totalDeleted += toDelete.length;
      }
    }
  }

  clearScarcityCache();

  return {
    restaurantsProcessed: tablesByRestaurant.size,
    upserted: totalUpserts,
    deleted: totalDeleted,
  };
}
