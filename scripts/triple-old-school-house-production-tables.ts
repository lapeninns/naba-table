import { randomUUID } from "crypto";
import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  capacity: number | null;
};

type TableRow = {
  id: string;
  zone_id: string | null;
  table_number: string;
  capacity: number;
  min_party_size: number | null;
  max_party_size: number | null;
  section: string | null;
  status: string | null;
  position: unknown;
  notes: string | null;
  category: string | null;
  seating_type: string | null;
  mobility: string | null;
  active: boolean | null;
};

type ClonedTableInsert = Omit<TableRow, "id"> & {
  id: string;
  restaurant_id: string;
};

type PlannedBatch = {
  batchIndex: number;
  insertedTableIds: string[];
  insertedTableNumbers: string[];
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const defaultEnvPath = path.join(projectRoot, ".env.vercel-production.live");

if (fs.existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: false });
}

const apply = process.env.APPLY === "true";
const confirmProduction = process.env.CONFIRM_PRODUCTION === "true";
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || "vrdiqfudmwydclqpydee";
const targetSlug = process.env.TARGET_SLUG?.trim() || "the-old-school-house";
const expectedBaseCount = Number.parseInt(process.env.EXPECTED_BASE_COUNT?.trim() || "18", 10);
const multiplier = Number.parseInt(process.env.MULTIPLIER?.trim() || "3", 10);

const supabaseUrl = process.env.PRODUCTION_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing production Supabase URL or service role key.");
  process.exit(1);
}

if (!supabaseUrl.includes(expectedProjectRef)) {
  console.error(`Supabase URL does not match expected project ref (${expectedProjectRef}).`);
  process.exit(1);
}

if (apply && !confirmProduction) {
  console.error("CONFIRM_PRODUCTION=true is required to modify production data.");
  process.exit(1);
}

if (!Number.isInteger(expectedBaseCount) || expectedBaseCount <= 0) {
  console.error("EXPECTED_BASE_COUNT must be a positive integer.");
  process.exit(1);
}

if (!Number.isInteger(multiplier) || multiplier < 2) {
  console.error("MULTIPLIER must be an integer greater than or equal to 2.");
  process.exit(1);
}

const targetCount = expectedBaseCount * multiplier;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function numericTableNumberInfo(tableNumbers: string[]): { nextValue: number; width: number } {
  const numericValues = tableNumbers.map((value) => {
    if (!/^\d+$/.test(value)) {
      throw new Error(`Non-numeric table_number encountered: ${value}`);
    }
    return Number.parseInt(value, 10);
  });

  const width = Math.max(...tableNumbers.map((value) => value.length), 2);
  const nextValue = Math.max(...numericValues) + 1;
  return { nextValue, width };
}

function padTableNumber(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}

function summarizeByCapacity(tables: Array<Pick<TableRow, "capacity">>): Record<string, number> {
  return tables.reduce<Record<string, number>>((acc, table) => {
    const key = String(table.capacity);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function isAdjacencyEligible(table: Pick<TableRow, "zone_id" | "active" | "capacity" | "status" | "mobility">): boolean {
  if (!table.zone_id) return false;
  if (table.active === false) return false;
  if ((table.capacity ?? 0) <= 0) return false;

  const status = String(table.status ?? "available").toLowerCase();
  if (status === "out_of_service" || status === "maintenance") return false;

  const mobility = String(table.mobility ?? "movable").toLowerCase();
  return mobility === "movable" || mobility === "adjustable";
}

function projectAdjacencyRows(tables: TableRow[] | ClonedTableInsert[]) {
  const eligibleByZone = new Map<string, number>();

  for (const table of tables) {
    if (!isAdjacencyEligible(table)) continue;
    const zoneId = table.zone_id as string;
    eligibleByZone.set(zoneId, (eligibleByZone.get(zoneId) ?? 0) + 1);
  }

  let totalRows = 0;
  const byZone = [...eligibleByZone.entries()].map(([zoneId, eligibleTables]) => {
    const adjacencyRows = eligibleTables * Math.max(eligibleTables - 1, 0);
    totalRows += adjacencyRows;
    return { zoneId, eligibleTables, adjacencyRows };
  });

  return { totalRows, byZone };
}

async function loadRestaurant(): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,slug,capacity")
    .eq("slug", targetSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found for slug: ${targetSlug}`);
  }

  return data as RestaurantRow;
}

async function loadTables(restaurantId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from("table_inventory")
    .select("id,zone_id,table_number,capacity,min_party_size,max_party_size,section,status,position,notes,category,seating_type,mobility,active")
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load tables: ${error.message}`);
  }

  return (data ?? []) as TableRow[];
}

function buildClonePlan(restaurantId: string, baseTables: TableRow[]) {
  const existingNumbers = new Set(baseTables.map((table) => table.table_number));
  const { nextValue: startingNumber, width } = numericTableNumberInfo([...existingNumbers]);

  let nextNumber = startingNumber;
  const clonedTables: ClonedTableInsert[] = [];
  const plannedBatches: PlannedBatch[] = [];

  for (let batchIndex = 1; batchIndex < multiplier; batchIndex += 1) {
    const batchTables: ClonedTableInsert[] = [];

    for (const table of baseTables) {
      let tableNumber = padTableNumber(nextNumber, width);
      while (existingNumbers.has(tableNumber)) {
        nextNumber += 1;
        tableNumber = padTableNumber(nextNumber, width);
      }

      const clonedId = randomUUID();
      existingNumbers.add(tableNumber);

      batchTables.push({
        id: clonedId,
        restaurant_id: restaurantId,
        zone_id: table.zone_id,
        table_number: tableNumber,
        capacity: table.capacity,
        min_party_size: table.min_party_size,
        max_party_size: table.max_party_size,
        section: table.section,
        status: table.status ?? "available",
        position: table.position ?? null,
        notes: table.notes,
        category: table.category ?? "dining",
        seating_type: table.seating_type ?? "standard",
        mobility: table.mobility ?? "fixed",
        active: table.active ?? true,
      });

      nextNumber += 1;
    }

    clonedTables.push(...batchTables);
    plannedBatches.push({
      batchIndex,
      insertedTableIds: batchTables.map((table) => table.id),
      insertedTableNumbers: batchTables.map((table) => table.table_number),
    });
  }

  return { clonedTables, plannedBatches };
}

async function verifyState(restaurantId: string) {
  const [{ count: total, error: totalError }, { count: active, error: activeError }, { data: tables, error: tableError }] =
    await Promise.all([
      supabase.from("table_inventory").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
      supabase.from("table_inventory").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("active", true),
      supabase
        .from("table_inventory")
        .select("id,capacity")
        .eq("restaurant_id", restaurantId)
        .order("table_number", { ascending: true }),
    ]);

  if (totalError) throw new Error(`Failed to verify total tables: ${totalError.message}`);
  if (activeError) throw new Error(`Failed to verify active tables: ${activeError.message}`);
  if (tableError) throw new Error(`Failed to verify table rows: ${tableError.message}`);

  const tableIds = (tables ?? []).map((row) => row.id as string);
  const { count: adjacencyCount, error: adjacencyError } = tableIds.length
    ? await supabase
        .from("table_adjacencies")
        .select("table_a", { count: "exact", head: true })
        .in("table_a", tableIds)
        .in("table_b", tableIds)
    : { count: 0, error: null };

  if (adjacencyError) {
    throw new Error(`Failed to verify adjacency rows: ${adjacencyError.message}`);
  }

  return {
    totalTables: total ?? 0,
    activeTables: active ?? 0,
    adjacencyRows: adjacencyCount ?? 0,
    byCapacity: summarizeByCapacity((tables ?? []) as Array<Pick<TableRow, "capacity">>),
  };
}

async function deleteInsertedTables(insertedTableIds: string[]): Promise<void> {
  if (insertedTableIds.length === 0) return;

  const { error: tableDeleteError } = await supabase.from("table_inventory").delete().in("id", insertedTableIds);
  if (tableDeleteError) {
    console.error("[triple-old-school-house-production-tables] cleanup table delete failed", tableDeleteError.message);
  }
}

async function main(): Promise<void> {
  const restaurant = await loadRestaurant();
  const baseTables = await loadTables(restaurant.id);

  if (baseTables.length === targetCount) {
    console.log(
      JSON.stringify(
        {
          status: "already-at-target",
          restaurant,
          targetCount,
          multiplier,
          verified: await verifyState(restaurant.id),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (baseTables.length !== expectedBaseCount) {
    throw new Error(
      `Expected ${expectedBaseCount} current tables for ${targetSlug}, found ${baseTables.length}. Refusing to continue.`,
    );
  }

  const clonePlan = buildClonePlan(restaurant.id, baseTables);
  const projectedFinalTables = [...baseTables, ...(clonePlan.clonedTables as TableRow[])];
  const currentAdjacencyProjection = projectAdjacencyRows(baseTables);
  const finalAdjacencyProjection = projectAdjacencyRows(projectedFinalTables);

  const dryRunOutput = {
    status: apply ? "apply-requested" : "dry-run",
    restaurant,
    expectedBaseCount,
    multiplier,
    targetCount,
    currentCount: baseTables.length,
    currentByCapacity: summarizeByCapacity(baseTables),
    currentAdjacencyProjection,
    finalAdjacencyProjection,
    plan: {
      newTables: clonePlan.clonedTables.length,
      batches: clonePlan.plannedBatches.map((batch) => ({
        batchIndex: batch.batchIndex,
        newTableCount: batch.insertedTableIds.length,
        previewTableNumbers: batch.insertedTableNumbers.slice(0, 5),
      })),
    },
  };

  if (!apply) {
    console.log(JSON.stringify(dryRunOutput, null, 2));
    return;
  }

  const insertedTableIds = clonePlan.clonedTables.map((table) => table.id);

  try {
    const { error: tableInsertError } = await supabase.from("table_inventory").insert(clonePlan.clonedTables);
    if (tableInsertError) {
      throw new Error(`Failed to insert cloned tables: ${tableInsertError.message}`);
    }
  } catch (error) {
    await deleteInsertedTables(insertedTableIds);
    throw error;
  }

  const verified = await verifyState(restaurant.id);

  console.log(
    JSON.stringify(
      {
        ...dryRunOutput,
        status: "applied",
        insertedTableIds,
        verified,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
