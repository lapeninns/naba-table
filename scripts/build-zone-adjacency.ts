import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { assertExactSupabaseApiProjectRef } from './db/safety';
import type { Database } from '@/types/supabase';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const EXPECTED_PROJECT_REF = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const RESTAURANT_SLUG = (process.env.RESTAURANT_SLUG ?? 'the-railway-pub').trim();

function requireEnv(): { supabaseUrl: string; serviceRoleKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!RESTAURANT_SLUG) {
    throw new Error('RESTAURANT_SLUG is required.');
  }
  if (!EXPECTED_PROJECT_REF) {
    throw new Error('EXPECTED_PROJECT_REF is required before using the service-role key.');
  }
  assertExactSupabaseApiProjectRef(supabaseUrl, EXPECTED_PROJECT_REF);
  return { supabaseUrl, serviceRoleKey };
}

type TableRow = {
  id: string;
  zone_id: string | null;
  active: boolean | null;
  capacity: number | null;
  mobility: string | null;
  status: string | null;
  zone_active: boolean | null;
};

type AdjacencyRow = {
  table_a: string;
  table_b: string;
};

type AdjacencyBuild = {
  payload: AdjacencyRow[];
  singleTableZones: number;
};

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isEligible(table: TableRow): boolean {
  if (!table.zone_id) return false;
  if (table.zone_active === false) return false;
  if (table.active === false) return false;
  if (!Number.isFinite(table.capacity ?? NaN) || (table.capacity ?? 0) <= 0) return false;

  const status = normalizeLower(table.status || 'available');
  if (status === 'out_of_service' || status === 'maintenance') return false;

  const mobility = normalizeLower(table.mobility || 'movable');
  if (mobility === 'fixed') return false;
  return true;
}

function buildAdjacencyPayload(tables: TableRow[]): AdjacencyBuild {
  const byZone = new Map<string, string[]>();
  for (const table of tables) {
    if (!isEligible(table)) {
      continue;
    }
    const zoneId = table.zone_id;
    if (!zoneId) {
      continue;
    }
    const list = byZone.get(zoneId) ?? [];
    list.push(table.id);
    byZone.set(zoneId, list);
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
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
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
    .from('table_inventory')
    .select('id, zone_id, active, capacity, mobility, status, zones(active)')
    .eq('restaurant_id', restaurantId);
  if (error) {
    throw new Error(`Failed to load table_inventory: ${error.message}`);
  }
  const rows = (data ?? []).filter((row) => Boolean(row?.id));
  return rows.map((row) => {
    const zone_active =
      (row as unknown as { zones?: { active: boolean | null } | null }).zones?.active ?? true;
    return {
      id: row.id,
      zone_id: row.zone_id ?? null,
      active: row.active ?? null,
      capacity: (row.capacity ?? null) as number | null,
      mobility: (row.mobility ?? null) as string | null,
      status: (row.status ?? null) as string | null,
      zone_active,
    } satisfies TableRow;
  });
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
    .from('table_adjacencies')
    .select('table_a, table_b')
    .or(`table_a.in.(${tableIds.join(',')}),table_b.in.(${tableIds.join(',')})`);
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
  const tableIdSet = new Set(tables.map((t) => t.id));
  const existing = await loadExistingAdjacency(
    supabase,
    tables.map((table) => table.id),
  );
  const missing = payload.filter((row) => !existing.has(`${row.table_a}|${row.table_b}`));
  const expectedSet = new Set(payload.map((row) => `${row.table_a}|${row.table_b}`));
  const extra = Array.from(existing).filter((key) => {
    const [a, b] = key.split('|');
    if (!a || !b) return false;
    // Only consider edges entirely within this restaurant scope.
    const inScope = tableIdSet.has(a) && tableIdSet.has(b);
    if (!inScope) return false;
    return !expectedSet.has(key);
  });

  console.log('Adjacency build summary:');
  console.log({
    restaurantSlug: RESTAURANT_SLUG,
    restaurantId,
    tableCount: tables.length,
    edgesCalculated: payload.length,
    existingEdges: existing.size,
    missingEdges: missing.length,
    extraEdges: extra.length,
    singleTableZones,
  });

  if (missing.length > 0 || extra.length > 0) {
    console.error('Adjacency mismatch detected. Sample:', {
      missing: missing.slice(0, 10).map((r) => `${r.table_a}|${r.table_b}`),
      extra: extra.slice(0, 10),
    });
    process.exit(2);
  }
}

void main().catch((error) => {
  console.error('[build-zone-adjacency] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
