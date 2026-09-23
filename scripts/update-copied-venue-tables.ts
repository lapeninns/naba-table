import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  COPIED_VENUE_TABLE_SPECS,
  TABLE_CAPACITIES,
  countsMatchDesired,
  desiredTables,
  resolveRestaurant,
  seatTotal,
  summarizeByCapacity,
  type CopiedVenueSpec,
} from './copied-venue-tables/plan';
import { DEFAULT_PRODUCTION_PROJECT_REF, assertExactSupabaseApiProjectRef } from './db/safety';

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  capacity: number | null;
};

type ZoneRow = {
  id: string;
  name: string;
  sort_order: number | null;
  active: boolean | null;
};

type TableRow = {
  id: string;
  table_number: string;
  capacity: number;
  zone_id: string | null;
  active: boolean | null;
  status: string | null;
  mobility: string | null;
  category: string | null;
  seating_type: string | null;
  section: string | null;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const defaultEnvPath = path.join(projectRoot, '.env.vercel-production.live');

if (fs.existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: false });
}

const apply = process.env.APPLY === 'true';
const confirmProduction = process.env.CONFIRM_PRODUCTION === 'true';
const expectedProjectRef =
  process.env.EXPECTED_PROJECT_REF?.trim() || DEFAULT_PRODUCTION_PROJECT_REF;

const supabaseUrl =
  process.env.PRODUCTION_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing production Supabase URL or service role key.');
  process.exit(1);
}

try {
  assertExactSupabaseApiProjectRef(supabaseUrl, expectedProjectRef);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Supabase URL validation failed.');
  process.exit(1);
}

if (apply && !confirmProduction) {
  console.error('CONFIRM_PRODUCTION=true is required to modify production data.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function shouldIgnoreMissingTable(message: string | null | undefined): boolean {
  return (
    typeof message === 'string' &&
    /schema cache|does not exist|relation .* does not exist/i.test(message)
  );
}

function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickPrimaryZone(zones: ZoneRow[]): ZoneRow {
  const activeZones = zones.filter((zone) => zone.active !== false);
  const pool = activeZones.length > 0 ? activeZones : zones;
  if (pool.length === 0) {
    throw new Error('Restaurant has no zones to attach tables to.');
  }

  return [...pool].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))[0]!;
}

function projectAdjacencyRows(tableCount: number): number {
  return tableCount * Math.max(tableCount - 1, 0);
}

async function loadRestaurants(): Promise<RestaurantRow[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id,name,slug,capacity')
    .order('name');

  if (error) {
    throw new Error(`Failed to load restaurants: ${error.message}`);
  }

  return (data ?? []) as RestaurantRow[];
}

async function loadZones(restaurantId: string): Promise<ZoneRow[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('id,name,sort_order,active')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to load zones: ${error.message}`);
  }

  return (data ?? []) as ZoneRow[];
}

async function loadTables(restaurantId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from('table_inventory')
    .select('id,table_number,capacity,zone_id,active,status,mobility,category,seating_type,section')
    .eq('restaurant_id', restaurantId)
    .order('table_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load tables: ${error.message}`);
  }

  return (data ?? []) as TableRow[];
}

async function loadAllowedCapacities(restaurantId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('allowed_capacities')
    .select('capacity')
    .eq('restaurant_id', restaurantId)
    .order('capacity', { ascending: true });

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to load allowed capacities: ${error.message}`);
  }

  return ((data ?? []) as Array<{ capacity: number }>).map((row) => row.capacity);
}

async function countBlockingAssignments(restaurantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id,booking_table_assignments!inner(table_id)', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .not('status', 'in', '(cancelled,no_show,completed)')
    .gte('booking_date', currentDateIso());

  if (error) {
    throw new Error(`Failed to check booking assignments: ${error.message}`);
  }

  return count ?? 0;
}

async function countSoftHolds(tableIds: string[]): Promise<number> {
  if (tableIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from('table_soft_holds')
    .select('id', { count: 'exact', head: true })
    .in('table_id', tableIds)
    .gt('expires_at', new Date().toISOString());

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to check soft holds: ${error.message}`);
  }

  return count ?? 0;
}

async function countAdjacencyRows(tableIds: string[]): Promise<number> {
  if (tableIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from('table_adjacencies')
    .select('table_a,table_b', { count: 'exact', head: true })
    .in('table_a', tableIds)
    .in('table_b', tableIds);

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to count adjacency rows: ${error.message}`);
  }

  return count ?? 0;
}

async function ensureAllowedCapacities(
  restaurantId: string,
  existing: number[],
): Promise<number[]> {
  const missing = TABLE_CAPACITIES.filter((capacity) => !existing.includes(capacity));
  if (missing.length === 0) {
    return existing;
  }

  const { error } = await supabase
    .from('allowed_capacities')
    .insert(missing.map((capacity) => ({ restaurant_id: restaurantId, capacity })));

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to insert allowed capacities: ${error.message}`);
  }

  return [...existing, ...missing].sort((left, right) => left - right);
}

async function replaceTables(input: {
  restaurant: RestaurantRow;
  spec: CopiedVenueSpec;
  existingTables: TableRow[];
  zone: ZoneRow;
  allowedCapacities: number[];
}): Promise<{ tableIds: string[]; allowedCapacities: number[] }> {
  const blockingAssignments = await countBlockingAssignments(input.restaurant.id);
  if (blockingAssignments > 0) {
    throw new Error(
      `${input.spec.label} has ${blockingAssignments} active or future table assignment(s).`,
    );
  }

  const openSoftHolds = await countSoftHolds(input.existingTables.map((table) => table.id));
  if (openSoftHolds > 0) {
    throw new Error(`${input.spec.label} has ${openSoftHolds} unexpired soft hold(s).`);
  }

  const allowedCapacities = await ensureAllowedCapacities(
    input.restaurant.id,
    input.allowedCapacities,
  );

  for (const table of input.existingTables) {
    const { data, error } = await supabase.rpc('delete_table_inventory_guarded', {
      p_table_id: table.id,
      p_current_date: currentDateIso(),
    });
    if (error) {
      throw new Error(`Failed to delete table ${table.table_number}: ${error.message}`);
    }
    if (data === false) {
      throw new Error(`Table ${table.table_number} was not found during delete.`);
    }
  }

  const inserts = desiredTables(input.spec.counts).map((table) => ({
    id: randomUUID(),
    restaurant_id: input.restaurant.id,
    zone_id: input.zone.id,
    table_number: table.tableNumber,
    capacity: table.capacity,
    min_party_size: 1,
    max_party_size: table.capacity,
    section: input.zone.name,
    status: 'available',
    category: 'dining',
    seating_type: 'standard',
    mobility: 'movable',
    active: true,
    position: null,
    notes: null,
  }));

  const { error: insertError } = await supabase.from('table_inventory').insert(inserts);
  if (insertError) {
    throw new Error(`Failed to insert replacement tables: ${insertError.message}`);
  }

  const { error: capacityError } = await supabase
    .from('restaurants')
    .update({ capacity: seatTotal(input.spec.counts) })
    .eq('id', input.restaurant.id);
  if (capacityError) {
    throw new Error(`Failed to update restaurant seat capacity: ${capacityError.message}`);
  }

  return {
    tableIds: inserts.map((table) => table.id),
    allowedCapacities,
  };
}

async function verifyVenue(restaurantId: string, spec: CopiedVenueSpec) {
  const tables = await loadTables(restaurantId);
  const byCapacity = summarizeByCapacity(tables);
  if (!countsMatchDesired(byCapacity, spec.counts)) {
    throw new Error(
      `${spec.label} verification failed. Expected ${JSON.stringify(spec.counts)}, received ${JSON.stringify(byCapacity)}.`,
    );
  }

  const adjacencyRows = await countAdjacencyRows(tables.map((table) => table.id));
  const expectedAdjacencyRows = projectAdjacencyRows(tables.length);
  if (adjacencyRows !== expectedAdjacencyRows) {
    throw new Error(
      `${spec.label} adjacency verification failed. Expected ${expectedAdjacencyRows}, received ${adjacencyRows}.`,
    );
  }

  return {
    tableCount: tables.length,
    byCapacity,
    seatTotal: seatTotal(byCapacity),
    adjacencyRows,
  };
}

async function main(): Promise<void> {
  const restaurants = await loadRestaurants();
  const plans = [];

  for (const spec of COPIED_VENUE_TABLE_SPECS) {
    const restaurant = resolveRestaurant(restaurants, spec);
    const [tables, zones, allowedCapacities] = await Promise.all([
      loadTables(restaurant.id),
      loadZones(restaurant.id),
      loadAllowedCapacities(restaurant.id),
    ]);
    const zone = pickPrimaryZone(zones);
    const currentByCapacity = summarizeByCapacity(tables);
    const alreadyMatching = countsMatchDesired(currentByCapacity, spec.counts);
    const blockingAssignments = await countBlockingAssignments(restaurant.id);
    const openSoftHolds = await countSoftHolds(tables.map((table) => table.id));

    plans.push({
      spec: spec.label,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        capacity: restaurant.capacity,
      },
      current: {
        tableCount: tables.length,
        byCapacity: currentByCapacity,
        seatTotal: seatTotal(currentByCapacity),
        allowedCapacities,
        zone: { id: zone.id, name: zone.name },
      },
      desired: {
        tableCount: desiredTables(spec.counts).length,
        byCapacity: spec.counts,
        seatTotal: seatTotal(spec.counts),
        tableNumbers: desiredTables(spec.counts).map((table) => table.tableNumber),
      },
      alreadyMatching,
      blockingAssignments,
      openSoftHolds,
    });
  }

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, plans }, null, 2));
    return;
  }

  const blocked = plans.filter((plan) => plan.blockingAssignments > 0 || plan.openSoftHolds > 0);
  if (blocked.length > 0) {
    throw new Error(
      `Refusing to replace tables while assignments or soft holds exist: ${blocked
        .map((plan) => plan.spec)
        .join(', ')}`,
    );
  }

  const applied = [];
  for (const spec of COPIED_VENUE_TABLE_SPECS) {
    const restaurant = resolveRestaurant(restaurants, spec);
    const tables = await loadTables(restaurant.id);
    const currentByCapacity = summarizeByCapacity(tables);
    if (countsMatchDesired(currentByCapacity, spec.counts)) {
      applied.push({
        spec: spec.label,
        slug: restaurant.slug,
        skipped: true,
        reason: 'already matching',
        verification: await verifyVenue(restaurant.id, spec),
      });
      continue;
    }

    const zones = await loadZones(restaurant.id);
    const allowedCapacities = await loadAllowedCapacities(restaurant.id);
    await replaceTables({
      restaurant,
      spec,
      existingTables: tables,
      zone: pickPrimaryZone(zones),
      allowedCapacities,
    });
    applied.push({
      spec: spec.label,
      slug: restaurant.slug,
      skipped: false,
      verification: await verifyVenue(restaurant.id, spec),
    });
  }

  console.log(JSON.stringify({ applied: true, results: applied }, null, 2));
}

void main().catch((error) => {
  console.error(
    '[update-copied-venue-tables] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
