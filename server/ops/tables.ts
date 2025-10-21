import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/supabase";

type PublicClient = SupabaseClient<Database, "public", any>;

export type TableRow = Tables<"table_inventory">;
export type ZoneRow = Pick<Tables<"zones">, "id" | "name">;
export type TableRecord = TableRow & {
  zone?: ZoneRow | null;
};
type RawTableRecord = TableRow & {
  zone?: ZoneRow | ZoneRow[] | null;
};

export type TableListFilters = {
  section?: string | null;
  status?: TableRow["status"] | null;
  zoneId?: string | null;
};

export type TableSummary = {
  totalTables: number;
  totalCapacity: number;
  availableTables: number;
  zones: ZoneRow[];
};

function normalizeZone(zone: RawTableRecord["zone"]): ZoneRow | null {
  if (!zone) {
    return null;
  }

  const normalized = Array.isArray(zone) ? zone[0] : zone;

  if (!normalized) {
    return null;
  }

  return {
    id: normalized.id,
    name: normalized.name,
  };
}

function toTableRecord(row: RawTableRecord): TableRecord {
  const { zone, ...table } = row;
  const tableColumns: TableRow = table;

  return {
    ...tableColumns,
    zone: normalizeZone(zone),
  };
}

const TABLE_SELECT = `
  id,
  restaurant_id,
  table_number,
  capacity,
  min_party_size,
  max_party_size,
  section,
  status,
  position,
  notes,
  created_at,
  updated_at,
  zone_id,
  category,
  seating_type,
  mobility,
  active,
  zone:zones (
    id,
    name
  )
`;

function computeSummary(tables: TableRecord[], zones: ZoneRow[]): TableSummary {
  const totalTables = tables.length;
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const availableTables = tables.filter((table) => table.status === "available").length;
  return {
    totalTables,
    totalCapacity,
    availableTables,
    zones,
  };
}

export async function listTablesWithSummary(
  client: PublicClient,
  restaurantId: string,
  filters: TableListFilters = {},
): Promise<{ tables: TableRecord[]; summary: TableSummary }> {
  let tableQuery = client
    .from("table_inventory")
    .select(TABLE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (filters.section) {
    tableQuery = tableQuery.eq("section", filters.section);
  }
  if (filters.status) {
    tableQuery = tableQuery.eq("status", filters.status);
  }
  if (filters.zoneId) {
    tableQuery = tableQuery.eq("zone_id", filters.zoneId);
  }

  const zonesQuery = client
    .from("zones")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const [tablesResult, zonesResult] = await Promise.all([tableQuery, zonesQuery]);

  if (tablesResult.error) {
    throw tablesResult.error;
  }

  if (zonesResult.error) {
    throw zonesResult.error;
  }

  const tables = ((tablesResult.data ?? []) as RawTableRecord[]).map(toTableRecord);
  const zones = (zonesResult.data ?? []).map((zone) => ({
    id: zone.id,
    name: zone.name,
  })) as ZoneRow[];

  return {
    tables,
    summary: computeSummary(tables, zones),
  };
}

export async function loadAllowedCapacities(client: PublicClient, restaurantId: string): Promise<number[]> {
  const { data, error } = await client
    .from("allowed_capacities")
    .select("capacity")
    .eq("restaurant_id", restaurantId)
    .order("capacity", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => Number(row.capacity))
    .filter((value) => Number.isFinite(value));
}

export async function ensureAllowedCapacity(
  client: PublicClient,
  restaurantId: string,
  capacity: number,
): Promise<void> {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return;
  }

  const { error } = await client
    .from("allowed_capacities")
    .upsert(
      {
        restaurant_id: restaurantId,
        capacity,
      },
      { onConflict: "restaurant_id,capacity", ignoreDuplicates: true },
    );

  if (error) {
    throw error;
  }
}

export async function findTableByNumber(
  client: PublicClient,
  restaurantId: string,
  tableNumber: string,
): Promise<TableRow | null> {
  const { data, error } = await client
    .from("table_inventory")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchTableById(client: PublicClient, tableId: string): Promise<TableRow | null> {
  const { data, error } = await client.from("table_inventory").select("*").eq("id", tableId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function insertTable(
  client: PublicClient,
  payload: TablesInsert<"table_inventory">,
): Promise<TableRecord> {
  const { data, error } = await client
    .from("table_inventory")
    .insert(payload)
    .select(TABLE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return toTableRecord(data as RawTableRecord);
}

export async function updateTable(
  client: PublicClient,
  tableId: string,
  payload: TablesUpdate<"table_inventory">,
): Promise<TableRecord> {
  const { data, error } = await client
    .from("table_inventory")
    .update(payload)
    .eq("id", tableId)
    .select(TABLE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return toTableRecord(data as RawTableRecord);
}

export async function deleteTable(client: PublicClient, tableId: string): Promise<void> {
  const { error } = await client.from("table_inventory").delete().eq("id", tableId);
  if (error) {
    throw error;
  }
}
