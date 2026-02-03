import { randomUUID } from "crypto";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmProduction = process.env.CONFIRM_PRODUCTION === "true";
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const restaurantSlug = process.env.RESTAURANT_SLUG?.trim() || "the-railway-pub";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!confirmProduction) {
  console.error("CONFIRM_PRODUCTION=true is required to modify production data.");
  process.exit(1);
}

if (expectedProjectRef && !supabaseUrl.includes(expectedProjectRef)) {
  console.error(`Supabase URL does not match expected project ref (${expectedProjectRef}).`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ZoneSpec = {
  zoneNumber: number;
  name: string;
  sortOrder: number;
  isPrivate: boolean;
  mobility: "movable" | "fixed";
  table4: number;
  table2: number;
  table7: number;
};

type TableSpec = {
  id: string;
  restaurant_id: string;
  zone_id: string;
  table_number: string;
  capacity: number;
  min_party_size: number;
  max_party_size: number;
  category: "dining" | "private";
  mobility: "movable" | "fixed";
  seating_type: "standard";
  status: "available";
  section: string;
  active: boolean;
  position: null;
};

type OperatingHourSpec = {
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
  effective_date: null;
  notes: null;
  restaurant_id: string;
};

type ServicePeriodSpec = {
  id: string;
  restaurant_id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  booking_option: "dinner";
};

const ZONES: ZoneSpec[] = [
  { zoneNumber: 1, name: "Main Zone 1", sortOrder: 1, isPrivate: false, mobility: "movable", table4: 3, table2: 0, table7: 0 },
  { zoneNumber: 2, name: "Main Zone 2", sortOrder: 2, isPrivate: false, mobility: "movable", table4: 2, table2: 0, table7: 0 },
  { zoneNumber: 3, name: "Main Zone 3", sortOrder: 3, isPrivate: false, mobility: "movable", table4: 2, table2: 0, table7: 0 },
  { zoneNumber: 4, name: "Main Zone 4", sortOrder: 4, isPrivate: false, mobility: "movable", table4: 1, table2: 1, table7: 0 },
  { zoneNumber: 5, name: "Main Zone 5", sortOrder: 5, isPrivate: false, mobility: "movable", table4: 2, table2: 1, table7: 0 },
  { zoneNumber: 6, name: "Main Zone 6", sortOrder: 6, isPrivate: false, mobility: "fixed", table4: 2, table2: 1, table7: 0 },
  { zoneNumber: 7, name: "Private Zone", sortOrder: 7, isPrivate: true, mobility: "fixed", table4: 0, table2: 0, table7: 1 },
];

const WEEKLY_HOURS: Array<{ day: number; opens: string; closes: string }> = [
  { day: 0, opens: "12:00:00", closes: "21:00:00" }, // Sunday
  { day: 1, opens: "16:00:00", closes: "22:00:00" }, // Monday
  { day: 2, opens: "16:00:00", closes: "22:00:00" }, // Tuesday
  { day: 3, opens: "16:00:00", closes: "22:00:00" }, // Wednesday
  { day: 4, opens: "16:00:00", closes: "22:00:00" }, // Thursday
  { day: 5, opens: "15:00:00", closes: "22:00:00" }, // Friday
  { day: 6, opens: "15:00:00", closes: "22:00:00" }, // Saturday
];

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function resolveRestaurantId(): Promise<string> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("slug", restaurantSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found for slug: ${restaurantSlug}`);
  }

  return data.id;
}

async function deleteByIds(table: string, column: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const group of chunk(ids, 100)) {
    const { error } = await supabase.from(table).delete().in(column, group);
    if (error) {
      if (shouldIgnoreMissingTable(error.message)) {
        return;
      }
      throw new Error(`Failed to delete ${table}: ${error.message}`);
    }
  }
}

async function deleteAdjacencies(tableIds: string[]): Promise<void> {
  if (tableIds.length === 0) return;
  for (const group of chunk(tableIds, 100)) {
    const inList = group.join(",");
    const { error } = await supabase
      .from("table_adjacencies")
      .delete()
      .or(`table_a.in.(${inList}),table_b.in.(${inList})`);
    if (error) {
      if (shouldIgnoreMissingTable(error.message)) {
        return;
      }
      throw new Error(`Failed to delete table_adjacencies: ${error.message}`);
    }
  }
}

function shouldIgnoreMissingTable(message: string): boolean {
  return /schema cache|does not exist/i.test(message);
}

async function clearExisting(restaurantId: string): Promise<void> {
  const { data: tables, error: tablesError } = await supabase
    .from("table_inventory")
    .select("id")
    .eq("restaurant_id", restaurantId);

  if (tablesError) {
    throw new Error(`Failed to load table_inventory: ${tablesError.message}`);
  }

  const tableIds = (tables ?? []).map((row) => row.id);

  await deleteByIds("booking_table_assignments", "table_id", tableIds);
  await deleteByIds("table_hold_members", "table_id", tableIds);
  await deleteByIds("table_hold_windows", "table_id", tableIds);

  const { error: holdsError } = await supabase
    .from("table_holds")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (holdsError) {
    if (!shouldIgnoreMissingTable(holdsError.message)) {
      throw new Error(`Failed to delete table_holds: ${holdsError.message}`);
    }
  }

  const { error: softHoldsError } = await supabase
    .from("table_soft_holds")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (softHoldsError) {
    if (!shouldIgnoreMissingTable(softHoldsError.message)) {
      throw new Error(`Failed to delete table_soft_holds: ${softHoldsError.message}`);
    }
  }

  const { error: scarcityError } = await supabase
    .from("table_scarcity_metrics")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (scarcityError) {
    if (!shouldIgnoreMissingTable(scarcityError.message)) {
      throw new Error(`Failed to delete table_scarcity_metrics: ${scarcityError.message}`);
    }
  }

  await deleteAdjacencies(tableIds);

  const { error: tablesDeleteError } = await supabase
    .from("table_inventory")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (tablesDeleteError) {
    throw new Error(`Failed to delete table_inventory: ${tablesDeleteError.message}`);
  }

  const { error: zonesDeleteError } = await supabase
    .from("zones")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (zonesDeleteError) {
    throw new Error(`Failed to delete zones: ${zonesDeleteError.message}`);
  }

  const { error: capacitiesDeleteError } = await supabase
    .from("allowed_capacities")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (capacitiesDeleteError) {
    throw new Error(`Failed to delete allowed_capacities: ${capacitiesDeleteError.message}`);
  }

  const { error: periodsDeleteError } = await supabase
    .from("restaurant_service_periods")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (periodsDeleteError) {
    throw new Error(`Failed to delete restaurant_service_periods: ${periodsDeleteError.message}`);
  }

  const { error: hoursDeleteError } = await supabase
    .from("restaurant_operating_hours")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (hoursDeleteError) {
    throw new Error(`Failed to delete restaurant_operating_hours: ${hoursDeleteError.message}`);
  }
}

async function insertAllowedCapacities(restaurantId: string): Promise<void> {
  const payload = [2, 4, 7].map((capacity) => ({ restaurant_id: restaurantId, capacity }));
  const { error } = await supabase.from("allowed_capacities").insert(payload);
  if (error) {
    throw new Error(`Failed to insert allowed_capacities: ${error.message}`);
  }
}

async function insertZones(restaurantId: string): Promise<Map<number, string>> {
  const zoneIdMap = new Map<number, string>();
  const payload = ZONES.map((zone) => {
    const id = randomUUID();
    zoneIdMap.set(zone.zoneNumber, id);
    return {
      id,
      restaurant_id: restaurantId,
      name: zone.name,
      sort_order: zone.sortOrder,
      active: true,
    };
  });

  const { error } = await supabase.from("zones").insert(payload);
  if (error) {
    throw new Error(`Failed to insert zones: ${error.message}`);
  }

  return zoneIdMap;
}

function makeTableNumber(zone: number, capacity: number, mobility: "movable" | "fixed", index: number): string {
  const letter = mobility === "movable" ? "M" : "F";
  return `Z${zone}-${capacity}${letter}-${index.toString().padStart(2, "0")}`;
}

function buildTables(restaurantId: string, zoneIds: Map<number, string>): TableSpec[] {
  const tables: TableSpec[] = [];

  for (const zone of ZONES) {
    const zoneId = zoneIds.get(zone.zoneNumber);
    if (!zoneId) {
      throw new Error(`Missing zone id for zone ${zone.zoneNumber}`);
    }

    const category = zone.isPrivate ? "private" : "dining";
    const section = zone.name;

    const addTables = (capacity: number, count: number) => {
      for (let i = 1; i <= count; i += 1) {
        tables.push({
          id: randomUUID(),
          restaurant_id: restaurantId,
          zone_id: zoneId,
          table_number: makeTableNumber(zone.zoneNumber, capacity, zone.mobility, i),
          capacity,
          min_party_size: 1,
          max_party_size: capacity,
          category,
          mobility: zone.mobility,
          seating_type: "standard",
          status: "available",
          section,
          active: true,
          position: null,
        });
      }
    };

    addTables(4, zone.table4);
    addTables(2, zone.table2);
    addTables(7, zone.table7);
  }

  return tables;
}

async function insertTables(tables: TableSpec[]): Promise<void> {
  const chunks = chunk(tables, 100);
  for (const group of chunks) {
    const { error } = await supabase.from("table_inventory").insert(group);
    if (error) {
      throw new Error(`Failed to insert table_inventory: ${error.message}`);
    }
  }
}

async function insertOperatingHours(restaurantId: string): Promise<void> {
  const payload: OperatingHourSpec[] = WEEKLY_HOURS.map((entry) => ({
    restaurant_id: restaurantId,
    day_of_week: entry.day,
    opens_at: entry.opens,
    closes_at: entry.closes,
    is_closed: false,
    effective_date: null,
    notes: null,
  }));

  const { error } = await supabase.from("restaurant_operating_hours").insert(payload);
  if (error) {
    throw new Error(`Failed to insert restaurant_operating_hours: ${error.message}`);
  }
}

async function insertServicePeriods(restaurantId: string): Promise<void> {
  const payload: ServicePeriodSpec[] = WEEKLY_HOURS.map((entry) => ({
    id: randomUUID(),
    restaurant_id: restaurantId,
    name: "Dinner",
    day_of_week: entry.day,
    start_time: entry.opens,
    end_time: entry.closes,
    booking_option: "dinner",
  }));

  const { error } = await supabase.from("restaurant_service_periods").insert(payload);
  if (error) {
    throw new Error(`Failed to insert restaurant_service_periods: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const restaurantId = await resolveRestaurantId();

  await clearExisting(restaurantId);
  await insertAllowedCapacities(restaurantId);
  const zoneIds = await insertZones(restaurantId);
  const tables = buildTables(restaurantId, zoneIds);
  await insertTables(tables);
  await insertOperatingHours(restaurantId);
  await insertServicePeriods(restaurantId);

  const summary = tables.reduce(
    (acc, table) => {
      acc.total += 1;
      acc.byCapacity[table.capacity] = (acc.byCapacity[table.capacity] ?? 0) + 1;
      acc.byZone[table.section] = (acc.byZone[table.section] ?? 0) + 1;
      return acc;
    },
    { total: 0, byCapacity: {} as Record<number, number>, byZone: {} as Record<string, number> },
  );

  console.log("Update complete:");
  console.log(summary);
}

void main().catch((error) => {
  console.error("[update-railway-zones-tables] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
