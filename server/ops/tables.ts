import { invalidateRestaurantCapacityCaches } from "@/server/ops/capacity-cache";

import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


type PublicClient = SupabaseClient<Database>;

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

const SERVICE_CAPACITY_KEYS = ["lunch", "dinner"] as const;
type ServiceCapacityKey = (typeof SERVICE_CAPACITY_KEYS)[number];

const SERVICE_LABELS: Record<ServiceCapacityKey, string> = {
  lunch: "Lunch service",
  dinner: "Dinner service",
};

type ServiceWindowMinutes = {
  key: ServiceCapacityKey;
  minutes: number;
};

type RestaurantTimingConfig = {
  turnMinutes: number;
  intervalMinutes: number | null;
};

type ServicePolicyRow = {
  lunch_start: string | null;
  lunch_end: string | null;
  dinner_start: string | null;
  dinner_end: string | null;
  clean_buffer_minutes: number | null;
};

type ServicePeriodRow = {
  booking_option: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type ServiceCapacitySummary = {
  key: ServiceCapacityKey;
  label: string;
  capacity: number;
  tablesConsidered: number;
  turnsPerTable: number;
  seatsPerTurn: number;
  assumptions: {
    windowMinutes: number;
    turnMinutes: number;
    bufferMinutes: number;
    intervalMinutes: number | null;
  };
};

export type TableSummary = {
  totalTables: number;
  totalCapacity: number;
  availableTables: number;
  zones: ZoneRow[];
  serviceCapacities: ServiceCapacitySummary[];
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

function toMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  const seconds = match[3] ? Number.parseInt(match[3]!, 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }
  return hours * 60 + minutes + Math.floor(seconds / 60);
}

function windowMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }
  const diff = endMinutes - startMinutes;
  return diff > 0 ? diff : null;
}

function aggregateServiceWindows(periods: ServicePeriodRow[]): ServiceWindowMinutes[] {
  const grouped = new Map<ServiceCapacityKey, number[]>();
  for (const period of periods) {
    const key = period.booking_option?.toLowerCase() as ServiceCapacityKey | undefined;
    if (!key || !SERVICE_CAPACITY_KEYS.includes(key)) {
      continue;
    }

    const minutes = windowMinutes(period.start_time, period.end_time);
    if (!minutes) {
      continue;
    }

    const list = grouped.get(key) ?? [];
    list.push(minutes);
    grouped.set(key, list);
  }

  return SERVICE_CAPACITY_KEYS.flatMap<ServiceWindowMinutes>((key) => {
    const durations = grouped.get(key);
    if (!durations || durations.length === 0) {
      return [];
    }
    const total = durations.reduce((sum, value) => sum + value, 0);
    const average = Math.floor(total / durations.length);
    return { key, minutes: Math.max(average, 0) };
  });
}

function derivePolicyWindows(policy: ServicePolicyRow | null): ServiceWindowMinutes[] {
  if (!policy) {
    return [];
  }
  const lunch = windowMinutes(policy.lunch_start, policy.lunch_end);
  const dinner = windowMinutes(policy.dinner_start, policy.dinner_end);
  const result: ServiceWindowMinutes[] = [];
  if (lunch && lunch > 0) {
    result.push({ key: "lunch", minutes: lunch });
  }
  if (dinner && dinner > 0) {
    result.push({ key: "dinner", minutes: dinner });
  }
  return result;
}

function resolveServiceWindows(
  periodWindows: ServiceWindowMinutes[],
  policyWindows: ServiceWindowMinutes[],
): Map<ServiceCapacityKey, number> {
  const map = new Map<ServiceCapacityKey, number>();
  for (const { key, minutes } of policyWindows) {
    map.set(key, minutes);
  }
  for (const { key, minutes } of periodWindows) {
    map.set(key, minutes);
  }
  return map;
}

export function turnsPerTableForWindow(
  windowMinutes: number,
  turnMinutes: number,
  bufferMinutes: number,
  intervalMinutes: number | null,
): number {
  if (windowMinutes <= 0 || turnMinutes <= 0) {
    return 0;
  }

  if (windowMinutes < turnMinutes) {
    return 0;
  }

  const buffer = bufferMinutes > 0 ? bufferMinutes : 0;
  const baseTurns = Math.floor((windowMinutes - turnMinutes) / (turnMinutes + buffer)) + 1;

  if (!intervalMinutes || intervalMinutes <= 0) {
    return Math.max(baseTurns, 0);
  }

  if (windowMinutes < turnMinutes) {
    return 0;
  }

  const intervalTurns = Math.floor((windowMinutes - turnMinutes) / intervalMinutes) + 1;
  return Math.max(Math.min(baseTurns, intervalTurns), 0);
}

async function loadRestaurantTimingConfig(
  client: PublicClient,
  restaurantId: string,
): Promise<RestaurantTimingConfig> {
  const { data, error } = await client
    .from("restaurants")
    .select("reservation_default_duration_minutes, reservation_interval_minutes")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const turnMinutes = Number.isFinite(data?.reservation_default_duration_minutes)
    ? Number(data?.reservation_default_duration_minutes)
    : 90;

  const interval = Number.isFinite(data?.reservation_interval_minutes)
    ? Number(data?.reservation_interval_minutes)
    : null;

  return {
    turnMinutes: turnMinutes > 0 ? turnMinutes : 90,
    intervalMinutes: interval && interval > 0 ? interval : null,
  };
}

async function loadServicePolicy(client: PublicClient): Promise<ServicePolicyRow | null> {
  const { data, error } = await client
    .from("service_policy")
    .select("lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function loadServicePeriods(
  client: PublicClient,
  restaurantId: string,
): Promise<ServicePeriodRow[]> {
  const { data, error } = await client
    .from("restaurant_service_periods")
    .select("booking_option, start_time, end_time")
    .eq("restaurant_id", restaurantId)
    .in("booking_option", Array.from(SERVICE_CAPACITY_KEYS));

  if (error) {
    throw error;
  }

  return (data ?? []) as ServicePeriodRow[];
}

async function computeSummary(
  client: PublicClient,
  restaurantId: string,
  tables: TableRecord[],
  zones: ZoneRow[],
): Promise<TableSummary> {
  const totalTables = tables.length;
  const totalCapacity = tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
  const availableTables = tables.filter((table) => table.status === "available").length;

  if (totalTables === 0) {
    return {
      totalTables,
      totalCapacity,
      availableTables,
      zones,
      serviceCapacities: [],
    };
  }

  const eligibleTables = tables.filter(
    (table) => table.active && table.capacity > 0 && table.status !== "out_of_service",
  );
  const seatsPerTurn = eligibleTables.reduce((sum, table) => sum + Math.max(table.capacity ?? 0, 0), 0);

  if (eligibleTables.length === 0 || seatsPerTurn === 0) {
    return {
      totalTables,
      totalCapacity,
      availableTables,
      zones,
      serviceCapacities: [],
    };
  }

  const [timingConfig, policy, periods] = await Promise.all([
    loadRestaurantTimingConfig(client, restaurantId),
    loadServicePolicy(client),
    loadServicePeriods(client, restaurantId),
  ]);

  const periodWindows = aggregateServiceWindows(periods);
  const fallbackWindows = derivePolicyWindows(policy);
  const serviceWindows = resolveServiceWindows(periodWindows, fallbackWindows);
  const bufferMinutes = policy?.clean_buffer_minutes ?? 5;

  const serviceCapacities: ServiceCapacitySummary[] = [];

  for (const key of SERVICE_CAPACITY_KEYS) {
    const window = serviceWindows.get(key);
    if (!window || window <= 0) {
      continue;
    }

    const turnsPerTable = turnsPerTableForWindow(
      window,
      timingConfig.turnMinutes,
      bufferMinutes,
      timingConfig.intervalMinutes,
    );

    if (turnsPerTable <= 0) {
      serviceCapacities.push({
        key,
        label: SERVICE_LABELS[key],
        capacity: 0,
        tablesConsidered: eligibleTables.length,
        turnsPerTable: 0,
        seatsPerTurn,
        assumptions: {
          windowMinutes: window,
          turnMinutes: timingConfig.turnMinutes,
          bufferMinutes,
          intervalMinutes: timingConfig.intervalMinutes,
        },
      });
      continue;
    }

    const capacity = eligibleTables.reduce((sum, table) => sum + table.capacity * turnsPerTable, 0);

    serviceCapacities.push({
      key,
      label: SERVICE_LABELS[key],
      capacity,
      tablesConsidered: eligibleTables.length,
      turnsPerTable,
      seatsPerTurn,
      assumptions: {
        windowMinutes: window,
        turnMinutes: timingConfig.turnMinutes,
        bufferMinutes,
        intervalMinutes: timingConfig.intervalMinutes,
      },
    });
  }

  return {
    totalTables,
    totalCapacity,
    availableTables,
    zones,
    serviceCapacities,
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
    summary: await computeSummary(client, restaurantId, tables, zones),
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

  const record = toTableRecord(data as RawTableRecord);
  invalidateRestaurantCapacityCaches(record.restaurant_id);
  return record;
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

  const record = toTableRecord(data as RawTableRecord);
  invalidateRestaurantCapacityCaches(record.restaurant_id);
  return record;
}

export async function deleteTable(client: PublicClient, tableId: string): Promise<void> {
  const { data, error } = await client
    .from("table_inventory")
    .delete()
    .eq("id", tableId)
    .select("restaurant_id")
    .single();
  if (error) {
    throw error;
  }
  invalidateRestaurantCapacityCaches(data?.restaurant_id ?? undefined);
}
