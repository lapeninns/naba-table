import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { assertExactSupabaseApiProjectRef } from './db/safety';

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  google_map_url: string | null;
  google_review_url: string | null;
  booking_policy: string | null;
  logo_url: string | null;
  email_send_reminder_24h: boolean | null;
  email_send_reminder_short: boolean | null;
  email_send_review_request: boolean | null;
  reservation_interval_minutes: number;
  reservation_default_duration_minutes: number;
  reservation_last_seating_buffer_minutes: number | null;
  reservation_lifecycle_grace_minutes: number | null;
};

type MembershipRow = {
  user_id: string;
  role: string;
};

type AllowedCapacityRow = {
  capacity: number;
};

type ZoneRow = {
  id: string;
  name: string;
  sort_order: number | null;
  active: boolean | null;
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

type TableAdjacencyRow = {
  table_a: string;
  table_b: string;
};

type TurnBandRow = {
  booking_option: string;
  max_party_size: number;
  duration_minutes: number;
};

type TargetWeeklyHour = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};

type ServicePeriodSeed = {
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  bookingOption: 'lunch' | 'dinner';
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const defaultEnvPath = path.join(projectRoot, '.env.vercel-production.live');

if (fs.existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: false });
}

const apply = process.env.APPLY === 'true';
const confirmProduction = process.env.CONFIRM_PRODUCTION === 'true';
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || 'vrdiqfudmwydclqpydee';

const sourceSlug = process.env.SOURCE_SLUG?.trim() || 'the-old-crown-girton';
const targetSlug = process.env.TARGET_SLUG?.trim() || 'the-old-school-house-stony-stratford';

const supabaseUrl =
  process.env.PRODUCTION_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const targetRestaurant = {
  name: 'The Old School House',
  slug: targetSlug,
  timezone: 'Europe/London',
  address: 'London Rd, Stony Stratford, Milton Keynes MK11 1JA',
  contactPhone: '01908 561936',
  contactEmail: 'oldschoolhouse@lapeninns.com',
  googleMapUrl:
    'https://www.google.com/maps/dir/?api=1&destination=London%20Rd%2C%20Stony%20Stratford%2C%20Milton%20Keynes%20MK11%201JA&travelmode=driving',
  googleReviewUrl: null as string | null,
};

const targetWeeklyHours: TargetWeeklyHour[] = [
  { dayOfWeek: 0, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 1, opensAt: '12:00:00', closesAt: '23:00:00' },
  { dayOfWeek: 2, opensAt: '12:00:00', closesAt: '23:00:00' },
  { dayOfWeek: 3, opensAt: '12:00:00', closesAt: '23:00:00' },
  { dayOfWeek: 4, opensAt: '12:00:00', closesAt: '23:00:00' },
  { dayOfWeek: 5, opensAt: '12:00:00', closesAt: '23:59:00' },
  { dayOfWeek: 6, opensAt: '12:00:00', closesAt: '23:59:00' },
];

const targetKitchenHours: TargetWeeklyHour[] = [
  { dayOfWeek: 0, opensAt: '12:00:00', closesAt: '20:00:00' },
  { dayOfWeek: 1, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 2, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 3, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 4, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 5, opensAt: '12:00:00', closesAt: '21:00:00' },
  { dayOfWeek: 6, opensAt: '12:00:00', closesAt: '21:00:00' },
];

function buildServicePeriodsFromKitchen(): ServicePeriodSeed[] {
  return targetKitchenHours.flatMap((row) => [
    {
      name: `${labelForDay(row.dayOfWeek)} Lunch`,
      dayOfWeek: row.dayOfWeek,
      startTime: '12:00:00',
      endTime: '17:00:00',
      bookingOption: 'lunch',
    },
    {
      name: `${labelForDay(row.dayOfWeek)} Dinner`,
      dayOfWeek: row.dayOfWeek,
      startTime: '17:00:00',
      endTime: row.closesAt,
      bookingOption: 'dinner',
    },
  ]);
}

function labelForDay(day: number): string {
  return (
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ??
    `Day ${day}`
  );
}

function shouldIgnoreMissingTable(message: string | null | undefined): boolean {
  return (
    typeof message === 'string' &&
    /schema cache|does not exist|relation .* does not exist/i.test(message)
  );
}

function isAdjacencyEligible(
  table: Pick<TableRow, 'zone_id' | 'active' | 'capacity' | 'status' | 'mobility'>,
): boolean {
  if (!table.zone_id) return false;
  if (table.active === false) return false;
  if ((table.capacity ?? 0) <= 0) return false;

  const status = String(table.status ?? 'available').toLowerCase();
  if (status === 'out_of_service' || status === 'maintenance') return false;

  const mobility =
    typeof table.mobility === 'string' ? table.mobility.trim().toLowerCase() : 'movable';
  return mobility !== 'fixed';
}

function projectAdjacencyRows(
  tables: Array<Pick<TableRow, 'zone_id' | 'active' | 'capacity' | 'status' | 'mobility'>>,
) {
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

async function ensureTargetAbsent(): Promise<void> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', targetRestaurant.slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check target slug: ${error.message}`);
  }

  if (data?.id) {
    throw new Error(`Target slug already exists: ${targetRestaurant.slug}`);
  }
}

async function loadSourceRestaurant(): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'id,name,slug,timezone,capacity,contact_email,contact_phone,address,google_map_url,google_review_url,booking_policy,logo_url,email_send_reminder_24h,email_send_reminder_short,email_send_review_request,reservation_interval_minutes,reservation_default_duration_minutes,reservation_last_seating_buffer_minutes,reservation_lifecycle_grace_minutes',
    )
    .eq('slug', sourceSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load source restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Source restaurant not found: ${sourceSlug}`);
  }

  return data as RestaurantRow;
}

async function loadSourceMemberships(restaurantId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from('restaurant_memberships')
    .select('user_id,role')
    .eq('restaurant_id', restaurantId)
    .in('role', ['owner', 'manager']);

  if (error) {
    throw new Error(`Failed to load source memberships: ${error.message}`);
  }

  return (data ?? []) as MembershipRow[];
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

  const explicit = ((data ?? []) as AllowedCapacityRow[]).map((row) => row.capacity);
  if (explicit.length > 0) {
    return explicit;
  }

  const { data: tables, error: tablesError } = await supabase
    .from('table_inventory')
    .select('capacity')
    .eq('restaurant_id', restaurantId)
    .order('capacity', { ascending: true });

  if (tablesError) {
    throw new Error(`Failed to derive capacities from tables: ${tablesError.message}`);
  }

  return Array.from(new Set((tables ?? []).map((row) => row.capacity as number)));
}

async function loadSourceZones(restaurantId: string): Promise<ZoneRow[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('id,name,sort_order,active')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to load source zones: ${error.message}`);
  }

  return (data ?? []) as ZoneRow[];
}

async function loadSourceTables(restaurantId: string): Promise<TableRow[]> {
  const { data, error } = await supabase
    .from('table_inventory')
    .select(
      'id,zone_id,table_number,capacity,min_party_size,max_party_size,section,status,position,notes,category,seating_type,mobility,active',
    )
    .eq('restaurant_id', restaurantId)
    .order('table_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load source tables: ${error.message}`);
  }

  return (data ?? []) as TableRow[];
}

async function loadSourceAdjacencies(tableIds: string[]): Promise<TableAdjacencyRow[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('table_adjacencies')
    .select('table_a,table_b')
    .in('table_a', tableIds)
    .in('table_b', tableIds);

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to load source adjacencies: ${error.message}`);
  }

  return (data ?? []) as TableAdjacencyRow[];
}

async function loadSourceTurnBands(restaurantId: string): Promise<TurnBandRow[]> {
  const { data, error } = await supabase
    .from('restaurant_turn_bands')
    .select('booking_option,max_party_size,duration_minutes')
    .eq('restaurant_id', restaurantId)
    .order('booking_option', { ascending: true })
    .order('max_party_size', { ascending: true });

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to load source turn bands: ${error.message}`);
  }

  return (data ?? []) as TurnBandRow[];
}

async function cleanupTargetById(restaurantId: string): Promise<void> {
  const { data: tables } = await supabase
    .from('table_inventory')
    .select('id')
    .eq('restaurant_id', restaurantId);
  const tableIds = (tables ?? []).map((row) => row.id as string);

  if (tableIds.length > 0) {
    const { error: adjacencyError } = await supabase
      .from('table_adjacencies')
      .delete()
      .in('table_a', tableIds)
      .in('table_b', tableIds);
    if (adjacencyError && !shouldIgnoreMissingTable(adjacencyError.message)) {
      console.error(
        '[clone-restaurant-config] cleanup adjacency delete failed',
        adjacencyError.message,
      );
    }
  }

  const deletions: Array<{ table: string; ignoreMissing?: boolean }> = [
    { table: 'table_inventory' },
    { table: 'zones' },
    { table: 'allowed_capacities', ignoreMissing: true },
    { table: 'restaurant_turn_bands', ignoreMissing: true },
    { table: 'restaurant_service_periods' },
    { table: 'restaurant_operating_hours' },
    { table: 'restaurant_memberships' },
  ];

  for (const deletion of deletions) {
    const { error } = await supabase
      .from(deletion.table)
      .delete()
      .eq('restaurant_id', restaurantId);
    if (error && !(deletion.ignoreMissing && shouldIgnoreMissingTable(error.message))) {
      console.error(
        `[clone-restaurant-config] cleanup failed for ${deletion.table}`,
        error.message,
      );
    }
  }

  const { error: deleteRestaurantError } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', restaurantId);
  if (deleteRestaurantError) {
    console.error(
      '[clone-restaurant-config] cleanup failed for restaurants',
      deleteRestaurantError.message,
    );
  }
}

async function insertRestaurant(source: RestaurantRow): Promise<string> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      name: targetRestaurant.name,
      slug: targetRestaurant.slug,
      timezone: targetRestaurant.timezone,
      capacity: source.capacity,
      contact_email: targetRestaurant.contactEmail,
      contact_phone: targetRestaurant.contactPhone,
      address: targetRestaurant.address,
      google_map_url: targetRestaurant.googleMapUrl,
      google_review_url: targetRestaurant.googleReviewUrl,
      booking_policy: source.booking_policy,
      logo_url: source.logo_url,
      email_send_reminder_24h: source.email_send_reminder_24h ?? true,
      email_send_reminder_short: source.email_send_reminder_short ?? true,
      email_send_review_request: source.email_send_review_request ?? true,
      reservation_interval_minutes: source.reservation_interval_minutes,
      reservation_default_duration_minutes: source.reservation_default_duration_minutes,
      reservation_last_seating_buffer_minutes: source.reservation_last_seating_buffer_minutes,
      reservation_lifecycle_grace_minutes: source.reservation_lifecycle_grace_minutes ?? 15,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`Failed to insert target restaurant: ${error?.message ?? 'unknown error'}`);
  }

  return data.id as string;
}

async function insertMemberships(
  restaurantId: string,
  memberships: MembershipRow[],
): Promise<void> {
  if (memberships.length === 0) {
    return;
  }

  const payload = memberships.map((membership) => ({
    restaurant_id: restaurantId,
    user_id: membership.user_id,
    role: membership.role,
  }));

  const { error } = await supabase.from('restaurant_memberships').insert(payload);
  if (error) {
    throw new Error(`Failed to copy memberships: ${error.message}`);
  }
}

async function insertAllowedCapacities(restaurantId: string, capacities: number[]): Promise<void> {
  if (capacities.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('allowed_capacities')
    .insert(capacities.map((capacity) => ({ restaurant_id: restaurantId, capacity })));

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to insert allowed capacities: ${error.message}`);
  }
}

async function insertWeeklyHours(restaurantId: string): Promise<void> {
  const payload = targetWeeklyHours.map((row) => ({
    restaurant_id: restaurantId,
    day_of_week: row.dayOfWeek,
    effective_date: null,
    opens_at: row.opensAt,
    closes_at: row.closesAt,
    is_closed: false,
    notes: null,
    reservation_interval_minutes: null,
    reservation_slot_times: null,
  }));

  const { error } = await supabase.from('restaurant_operating_hours').insert(payload);
  if (error) {
    throw new Error(`Failed to insert weekly hours: ${error.message}`);
  }
}

async function insertServicePeriods(restaurantId: string): Promise<void> {
  const periods = buildServicePeriodsFromKitchen();
  const { error } = await supabase.from('restaurant_service_periods').insert(
    periods.map((period) => ({
      id: randomUUID(),
      restaurant_id: restaurantId,
      name: period.name,
      day_of_week: period.dayOfWeek,
      start_time: period.startTime,
      end_time: period.endTime,
      booking_option: period.bookingOption,
    })),
  );

  if (error) {
    throw new Error(`Failed to insert service periods: ${error.message}`);
  }
}

async function insertTurnBands(restaurantId: string, turnBands: TurnBandRow[]): Promise<void> {
  if (turnBands.length === 0) {
    return;
  }

  const { error } = await supabase.from('restaurant_turn_bands').insert(
    turnBands.map((band) => ({
      restaurant_id: restaurantId,
      booking_option: band.booking_option,
      max_party_size: band.max_party_size,
      duration_minutes: band.duration_minutes,
    })),
  );

  if (error && !shouldIgnoreMissingTable(error.message)) {
    throw new Error(`Failed to insert turn bands: ${error.message}`);
  }
}

async function insertZones(restaurantId: string, zones: ZoneRow[]): Promise<Map<string, string>> {
  const zoneMap = new Map<string, string>();
  const payload = zones.map((zone) => {
    const newId = randomUUID();
    zoneMap.set(zone.id, newId);
    return {
      id: newId,
      restaurant_id: restaurantId,
      name: zone.name,
      sort_order: zone.sort_order ?? 0,
      active: zone.active ?? true,
    };
  });

  if (payload.length === 0) {
    return zoneMap;
  }

  const { error } = await supabase.from('zones').insert(payload);
  if (error) {
    throw new Error(`Failed to insert zones: ${error.message}`);
  }

  return zoneMap;
}

async function insertTables(
  restaurantId: string,
  tables: TableRow[],
  zoneMap: Map<string, string>,
): Promise<Map<string, string>> {
  const tableMap = new Map<string, string>();
  const payload = tables.map((table) => {
    const newId = randomUUID();
    tableMap.set(table.id, newId);
    return {
      id: newId,
      restaurant_id: restaurantId,
      zone_id: table.zone_id ? (zoneMap.get(table.zone_id) ?? null) : null,
      table_number: table.table_number,
      capacity: table.capacity,
      min_party_size: table.min_party_size,
      max_party_size: table.max_party_size,
      section: table.section,
      status: table.status ?? 'available',
      position: table.position ?? null,
      notes: table.notes,
      category: table.category ?? 'dining',
      seating_type: table.seating_type ?? 'standard',
      mobility: table.mobility,
      active: table.active ?? true,
    };
  });

  if (payload.length === 0) {
    return tableMap;
  }

  const { error } = await supabase.from('table_inventory').insert(payload);
  if (error) {
    throw new Error(`Failed to insert tables: ${error.message}`);
  }

  return tableMap;
}

async function verifyClone(expectedAdjacencyRows: number): Promise<Record<string, unknown>> {
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id,name,slug,address,contact_email,google_map_url')
    .eq('slug', targetRestaurant.slug)
    .maybeSingle();

  if (restaurantError || !restaurant?.id) {
    throw new Error(`Verification failed: ${restaurantError?.message ?? 'target not found'}`);
  }

  const restaurantId = restaurant.id as string;
  const { data: targetTables, error: targetTablesError } = await supabase
    .from('table_inventory')
    .select('id,zone_id,capacity,status,mobility,active')
    .eq('restaurant_id', restaurantId);

  if (targetTablesError) {
    throw new Error(`Verification failed to load target tables: ${targetTablesError.message}`);
  }

  const tableRows = (targetTables ?? []) as Array<
    Pick<TableRow, 'id' | 'zone_id' | 'capacity' | 'status' | 'mobility' | 'active'>
  >;
  const tableIds = tableRows.map((row) => row.id);
  const adjacencyResult =
    tableIds.length > 0
      ? await supabase
          .from('table_adjacencies')
          .select('table_a,table_b', { count: 'exact', head: true })
          .in('table_a', tableIds)
          .in('table_b', tableIds)
      : { count: 0, error: null };

  if (adjacencyResult.error && !shouldIgnoreMissingTable(adjacencyResult.error.message)) {
    throw new Error(
      `Verification failed to count adjacency rows: ${adjacencyResult.error.message}`,
    );
  }

  const adjacencyRows = adjacencyResult.count ?? 0;
  if (adjacencyRows !== expectedAdjacencyRows) {
    throw new Error(
      `Verification failed: expected ${expectedAdjacencyRows} adjacency rows, received ${adjacencyRows}.`,
    );
  }

  const [hours, periods, zones, tables, memberships] = await Promise.all([
    supabase
      .from('restaurant_operating_hours')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .is('effective_date', null),
    supabase
      .from('restaurant_service_periods')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('zones')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('table_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('restaurant_memberships')
      .select('user_id,role')
      .eq('restaurant_id', restaurantId),
  ]);

  return {
    restaurant,
    weeklyHours: hours.count ?? 0,
    servicePeriods: periods.count ?? 0,
    zones: zones.count ?? 0,
    tables: tables.count ?? 0,
    memberships: memberships.data ?? [],
    expectedAdjacencyRows,
    adjacencyRowsWhereTableAInTarget: adjacencyRows,
  };
}

async function main(): Promise<void> {
  const source = await loadSourceRestaurant();
  const [memberships, capacities, zones, tables, turnBands] = await Promise.all([
    loadSourceMemberships(source.id),
    loadAllowedCapacities(source.id),
    loadSourceZones(source.id),
    loadSourceTables(source.id),
    loadSourceTurnBands(source.id),
  ]);
  const adjacencies = await loadSourceAdjacencies(tables.map((table) => table.id));
  const adjacencyProjection = projectAdjacencyRows(tables);

  const plan = {
    source: {
      slug: source.slug,
      id: source.id,
      capacities,
      zones: zones.length,
      tables: tables.length,
      adjacencies: adjacencies.length,
      adjacencyProjection,
      memberships,
      turnBands: turnBands.length,
    },
    target: {
      slug: targetRestaurant.slug,
      name: targetRestaurant.name,
      weeklyHours: targetWeeklyHours,
      servicePeriods: buildServicePeriodsFromKitchen(),
    },
    apply,
  };

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, plan }, null, 2));
    return;
  }

  await ensureTargetAbsent();

  let insertedRestaurantId: string | null = null;
  try {
    const restaurantId = await insertRestaurant(source);
    insertedRestaurantId = restaurantId;
    await insertMemberships(restaurantId, memberships);
    await insertAllowedCapacities(restaurantId, capacities);
    await insertWeeklyHours(restaurantId);
    await insertServicePeriods(restaurantId);
    await insertTurnBands(restaurantId, turnBands);
    const zoneMap = await insertZones(restaurantId, zones);
    await insertTables(restaurantId, tables, zoneMap);

    const verification = await verifyClone(adjacencyProjection.totalRows);
    console.log(JSON.stringify({ applied: true, verification }, null, 2));
  } catch (error) {
    if (insertedRestaurantId) {
      await cleanupTargetById(insertedRestaurantId);
    }
    throw error;
  }
}

void main().catch((error) => {
  console.error(
    '[clone-restaurant-config] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
