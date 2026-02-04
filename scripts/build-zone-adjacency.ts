import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const APPLY = process.env.APPLY === "true";
const CONFIRM_PRODUCTION = process.env.CONFIRM_PRODUCTION === "true";
const EXPECTED_PROJECT_REF = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const RESTAURANT_SLUG = (process.env.RESTAURANT_SLUG ?? "the-railway-pub").trim();

function requireEnv(): { supabaseUrl: string; serviceRoleKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!RESTAURANT_SLUG) {
    throw new Error("RESTAURANT_SLUG is required.");
  }
  if (APPLY && !CONFIRM_PRODUCTION) {
    throw new Error("APPLY requested without CONFIRM_PRODUCTION=true. Refusing to write in production.");
  }
  if (CONFIRM_PRODUCTION && EXPECTED_PROJECT_REF && !supabaseUrl.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`Supabase URL does not match expected project ref (${EXPECTED_PROJECT_REF}). Aborting.`);
  }
  return { supabaseUrl, serviceRoleKey };
}

type TableRow = {
  id: string;
  zone_id: string | null;
};

type AdjacencyRow = {
  table_a: string;
  table_b: string;
};

type AdjacencyBuild = {
  payload: AdjacencyRow[];
  singleTableZones: number;
};

function buildAdjacencyPayload(tables: TableRow[]): AdjacencyBuild {
  const byZone = new Map<string, string[]>();
  for (const table of tables) {
    if (!table.zone_id) {
      continue;
    }
    const list = byZone.get(table.zone_id) ?? [];
    list.push(table.id);
    byZone.set(table.zone_id, list);
  }

  const payload: AdjacencyRow[] = [];
  let singleTableZones = 0;
  for (const ids of byZone.values()) {
    if (ids.length === 1) {
      singleTableZones += 1;
      continue;
    }
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = ids[i];
        const b = ids[j];
        if (!a || !b) {
          continue;
        }
        payload.push({ table_a: a, table_b: b });
        payload.push({ table_a: b, table_b: a });
      }
    }
  }
  return { payload, singleTableZones };
}

async function fetchRestaurantId(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve restaurant: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Restaurant not found for slug: ${slug}`);
  }
  return data.id;
}

async function loadTables(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from("table_inventory")
    .select("id, zone_id")
    .eq("restaurant_id", restaurantId);
  if (error) {
    throw new Error(`Failed to load table_inventory: ${error.message}`);
  }
  return (data ?? []).filter((row): row is TableRow => Boolean(row?.id));
}

async function loadExistingAdjacency(
  supabase: SupabaseClient<Database>,
  tableIds: string[],
): Promise<Set<string>> {
  if (tableIds.length === 0) {
    return new Set();
  }
  const idSet = new Set(tableIds);
  const { data, error } = await supabase
    .from("table_adjacencies")
    .select("table_a, table_b")
    .or(`table_a.in.(${tableIds.join(",")}),table_b.in.(${tableIds.join(",")})`);
  if (error) {
    throw new Error(`Failed to load table_adjacencies: ${error.message}`);
  }
  const existing = new Set<string>();
  for (const row of data ?? []) {
    if (!row?.table_a || !row?.table_b) {
      continue;
    }
    if (idSet.has(row.table_a) || idSet.has(row.table_b)) {
      existing.add(`${row.table_a}|${row.table_b}`);
    }
  }
  return existing;
}

async function insertAdjacency(
  supabase: SupabaseClient<Database>,
  rows: AdjacencyRow[],
): Promise<void> {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("table_adjacencies").insert(batch);
    if (error) {
      throw new Error(`Failed to insert table_adjacencies: ${error.message}`);
    }
  }
}

async function main(): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = requireEnv();

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const restaurantId = await fetchRestaurantId(supabase, RESTAURANT_SLUG);
  const tables = await loadTables(supabase, restaurantId);
  if (tables.length === 0) {
    throw new Error(`No tables found for restaurant ${RESTAURANT_SLUG} (${restaurantId}).`);
  }

  const { payload, singleTableZones } = buildAdjacencyPayload(tables);
  const existing = await loadExistingAdjacency(
    supabase,
    tables.map((table) => table.id),
  );
  const toInsert = payload.filter((row) => !existing.has(`${row.table_a}|${row.table_b}`));

  if (APPLY && toInsert.length > 0) {
    await insertAdjacency(supabase, toInsert);
  }

  console.log("Adjacency build summary:");
  console.log({
    restaurantSlug: RESTAURANT_SLUG,
    restaurantId,
    tableCount: tables.length,
    edgesCalculated: payload.length,
    existingEdges: existing.size,
    edgesToInsert: toInsert.length,
    singleTableZones,
    applied: APPLY,
  });
}

void main().catch((error) => {
  console.error("[build-zone-adjacency] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
