import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';
import { assertExactSupabaseApiProjectRef } from './db/safety';
import type { Database } from '../types/supabase';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const APPLY = process.argv.includes('--apply') || process.env.APPLY === 'true';
const CONFIRM_PRODUCTION = process.env.CONFIRM_PRODUCTION === 'true';
const EXPECTED_PROJECT_REF = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const SOURCE_SLUG = (process.env.SOURCE_SLUG ?? 'the-corner-house-pub-cambridge').trim();
const TARGET_NAME = (process.env.TARGET_NAME ?? 'The Railway Pub').trim();
const TARGET_RESTAURANT_ID = process.env.TARGET_RESTAURANT_ID?.trim() || null;
const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim();
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const OWNER_USER_ID = process.env.OWNER_USER_ID?.trim();

type TablesScope =
  | 'allowed_capacities'
  | 'restaurant_operating_hours'
  | 'restaurant_service_periods'
  | 'zones'
  | 'table_inventory'
  | 'table_adjacencies'
  | 'restaurant_capacity_rules';

type CopySummary = {
  table: TablesScope;
  rows: number;
  skipped?: boolean;
};

function requireEnv(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.',
    );
  }

  if (!SOURCE_SLUG) {
    throw new Error('SOURCE_SLUG is required.');
  }

  if (!TARGET_NAME) {
    throw new Error('TARGET_NAME is required.');
  }

  if (APPLY && !CONFIRM_PRODUCTION) {
    throw new Error(
      'APPLY requested without CONFIRM_PRODUCTION=true. Refusing to write in production.',
    );
  }

  if (!EXPECTED_PROJECT_REF) {
    throw new Error('EXPECTED_PROJECT_REF is required before using the service-role key.');
  }

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required.');
  }
  assertExactSupabaseApiProjectRef(url, EXPECTED_PROJECT_REF);
}

async function resolveOwnerId(supabase: SupabaseClient<Database>): Promise<string> {
  if (OWNER_USER_ID) {
    return OWNER_USER_ID;
  }

  if (OWNER_EMAIL) {
    if (!OWNER_PASSWORD) {
      throw new Error('OWNER_PASSWORD is required to create the owner user.');
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });

    if (error || !data.user?.id) {
      const message = error?.message ?? 'unknown error';
      if (/already|exists|duplicate/i.test(message)) {
        throw new Error(
          'Owner email already exists. Provide OWNER_USER_ID to continue without listing users.',
        );
      }
      throw new Error(`Failed to create owner user: ${message}`);
    }

    return data.user.id;
  }

  throw new Error('Set OWNER_USER_ID or OWNER_EMAIL to assign the new restaurant owner.');
}

async function loadSourceRestaurant(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', SOURCE_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch source restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Source restaurant not found for slug: ${SOURCE_SLUG}`);
  }

  return data;
}

async function getRestaurantCount(
  supabase: SupabaseClient<Database>,
  table: TablesScope,
  restaurantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table as keyof Database['public']['Tables'])
    .select('restaurant_id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function copyAllowedCapacities(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  apply: boolean,
): Promise<CopySummary> {
  if (apply) {
    const existing = await getRestaurantCount(supabase, 'allowed_capacities', targetId);
    if (existing > 0) {
      return { table: 'allowed_capacities', rows: existing, skipped: true };
    }
  }

  const { data, error } = await supabase
    .from('allowed_capacities')
    .select('capacity')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load allowed_capacities: ${error.message}`);
  }

  const payload = (data ?? []).map((row) => ({
    restaurant_id: targetId,
    capacity: row.capacity,
  }));

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase.from('allowed_capacities').insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert allowed_capacities: ${insertError.message}`);
    }
  }

  return { table: 'allowed_capacities', rows: payload.length };
}

async function copyOperatingHours(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  apply: boolean,
): Promise<CopySummary> {
  if (apply) {
    const existing = await getRestaurantCount(supabase, 'restaurant_operating_hours', targetId);
    if (existing > 0) {
      return { table: 'restaurant_operating_hours', rows: existing, skipped: true };
    }
  }

  const { data, error } = await supabase
    .from('restaurant_operating_hours')
    .select('*')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load restaurant_operating_hours: ${error.message}`);
  }

  const payload = (data ?? []).map((row) => ({
    id: randomUUID(),
    restaurant_id: targetId,
    day_of_week: row.day_of_week,
    effective_date: row.effective_date,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
    is_closed: row.is_closed,
    notes: row.notes,
  }));

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase
      .from('restaurant_operating_hours')
      .insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert restaurant_operating_hours: ${insertError.message}`);
    }
  }

  return { table: 'restaurant_operating_hours', rows: payload.length };
}

async function copyServicePeriods(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  apply: boolean,
): Promise<{ summary: CopySummary; map: Map<string, string> }> {
  const { data: sourceRows, error } = await supabase
    .from('restaurant_service_periods')
    .select('*')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load restaurant_service_periods: ${error.message}`);
  }

  const source = sourceRows ?? [];

  if (apply) {
    const existing = await getRestaurantCount(supabase, 'restaurant_service_periods', targetId);
    if (existing > 0) {
      const { data: targetRows, error: targetError } = await supabase
        .from('restaurant_service_periods')
        .select('id, name, day_of_week, start_time, end_time, booking_option')
        .eq('restaurant_id', targetId);

      if (targetError) {
        throw new Error(`Failed to load target service periods: ${targetError.message}`);
      }

      const targetByKey = new Map<string, string>();
      for (const row of targetRows ?? []) {
        const key = `${row.name}|${row.day_of_week ?? ''}|${row.start_time}|${row.end_time}|${row.booking_option}`;
        targetByKey.set(key, row.id);
      }

      const idMap = new Map<string, string>();
      for (const row of source) {
        const key = `${row.name}|${row.day_of_week ?? ''}|${row.start_time}|${row.end_time}|${row.booking_option}`;
        const targetMatch = targetByKey.get(key);
        if (!targetMatch) {
          throw new Error(
            `Missing service period match for "${row.name}" (${row.start_time}-${row.end_time})`,
          );
        }
        idMap.set(row.id, targetMatch);
      }

      return {
        summary: { table: 'restaurant_service_periods', rows: existing, skipped: true },
        map: idMap,
      };
    }
  }

  const idMap = new Map<string, string>();
  const payload = source.map((row) => {
    const id = randomUUID();
    idMap.set(row.id, id);
    return {
      id,
      restaurant_id: targetId,
      name: row.name,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      booking_option: row.booking_option,
    };
  });

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase
      .from('restaurant_service_periods')
      .insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert restaurant_service_periods: ${insertError.message}`);
    }
  }

  return { summary: { table: 'restaurant_service_periods', rows: payload.length }, map: idMap };
}

async function copyZones(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  apply: boolean,
): Promise<{ summary: CopySummary; map: Map<string, string> }> {
  const { data: sourceRows, error } = await supabase
    .from('zones')
    .select('*')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load zones: ${error.message}`);
  }

  const source = sourceRows ?? [];

  if (apply) {
    const existing = await getRestaurantCount(supabase, 'zones', targetId);
    if (existing > 0) {
      const { data: targetRows, error: targetError } = await supabase
        .from('zones')
        .select('id, name, sort_order')
        .eq('restaurant_id', targetId);

      if (targetError) {
        throw new Error(`Failed to load target zones: ${targetError.message}`);
      }

      const targetByKey = new Map<string, string>();
      for (const row of targetRows ?? []) {
        const key = `${row.name}|${row.sort_order ?? ''}`;
        targetByKey.set(key, row.id);
      }

      const idMap = new Map<string, string>();
      for (const row of source) {
        const key = `${row.name}|${row.sort_order ?? ''}`;
        const match = targetByKey.get(key);
        if (!match) {
          throw new Error(`Missing zone match for "${row.name}" (sort ${row.sort_order ?? '-'})`);
        }
        idMap.set(row.id, match);
      }

      return { summary: { table: 'zones', rows: existing, skipped: true }, map: idMap };
    }
  }

  const idMap = new Map<string, string>();
  const payload = source.map((row) => {
    const id = randomUUID();
    idMap.set(row.id, id);
    return {
      id,
      restaurant_id: targetId,
      name: row.name,
      sort_order: row.sort_order,
      active: row.active,
    };
  });

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase.from('zones').insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert zones: ${insertError.message}`);
    }
  }

  return { summary: { table: 'zones', rows: payload.length }, map: idMap };
}

async function copyTables(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  zoneMap: Map<string, string>,
  apply: boolean,
): Promise<{ summary: CopySummary; map: Map<string, string> }> {
  const { data: sourceRows, error } = await supabase
    .from('table_inventory')
    .select('*')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load table_inventory: ${error.message}`);
  }

  const source = sourceRows ?? [];

  if (apply) {
    const existing = await getRestaurantCount(supabase, 'table_inventory', targetId);
    if (existing > 0) {
      const { data: targetRows, error: targetError } = await supabase
        .from('table_inventory')
        .select('id, zone_id, table_number')
        .eq('restaurant_id', targetId);

      if (targetError) {
        throw new Error(`Failed to load target table_inventory: ${targetError.message}`);
      }

      const targetByKey = new Map<string, string>();
      for (const row of targetRows ?? []) {
        const key = `${row.zone_id}|${row.table_number}`;
        targetByKey.set(key, row.id);
      }

      const idMap = new Map<string, string>();
      for (const row of source) {
        const mappedZone = zoneMap.get(row.zone_id);
        if (!mappedZone) {
          throw new Error(`Missing zone mapping for table ${row.id}`);
        }
        const key = `${mappedZone}|${row.table_number}`;
        const match = targetByKey.get(key);
        if (!match) {
          throw new Error(`Missing table match for number ${row.table_number} in target zone.`);
        }
        idMap.set(row.id, match);
      }

      return { summary: { table: 'table_inventory', rows: existing, skipped: true }, map: idMap };
    }
  }

  const idMap = new Map<string, string>();
  const payload = source.map((row) => {
    const newZoneId = zoneMap.get(row.zone_id);
    if (!newZoneId) {
      throw new Error(`Missing zone mapping for table ${row.id}`);
    }

    const id = randomUUID();
    idMap.set(row.id, id);

    return {
      id,
      restaurant_id: targetId,
      zone_id: newZoneId,
      table_number: row.table_number,
      capacity: row.capacity,
      min_party_size: row.min_party_size,
      max_party_size: row.max_party_size,
      category: row.category,
      mobility: row.mobility,
      seating_type: row.seating_type,
      status: row.status,
      position: row.position,
      section: row.section,
      active: row.active,
      notes: row.notes,
    };
  });

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase.from('table_inventory').insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert table_inventory: ${insertError.message}`);
    }
  }

  return { summary: { table: 'table_inventory', rows: payload.length }, map: idMap };
}

async function copyTableAdjacencies(
  supabase: SupabaseClient<Database>,
  tableMap: Map<string, string>,
  apply: boolean,
): Promise<CopySummary> {
  if (tableMap.size === 0) {
    return { table: 'table_adjacencies', rows: 0 };
  }

  if (apply) {
    const targetIds = Array.from(tableMap.values());
    const inList = targetIds.join(',');
    const { count, error } = await supabase
      .from('table_adjacencies')
      .select('table_a', { count: 'exact', head: true })
      .or(`table_a.in.(${inList}),table_b.in.(${inList})`);

    if (error) {
      throw new Error(`Failed to count table_adjacencies: ${error.message}`);
    }

    if ((count ?? 0) > 0) {
      return { table: 'table_adjacencies', rows: count ?? 0, skipped: true };
    }
  }

  const sourceIds = Array.from(tableMap.keys());
  const sourceInList = sourceIds.join(',');
  const { data, error } = await supabase
    .from('table_adjacencies')
    .select('table_a, table_b')
    .or(`table_a.in.(${sourceInList}),table_b.in.(${sourceInList})`);

  if (error) {
    throw new Error(`Failed to load table_adjacencies: ${error.message}`);
  }

  const payload = (data ?? [])
    .map((row) => {
      const tableA = tableMap.get(row.table_a);
      const tableB = tableMap.get(row.table_b);
      if (!tableA || !tableB) {
        throw new Error(`Missing table mapping for adjacency ${row.table_a} -> ${row.table_b}`);
      }
      return {
        table_a: tableA,
        table_b: tableB,
      };
    })
    .filter((row): row is { table_a: string; table_b: string } => Boolean(row));

  if (apply && payload.length > 0) {
    const { error: insertError } = await supabase.from('table_adjacencies').insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert table_adjacencies: ${insertError.message}`);
    }
  }

  return { table: 'table_adjacencies', rows: payload.length };
}

async function copyCapacityRules(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  targetId: string,
  servicePeriodMap: Map<string, string>,
  apply: boolean,
): Promise<CopySummary> {
  if (apply) {
    const existing = await getRestaurantCount(supabase, 'restaurant_capacity_rules', targetId);
    if (existing > 0) {
      return { table: 'restaurant_capacity_rules', rows: existing, skipped: true };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('restaurant_capacity_rules')
    .select('*')
    .eq('restaurant_id', sourceId);

  if (error) {
    throw new Error(`Failed to load restaurant_capacity_rules: ${error.message}`);
  }

  type CapacityRuleRow = {
    id: string;
    service_period_id: string | null;
    day_of_week: number | null;
    effective_date: string | null;
    max_covers: number | null;
    max_parties: number | null;
    notes: string | null;
    label: string | null;
    override_type: string | null;
  };

  const payload = ((data ?? []) as CapacityRuleRow[]).map((row) => {
    const mappedServicePeriod = row.service_period_id
      ? servicePeriodMap.get(row.service_period_id)
      : null;

    if (row.service_period_id && !mappedServicePeriod) {
      throw new Error(`Missing service period mapping for capacity rule ${row.id}`);
    }

    return {
      id: randomUUID(),
      restaurant_id: targetId,
      service_period_id: mappedServicePeriod,
      day_of_week: row.day_of_week,
      effective_date: row.effective_date,
      max_covers: row.max_covers,
      max_parties: row.max_parties,
      notes: row.notes,
      label: row.label,
      override_type: row.override_type,
    };
  });

  if (apply && payload.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('restaurant_capacity_rules')
      .insert(payload);
    if (insertError) {
      throw new Error(`Failed to insert restaurant_capacity_rules: ${insertError.message}`);
    }
  }

  return { table: 'restaurant_capacity_rules', rows: payload.length };
}

async function main(): Promise<void> {
  requireEnv();

  const [
    { createRestaurant },
    { createRestaurantSchema },
    { getServiceSupabaseClient, resolveServiceRoleSupabaseUrl },
  ] = await Promise.all([
    import('../server/restaurants/create'),
    import('../src/app/api/ops/restaurants/schema'),
    import('../server/supabase'),
  ]);

  assertExactSupabaseApiProjectRef(resolveServiceRoleSupabaseUrl(), EXPECTED_PROJECT_REF!);

  const supabase = getServiceSupabaseClient();
  const sourceRestaurant = await loadSourceRestaurant(supabase);

  const seedInput = {
    name: TARGET_NAME,
    timezone: sourceRestaurant.timezone,
    capacity: sourceRestaurant.capacity,
    contactEmail: sourceRestaurant.contact_email,
    contactPhone: sourceRestaurant.contact_phone,
    address: sourceRestaurant.address,
    googleMapUrl: sourceRestaurant.google_map_url,
    googleReviewUrl: sourceRestaurant.google_review_url,
    bookingPolicy: sourceRestaurant.booking_policy,
    logoUrl: sourceRestaurant.logo_url,
    emailSendReminder24h: sourceRestaurant.email_send_reminder_24h,
    emailSendReminderShort: sourceRestaurant.email_send_reminder_short,
    emailSendReviewRequest: sourceRestaurant.email_send_review_request,
    reservationIntervalMinutes: sourceRestaurant.reservation_interval_minutes,
    reservationDefaultDurationMinutes: sourceRestaurant.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes:
      sourceRestaurant.reservation_last_seating_buffer_minutes ?? undefined,
    reservationLifecycleGraceMinutes: sourceRestaurant.reservation_lifecycle_grace_minutes,
  };

  const validated = createRestaurantSchema.parse(seedInput);
  const restaurantId = APPLY ? undefined : randomUUID();
  let ownerId = APPLY ? 'unknown' : 'dry-run';
  let restaurant: { id: string; name: string; slug: string } | null = null;

  if (APPLY && TARGET_RESTAURANT_ID) {
    const { data: existing, error: existingError } = await supabase
      .from('restaurants')
      .select('id, name, slug')
      .eq('id', TARGET_RESTAURANT_ID)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to load target restaurant: ${existingError.message}`);
    }

    if (!existing) {
      throw new Error(`TARGET_RESTAURANT_ID not found: ${TARGET_RESTAURANT_ID}`);
    }

    restaurant = existing;
    ownerId = 'existing';
  } else if (APPLY) {
    ownerId = await resolveOwnerId(supabase);
    restaurant = await createRestaurant(validated, ownerId, supabase);
  }

  const targetId = restaurant?.id ?? restaurantId!;

  const summary: CopySummary[] = [];
  summary.push(await copyAllowedCapacities(supabase, sourceRestaurant.id, targetId, APPLY));
  summary.push(await copyOperatingHours(supabase, sourceRestaurant.id, targetId, APPLY));

  const servicePeriods = await copyServicePeriods(supabase, sourceRestaurant.id, targetId, APPLY);
  summary.push(servicePeriods.summary);

  const zones = await copyZones(supabase, sourceRestaurant.id, targetId, APPLY);
  summary.push(zones.summary);

  const tables = await copyTables(supabase, sourceRestaurant.id, targetId, zones.map, APPLY);
  summary.push(tables.summary);

  summary.push(await copyTableAdjacencies(supabase, tables.map, APPLY));
  summary.push(
    await copyCapacityRules(supabase, sourceRestaurant.id, targetId, servicePeriods.map, APPLY),
  );

  console.log('Seed summary:');
  console.table(
    summary.map((item) => ({
      table: item.table,
      rows: item.rows,
      applied: APPLY,
      skipped: item.skipped ?? false,
    })),
  );

  console.log('New restaurant:');
  console.log({
    id: restaurant?.id ?? '(dry-run)',
    name: restaurant?.name ?? TARGET_NAME,
    slug: restaurant?.slug ?? '(auto-generated on apply)',
    ownerId,
    sourceSlug: SOURCE_SLUG,
  });
}

void main().catch((error) => {
  console.error(
    '[seed-railway-from-cornerhouse] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
