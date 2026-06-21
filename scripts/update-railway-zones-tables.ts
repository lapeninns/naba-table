import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { getPgSslConfig } from './db/pg-ssl';
import { assertProductionScriptSafety } from './db/safety';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const dbUrl =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.DB_URL?.trim() ||
  null;
const confirmProduction = process.env.CONFIRM_PRODUCTION === 'true';
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const restaurantSlug = process.env.RESTAURANT_SLUG?.trim() || 'the-railway-pub';

if (!dbUrl) {
  console.error('SUPABASE_DB_URL, DATABASE_URL, or DB_URL is required.');
  process.exit(1);
}
const checkedDbUrl = dbUrl;

if (!expectedProjectRef) {
  console.error('EXPECTED_PROJECT_REF is required to modify production data.');
  process.exit(1);
}

try {
  assertProductionScriptSafety({
    connectionString: dbUrl,
    expectedProjectRef,
    targetEnv: process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim() || '',
    requireTargetEnv: true,
    apply: true,
    destructive: true,
    requireRestaurant: true,
    targetRestaurant: restaurantSlug,
    confirmation: confirmProduction ? 'true' : undefined,
    confirmationName: 'CONFIRM_PRODUCTION',
    breakGlass: confirmProduction ? 'true' : undefined,
    breakGlassName: 'CONFIRM_PRODUCTION',
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

type ZoneSpec = {
  zoneNumber: number;
  name: string;
  sortOrder: number;
  isPrivate: boolean;
  mobility: 'movable' | 'fixed';
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
  category: 'dining' | 'private';
  mobility: 'movable' | 'fixed';
  seating_type: 'standard';
  status: 'available';
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
  booking_option: 'dinner';
};

const ZONES: ZoneSpec[] = [
  {
    zoneNumber: 1,
    name: 'Main Zone 1',
    sortOrder: 1,
    isPrivate: false,
    mobility: 'movable',
    table4: 3,
    table2: 0,
    table7: 0,
  },
  {
    zoneNumber: 2,
    name: 'Main Zone 2',
    sortOrder: 2,
    isPrivate: false,
    mobility: 'movable',
    table4: 2,
    table2: 0,
    table7: 0,
  },
  {
    zoneNumber: 3,
    name: 'Main Zone 3',
    sortOrder: 3,
    isPrivate: false,
    mobility: 'movable',
    table4: 2,
    table2: 0,
    table7: 0,
  },
  {
    zoneNumber: 4,
    name: 'Main Zone 4',
    sortOrder: 4,
    isPrivate: false,
    mobility: 'movable',
    table4: 1,
    table2: 1,
    table7: 0,
  },
  {
    zoneNumber: 5,
    name: 'Main Zone 5',
    sortOrder: 5,
    isPrivate: false,
    mobility: 'movable',
    table4: 2,
    table2: 1,
    table7: 0,
  },
  {
    zoneNumber: 6,
    name: 'Main Zone 6',
    sortOrder: 6,
    isPrivate: false,
    mobility: 'fixed',
    table4: 2,
    table2: 1,
    table7: 0,
  },
  {
    zoneNumber: 7,
    name: 'Private Zone',
    sortOrder: 7,
    isPrivate: true,
    mobility: 'fixed',
    table4: 0,
    table2: 0,
    table7: 1,
  },
];

const WEEKLY_HOURS: Array<{ day: number; opens: string; closes: string }> = [
  { day: 0, opens: '12:00:00', closes: '21:00:00' }, // Sunday
  { day: 1, opens: '16:00:00', closes: '22:00:00' }, // Monday
  { day: 2, opens: '16:00:00', closes: '22:00:00' }, // Tuesday
  { day: 3, opens: '16:00:00', closes: '22:00:00' }, // Wednesday
  { day: 4, opens: '16:00:00', closes: '22:00:00' }, // Thursday
  { day: 5, opens: '15:00:00', closes: '22:00:00' }, // Friday
  { day: 6, opens: '15:00:00', closes: '22:00:00' }, // Saturday
];

function quoteIdent(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.query<{ exists: string | null }>('select to_regclass($1) as exists', [
    `public.${table}`,
  ]);
  return Boolean(result.rows[0]?.exists);
}

async function resolveRestaurantId(client: Client): Promise<string> {
  const result = await client.query<{ id: string }>(
    'select id from public.restaurants where slug = $1 for update',
    [restaurantSlug],
  );

  if (!result.rows[0]?.id) {
    throw new Error(`Restaurant not found for slug: ${restaurantSlug}`);
  }

  return result.rows[0].id;
}

async function deleteByIds(
  client: Client,
  table: string,
  column: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  if (!(await tableExists(client, table))) {
    return;
  }
  await client.query(
    `delete from public.${quoteIdent(table)} where ${quoteIdent(column)} = any($1::uuid[])`,
    [ids],
  );
}

async function deleteAdjacencies(client: Client, tableIds: string[]): Promise<void> {
  if (tableIds.length === 0) return;
  if (!(await tableExists(client, 'table_adjacencies'))) {
    return;
  }
  await client.query(
    'delete from public.table_adjacencies where table_a = any($1::uuid[]) or table_b = any($1::uuid[])',
    [tableIds],
  );
}

async function deleteByRestaurantId(
  client: Client,
  table: string,
  restaurantId: string,
): Promise<void> {
  if (!(await tableExists(client, table))) {
    return;
  }
  await client.query(`delete from public.${quoteIdent(table)} where restaurant_id = $1`, [
    restaurantId,
  ]);
}

async function clearExisting(client: Client, restaurantId: string): Promise<void> {
  const tables = await client.query<{ id: string }>(
    'select id from public.table_inventory where restaurant_id = $1 for update',
    [restaurantId],
  );
  const tableIds = tables.rows.map((row) => row.id);

  if (tableIds.length > 0) {
    const assignedBookings = await client.query<{ booking_count: string }>(
      `
        select count(*)::text as booking_count
        from public.booking_table_assignments bta
        join public.bookings b on b.id = bta.booking_id
        where bta.table_id = any($1::uuid[])
          and coalesce(b.status::text, '') not in ('cancelled', 'no_show', 'completed')
          and b.booking_date >= current_date
      `,
      [tableIds],
    );
    const bookingCount = Number.parseInt(assignedBookings.rows[0]?.booking_count ?? '0', 10);
    if (bookingCount > 0) {
      throw new Error(
        `Refusing to replace Railway tables: ${bookingCount} active or future booking assignment(s) still reference existing tables.`,
      );
    }
  }

  await deleteByIds(client, 'booking_table_assignments', 'table_id', tableIds);
  await deleteByIds(client, 'table_hold_members', 'table_id', tableIds);
  await deleteByIds(client, 'table_hold_windows', 'table_id', tableIds);
  await deleteByRestaurantId(client, 'table_holds', restaurantId);
  await deleteByRestaurantId(client, 'table_soft_holds', restaurantId);
  await deleteByRestaurantId(client, 'table_scarcity_metrics', restaurantId);
  await deleteAdjacencies(client, tableIds);
  await deleteByRestaurantId(client, 'table_inventory', restaurantId);
  await deleteByRestaurantId(client, 'zones', restaurantId);
  await deleteByRestaurantId(client, 'allowed_capacities', restaurantId);
  await deleteByRestaurantId(client, 'restaurant_service_periods', restaurantId);
  await deleteByRestaurantId(client, 'restaurant_operating_hours', restaurantId);
}

async function insertAllowedCapacities(client: Client, restaurantId: string): Promise<void> {
  const payload = [2, 4, 7].map((capacity) => ({ restaurant_id: restaurantId, capacity }));
  for (const row of payload) {
    await client.query(
      'insert into public.allowed_capacities (restaurant_id, capacity) values ($1, $2)',
      [row.restaurant_id, row.capacity],
    );
  }
}

async function insertZones(client: Client, restaurantId: string): Promise<Map<number, string>> {
  const zoneIdMap = new Map<number, string>();
  for (const zone of ZONES) {
    const id = randomUUID();
    zoneIdMap.set(zone.zoneNumber, id);
    await client.query(
      'insert into public.zones (id, restaurant_id, name, sort_order, active) values ($1, $2, $3, $4, $5)',
      [id, restaurantId, zone.name, zone.sortOrder, true],
    );
  }

  return zoneIdMap;
}

function makeTableNumber(
  zone: number,
  capacity: number,
  mobility: 'movable' | 'fixed',
  index: number,
): string {
  const letter = mobility === 'movable' ? 'M' : 'F';
  return `Z${zone}-${capacity}${letter}-${index.toString().padStart(2, '0')}`;
}

function buildTables(restaurantId: string, zoneIds: Map<number, string>): TableSpec[] {
  const tables: TableSpec[] = [];

  for (const zone of ZONES) {
    const zoneId = zoneIds.get(zone.zoneNumber);
    if (!zoneId) {
      throw new Error(`Missing zone id for zone ${zone.zoneNumber}`);
    }

    const category = zone.isPrivate ? 'private' : 'dining';
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
          seating_type: 'standard',
          status: 'available',
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

async function insertTables(client: Client, tables: TableSpec[]): Promise<void> {
  for (const table of tables) {
    await client.query(
      [
        'insert into public.table_inventory',
        '(id, restaurant_id, zone_id, table_number, capacity, min_party_size, max_party_size, category, mobility, seating_type, status, section, active, position)',
        'values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      ].join(' '),
      [
        table.id,
        table.restaurant_id,
        table.zone_id,
        table.table_number,
        table.capacity,
        table.min_party_size,
        table.max_party_size,
        table.category,
        table.mobility,
        table.seating_type,
        table.status,
        table.section,
        table.active,
        table.position,
      ],
    );
  }
}

async function insertOperatingHours(client: Client, restaurantId: string): Promise<void> {
  const payload: OperatingHourSpec[] = WEEKLY_HOURS.map((entry) => ({
    restaurant_id: restaurantId,
    day_of_week: entry.day,
    opens_at: entry.opens,
    closes_at: entry.closes,
    is_closed: false,
    effective_date: null,
    notes: null,
  }));

  for (const row of payload) {
    await client.query(
      [
        'insert into public.restaurant_operating_hours',
        '(restaurant_id, day_of_week, opens_at, closes_at, is_closed, effective_date, notes)',
        'values ($1, $2, $3, $4, $5, $6, $7)',
      ].join(' '),
      [
        row.restaurant_id,
        row.day_of_week,
        row.opens_at,
        row.closes_at,
        row.is_closed,
        row.effective_date,
        row.notes,
      ],
    );
  }
}

async function insertServicePeriods(client: Client, restaurantId: string): Promise<void> {
  const payload: ServicePeriodSpec[] = WEEKLY_HOURS.map((entry) => ({
    id: randomUUID(),
    restaurant_id: restaurantId,
    name: 'Dinner',
    day_of_week: entry.day,
    start_time: entry.opens,
    end_time: entry.closes,
    booking_option: 'dinner',
  }));

  for (const row of payload) {
    await client.query(
      [
        'insert into public.restaurant_service_periods',
        '(id, restaurant_id, name, day_of_week, start_time, end_time, booking_option)',
        'values ($1, $2, $3, $4, $5, $6, $7)',
      ].join(' '),
      [
        row.id,
        row.restaurant_id,
        row.name,
        row.day_of_week,
        row.start_time,
        row.end_time,
        row.booking_option,
      ],
    );
  }
}

async function main(): Promise<void> {
  const client = new Client({
    connectionString: checkedDbUrl,
    ssl: getPgSslConfig(process.env),
  });
  await client.connect();

  let tables: TableSpec[] = [];
  try {
    await client.query('begin');
    const restaurantId = await resolveRestaurantId(client);
    await clearExisting(client, restaurantId);
    await insertAllowedCapacities(client, restaurantId);
    const zoneIds = await insertZones(client, restaurantId);
    tables = buildTables(restaurantId, zoneIds);
    await insertTables(client, tables);
    await insertOperatingHours(client, restaurantId);
    await insertServicePeriods(client, restaurantId);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }

  const summary = tables.reduce(
    (acc, table) => {
      acc.total += 1;
      acc.byCapacity[table.capacity] = (acc.byCapacity[table.capacity] ?? 0) + 1;
      acc.byZone[table.section] = (acc.byZone[table.section] ?? 0) + 1;
      return acc;
    },
    { total: 0, byCapacity: {} as Record<number, number>, byZone: {} as Record<string, number> },
  );

  console.log('Update complete:');
  console.log(summary);
}

void main().catch((error) => {
  console.error(
    '[update-railway-zones-tables] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
