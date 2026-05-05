import { randomUUID } from 'crypto';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { getPgSslConfig } from '../db/pg-ssl';

type Args = {
  apply: boolean;
  expectedProjectRef: string;
  sourceSlug: string;
  seedTag: string;
  restaurantCount: number;
  customersPerRestaurant: number;
  daysPast: number;
  daysFuture: number;
  bookingsPerDay: number;
  assignmentRate: number; // 0..1
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '../..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply') || process.env.APPLY === 'true';

  const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || 'ndxmivcrehsacuerwxtm';
  const sourceSlug = process.env.SOURCE_SLUG?.trim() || 'the-old-crown-girton';
  const seedTag =
    process.env.SEED_TAG?.trim() || new Date().toISOString().slice(0, 10).replaceAll('-', '');

  const restaurantCount = parseNumber(process.env.RESTAURANT_COUNT, 50);
  const customersPerRestaurant = parseNumber(process.env.CUSTOMERS_PER_RESTAURANT, 250);
  const daysPast = parseNumber(process.env.DAYS_PAST, 14);
  const daysFuture = parseNumber(process.env.DAYS_FUTURE, 7);
  const bookingsPerDay = parseNumber(process.env.BOOKINGS_PER_DAY, 15);
  const assignmentRate = parseNumber(process.env.ASSIGNMENT_RATE, 0.4);

  return {
    apply,
    expectedProjectRef,
    sourceSlug,
    seedTag,
    restaurantCount,
    customersPerRestaurant,
    daysPast,
    daysFuture,
    bookingsPerDay,
    assignmentRate: Math.max(0, Math.min(1, assignmentRate)),
  };
}

function requireFile(p: string): string {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${p}`);
  }
  return fs.readFileSync(p, 'utf8').trim();
}

function buildPgConnectionString(): string {
  const poolerPath = path.join(projectRoot, 'supabase/.temp/pooler-url');
  const pooler = fs.existsSync(poolerPath) ? requireFile(poolerPath) : null;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD is required in .env.local for direct Postgres seeding.');
  }

  const base = pooler || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Missing supabase/.temp/pooler-url and SUPABASE_DB_URL/DATABASE_URL. Link the project or set SUPABASE_DB_URL.',
    );
  }

  const u = new URL(base);
  u.password = password;
  return u.toString();
}

function assertStaging(apply: boolean, expectedProjectRef: string): void {
  if (!apply) return;
  const projectRefPath = path.join(projectRoot, 'supabase/.temp/project-ref');
  if (!fs.existsSync(projectRefPath)) {
    throw new Error(
      'Missing supabase/.temp/project-ref. Run `supabase link --project-ref <ref>` before applying seed data.',
    );
  }
  const actual = requireFile(projectRefPath);
  if (actual !== expectedProjectRef) {
    throw new Error(
      `Refusing to apply seed data: linked project ref (${actual}) != expected (${expectedProjectRef}).`,
    );
  }
}

function formatSeedSlug(i: number): string {
  return `seed-perf-r${String(i).padStart(3, '0')}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function randomInt(min: number, maxInclusive: number): number {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function timeToIsoZ(dateStr: string, hh: number, mm: number): string {
  // Interpret as UTC for repeatability; we're not modeling DST here.
  return `${dateStr}T${pad2(hh)}:${pad2(mm)}:00.000Z`;
}

async function insertMany(
  client: Client,
  opts: {
    table: string;
    columns: string[];
    rows: unknown[][];
    onConflictSql?: string;
    chunkSize?: number;
  },
): Promise<number> {
  const { table, columns, rows, onConflictSql, chunkSize = 200 } = opts;
  if (rows.length === 0) return 0;

  let inserted = 0;

  for (const part of chunk(rows, chunkSize)) {
    const values: unknown[] = [];
    const placeholders = part
      .map((row, rowIdx) => {
        const base = rowIdx * columns.length;
        row.forEach((v) => values.push(v));
        const cols = columns.map((_, colIdx) => `$${base + colIdx + 1}`).join(', ');
        return `(${cols})`;
      })
      .join(', ');

    const sql = `insert into ${table} (${columns.join(', ')}) values ${placeholders} ${
      onConflictSql ?? ''
    }`;

    const res = await client.query(sql, values);
    inserted += res.rowCount ?? 0;
  }

  return inserted;
}

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  reservation_interval_minutes: number;
  reservation_default_duration_minutes: number;
  reservation_last_seating_buffer_minutes: number;
  reservation_lifecycle_grace_minutes: number | null;
};

async function resolveSourceRestaurant(client: Client, slug: string): Promise<RestaurantRow> {
  const res = await client.query<RestaurantRow>(
    `
      select
        id, name, slug, timezone, capacity,
        reservation_interval_minutes,
        reservation_default_duration_minutes,
        reservation_last_seating_buffer_minutes,
        reservation_lifecycle_grace_minutes
      from public.restaurants
      where slug = $1
      limit 1
    `,
    [slug],
  );

  if (res.rows.length === 0) {
    throw new Error(`Source restaurant not found by slug: ${slug}`);
  }

  return res.rows[0];
}

async function resolveOwnerUserId(client: Client): Promise<string> {
  const explicit = process.env.OWNER_USER_ID?.trim();
  if (explicit) return explicit;

  const res = await client.query<{ id: string }>(
    `select id from auth.users order by created_at asc limit 1`,
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error('No auth users found; set OWNER_USER_ID to seed memberships.');
  return id;
}

async function ensureSeedRestaurants(
  client: Client,
  args: Args,
  source: RestaurantRow,
  ownerUserId: string,
): Promise<{ id: string; slug: string }[]> {
  const targets = Array.from({ length: args.restaurantCount }, (_, i) => ({
    slug: formatSeedSlug(i + 1),
    name: `Seed Perf Restaurant ${String(i + 1).padStart(3, '0')}`,
  }));

  const out: { id: string; slug: string }[] = [];

  for (const t of targets) {
    const r = await client.query<{ id: string }>(
      `
        insert into public.restaurants (
          slug,
          name,
          timezone,
          capacity,
          reservation_interval_minutes,
          reservation_default_duration_minutes,
          reservation_last_seating_buffer_minutes,
          reservation_lifecycle_grace_minutes
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (slug) do update
          set name = excluded.name
        returning id
      `,
      [
        t.slug,
        t.name,
        source.timezone,
        source.capacity,
        source.reservation_interval_minutes,
        source.reservation_default_duration_minutes,
        source.reservation_last_seating_buffer_minutes,
        source.reservation_lifecycle_grace_minutes,
      ],
    );

    const id = r.rows[0]?.id;
    if (!id) {
      throw new Error(`Failed to upsert restaurant for slug=${t.slug}`);
    }

    await client.query(
      `
        insert into public.restaurant_memberships (user_id, restaurant_id, role)
        values ($1,$2,'owner')
        on conflict do nothing
      `,
      [ownerUserId, id],
    );

    out.push({ id, slug: t.slug });
  }

  return out;
}

type ZoneRow = { id: string; name: string; sort_order: number; active: boolean };
type ServicePeriodRow = {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  booking_option: string;
};
type TurnBandRow = { booking_option: string; max_party_size: number; duration_minutes: number };
type OperatingHourRow = {
  day_of_week: number | null;
  effective_date: string | null;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  notes: string | null;
  reservation_interval_minutes: number | null;
  reservation_slot_times: string[] | null;
};
type AllowedCapacityRow = { capacity: number };
type TableInventoryRow = {
  id: string;
  table_number: string;
  capacity: number;
  section: string | null;
  status: string;
  position: unknown | null;
  notes: string | null;
  zone_id: string;
  category: string;
  seating_type: string;
  mobility: string;
  active: boolean;
  min_party_size: number;
  max_party_size: number | null;
};
type TableAdjacencyRow = { table_a: string; table_b: string };
type CapacityRuleRow = {
  service_period_id: string | null;
  day_of_week: number | null;
  effective_date: string | null;
  max_covers: number | null;
  max_parties: number | null;
  notes: string | null;
  label: string | null;
  override_type: string | null;
};

async function copyRestaurantConfig(
  client: Client,
  sourceRestaurantId: string,
  targetRestaurantId: string,
): Promise<{ copied: boolean; rows: Record<string, number> }> {
  const rows: Record<string, number> = {};

  const existingTables = await client.query<{ n: number }>(
    `select count(*)::int as n from public.table_inventory where restaurant_id=$1`,
    [targetRestaurantId],
  );
  if ((existingTables.rows[0]?.n ?? 0) > 0) {
    return { copied: false, rows: {} };
  }

  const [zones, periods, turnBands, hours, allowedCaps, tables, adjs, rules] = await Promise.all([
    client.query<ZoneRow>(
      `select id, name, sort_order, active from public.zones where restaurant_id=$1 order by sort_order asc, name asc`,
      [sourceRestaurantId],
    ),
    client.query<ServicePeriodRow>(
      `select id, name, day_of_week, start_time::text as start_time, end_time::text as end_time, booking_option
       from public.restaurant_service_periods where restaurant_id=$1 order by start_time asc`,
      [sourceRestaurantId],
    ),
    client.query<TurnBandRow>(
      `select booking_option, max_party_size, duration_minutes
       from public.restaurant_turn_bands where restaurant_id=$1 order by booking_option asc, max_party_size asc`,
      [sourceRestaurantId],
    ),
    client.query<OperatingHourRow>(
      `select day_of_week, effective_date::text as effective_date, opens_at::text as opens_at, closes_at::text as closes_at,
              is_closed, notes, reservation_interval_minutes, reservation_slot_times::text[] as reservation_slot_times
       from public.restaurant_operating_hours where restaurant_id=$1 order by effective_date nulls first, day_of_week nulls first`,
      [sourceRestaurantId],
    ),
    client.query<AllowedCapacityRow>(
      `select capacity from public.allowed_capacities where restaurant_id=$1 order by capacity asc`,
      [sourceRestaurantId],
    ),
    client.query<TableInventoryRow>(
      `select id, table_number, capacity, section, status::text as status, position, notes, zone_id, category::text as category,
              seating_type::text as seating_type, mobility::text as mobility, active, min_party_size, max_party_size
       from public.table_inventory where restaurant_id=$1 order by table_number asc`,
      [sourceRestaurantId],
    ),
    client
      .query<TableAdjacencyRow>(
        `select table_a, table_b from public.table_adjacencies where table_a in (select id from public.table_inventory where restaurant_id=$1)`,
        [sourceRestaurantId],
      )
      .catch(() => ({ rows: [] as TableAdjacencyRow[] })),
    client.query<CapacityRuleRow>(
      `select service_period_id, day_of_week, effective_date::text as effective_date, max_covers, max_parties, notes, label, override_type::text as override_type
       from public.restaurant_capacity_rules where restaurant_id=$1`,
      [sourceRestaurantId],
    ),
  ]);

  const zoneMap = new Map<string, string>();
  const periodMap = new Map<string, string>();
  const tableMap = new Map<string, string>();

  const zoneInserts = zones.rows.map((z) => {
    const id = randomUUID();
    zoneMap.set(z.id, id);
    return [id, targetRestaurantId, z.name, z.sort_order, z.active];
  });
  rows.zones = await insertMany(client, {
    table: 'public.zones',
    columns: ['id', 'restaurant_id', 'name', 'sort_order', 'active'],
    rows: zoneInserts,
  });

  const periodInserts = periods.rows.map((p) => {
    const id = randomUUID();
    periodMap.set(p.id, id);
    return [
      id,
      targetRestaurantId,
      p.name,
      p.day_of_week,
      p.start_time,
      p.end_time,
      p.booking_option,
    ];
  });
  rows.restaurant_service_periods = await insertMany(client, {
    table: 'public.restaurant_service_periods',
    columns: [
      'id',
      'restaurant_id',
      'name',
      'day_of_week',
      'start_time',
      'end_time',
      'booking_option',
    ],
    rows: periodInserts,
  });

  const bandInserts = turnBands.rows.map((b) => [
    randomUUID(),
    targetRestaurantId,
    b.booking_option,
    b.max_party_size,
    b.duration_minutes,
  ]);
  rows.restaurant_turn_bands = await insertMany(client, {
    table: 'public.restaurant_turn_bands',
    columns: ['id', 'restaurant_id', 'booking_option', 'max_party_size', 'duration_minutes'],
    rows: bandInserts,
  });

  const hoursInserts = hours.rows.map((h) => [
    randomUUID(),
    targetRestaurantId,
    h.day_of_week,
    h.effective_date,
    h.opens_at,
    h.closes_at,
    h.is_closed,
    h.notes,
    h.reservation_interval_minutes,
    h.reservation_slot_times,
  ]);
  rows.restaurant_operating_hours = await insertMany(client, {
    table: 'public.restaurant_operating_hours',
    columns: [
      'id',
      'restaurant_id',
      'day_of_week',
      'effective_date',
      'opens_at',
      'closes_at',
      'is_closed',
      'notes',
      'reservation_interval_minutes',
      'reservation_slot_times',
    ],
    rows: hoursInserts,
  });

  const capInserts = allowedCaps.rows.map((c) => [targetRestaurantId, c.capacity]);
  rows.allowed_capacities = await insertMany(client, {
    table: 'public.allowed_capacities',
    columns: ['restaurant_id', 'capacity'],
    rows: capInserts,
    onConflictSql: 'on conflict do nothing',
  });

  const tableInserts = tables.rows.map((t) => {
    const id = randomUUID();
    tableMap.set(t.id, id);
    const mappedZoneId = zoneMap.get(t.zone_id);
    if (!mappedZoneId) {
      throw new Error(`Missing zone mapping for zone_id=${t.zone_id}`);
    }
    return [
      id,
      targetRestaurantId,
      t.table_number,
      t.capacity,
      t.section,
      t.status,
      t.position,
      t.notes,
      mappedZoneId,
      t.category,
      t.seating_type,
      t.mobility,
      t.active,
      t.min_party_size,
      t.max_party_size,
    ];
  });
  rows.table_inventory = await insertMany(client, {
    table: 'public.table_inventory',
    columns: [
      'id',
      'restaurant_id',
      'table_number',
      'capacity',
      'section',
      'status',
      'position',
      'notes',
      'zone_id',
      'category',
      'seating_type',
      'mobility',
      'active',
      'min_party_size',
      'max_party_size',
    ],
    rows: tableInserts,
  });

  const adjInserts = adjs.rows
    .map((a) => {
      const aId = tableMap.get(a.table_a);
      const bId = tableMap.get(a.table_b);
      if (!aId || !bId) return null;
      return [aId, bId];
    })
    .filter((row): row is [string, string] => Boolean(row));
  if (adjInserts.length > 0) {
    rows.table_adjacencies = await insertMany(client, {
      table: 'public.table_adjacencies',
      columns: ['table_a', 'table_b'],
      rows: adjInserts,
      onConflictSql: 'on conflict do nothing',
      chunkSize: 500,
    });
  }

  const rulesInserts = rules.rows.map((r) => [
    randomUUID(),
    targetRestaurantId,
    r.service_period_id ? (periodMap.get(r.service_period_id) ?? null) : null,
    r.day_of_week,
    r.effective_date,
    r.max_covers,
    r.max_parties,
    r.notes,
    r.label,
    r.override_type,
  ]);
  rows.restaurant_capacity_rules = await insertMany(client, {
    table: 'public.restaurant_capacity_rules',
    columns: [
      'id',
      'restaurant_id',
      'service_period_id',
      'day_of_week',
      'effective_date',
      'max_covers',
      'max_parties',
      'notes',
      'label',
      'override_type',
    ],
    rows: rulesInserts,
  });

  return { copied: true, rows };
}

type CustomerSeed = { id: string; email: string; phone: string; name: string };

async function seedCustomers(
  client: Client,
  restaurantId: string,
  slug: string,
  args: Args,
): Promise<{ inserted: number; customers: CustomerSeed[] }> {
  // Idempotency: if we already have customers for this seed tag + slug, reuse them.
  const existing = await client.query<{ n: number }>(
    `select count(*)::int as n from public.customers where restaurant_id=$1 and email like $2`,
    [restaurantId, `%${args.seedTag}%${slug}%`],
  );
  if ((existing.rows[0]?.n ?? 0) > 0) {
    const sample = await client.query<{
      id: string;
      email: string;
      phone: string;
      full_name: string;
    }>(
      `select id, email, phone, full_name from public.customers where restaurant_id=$1 and email like $2 order by created_at asc limit $3`,
      [restaurantId, `%${args.seedTag}%${slug}%`, args.customersPerRestaurant],
    );
    return {
      inserted: 0,
      customers: sample.rows.map((r) => ({
        id: r.id,
        email: r.email,
        phone: r.phone,
        name: r.full_name,
      })),
    };
  }

  const customers: CustomerSeed[] = Array.from({ length: args.customersPerRestaurant }, (_, i) => {
    const idx = String(i + 1).padStart(4, '0');
    const name = `Seed Guest ${slug.toUpperCase()} ${idx}`;
    const email = `seed-${args.seedTag}-${slug}-${idx}@example.com`;
    const phone = `+447700${slug.slice(-3)}${idx}`.slice(0, 14);
    return { id: randomUUID(), email, phone, name };
  });

  const inserted = await insertMany(client, {
    table: 'public.customers',
    columns: ['id', 'restaurant_id', 'full_name', 'email', 'phone'],
    rows: customers.map((c) => [c.id, restaurantId, c.name, c.email, c.phone]),
    onConflictSql: 'on conflict do nothing',
    chunkSize: 200,
  });

  return { inserted, customers };
}

type BookingSeed = { id: string; party: number; startAt: string; endAt: string };

async function seedBookingsAndAssignments(
  client: Client,
  restaurantId: string,
  slug: string,
  ownerUserId: string,
  customers: CustomerSeed[],
  args: Args,
): Promise<{ bookingsInserted: number; assignmentsInserted: number }> {
  const existing = await client.query<{ n: number }>(
    `select count(*)::int as n from public.bookings where restaurant_id=$1 and reference like $2`,
    [restaurantId, `SEEDPERF-${args.seedTag}-${slug}-%`],
  );
  if ((existing.rows[0]?.n ?? 0) > 0) {
    return { bookingsInserted: 0, assignmentsInserted: 0 };
  }

  const tableIdsRes = await client.query<{
    id: string;
    capacity: number;
    min_party_size: number;
    max_party_size: number | null;
  }>(
    `select id, capacity, min_party_size, max_party_size from public.table_inventory where restaurant_id=$1 and active=true`,
    [restaurantId],
  );
  const tableRows = tableIdsRes.rows;
  if (tableRows.length === 0) {
    throw new Error(`No active tables found for restaurant slug=${slug} (${restaurantId})`);
  }

  const start = addDays(new Date(), -args.daysPast);
  const totalDays = args.daysPast + args.daysFuture + 1;

  const bookings: BookingSeed[] = [];
  const bookingRows: unknown[][] = [];

  const pickStatus = (): string => {
    // Mirrors the statuses used by ops endpoints. Keep mostly "confirmed" for
    // realistic ops volume, but include a spread for filter queries.
    const roll = Math.random();
    if (roll < 0.05) return 'pending';
    if (roll < 0.1) return 'pending_allocation';
    if (roll < 0.65) return 'confirmed';
    if (roll < 0.75) return 'checked_in';
    if (roll < 0.85) return 'completed';
    if (roll < 0.95) return 'cancelled';
    return 'no_show';
  };

  for (let d = 0; d < totalDays; d += 1) {
    const date = addDays(start, d);
    const dateStr = toDateString(date);

    for (let i = 0; i < args.bookingsPerDay; i += 1) {
      const isLunch = i % 3 === 0; // roughly 1/3 lunch
      const hh = isLunch ? 12 + randomInt(0, 1) : 18 + randomInt(0, 2);
      const mm = [0, 15, 30, 45][randomInt(0, 3)];
      const durationMin = 90;
      const endHh = hh + Math.floor((mm + durationMin) / 60);
      const endMm = (mm + durationMin) % 60;

      const party = randomInt(1, 8);
      const customer = pick(customers);

      const startAt = timeToIsoZ(dateStr, hh, mm);
      const endAt = timeToIsoZ(dateStr, endHh, endMm);

      const ref = `SEEDPERF-${args.seedTag}-${slug}-${dateStr.replaceAll('-', '')}-${String(
        i + 1,
      ).padStart(3, '0')}`;
      const notes = `Seed perf dataset (${args.seedTag}) for ${slug}`;
      const status = pickStatus();
      const checkedInAt = status === 'checked_in' || status === 'completed' ? startAt : null;
      const checkedOutAt = status === 'completed' ? endAt : null;

      const bookingId = randomUUID();
      bookings.push({ id: bookingId, party, startAt, endAt });

      bookingRows.push([
        bookingId,
        restaurantId,
        customer.id,
        dateStr,
        `${pad2(hh)}:${pad2(mm)}:00`,
        `${pad2(endHh)}:${pad2(endMm)}:00`,
        startAt,
        endAt,
        party,
        'any',
        status,
        customer.name,
        customer.email,
        customer.phone,
        notes,
        ref,
        'api',
        isLunch ? 'lunch' : 'dinner',
        checkedInAt,
        checkedOutAt,
      ]);
    }
  }

  const bookingsInserted = await insertMany(client, {
    table: 'public.bookings',
    columns: [
      'id',
      'restaurant_id',
      'customer_id',
      'booking_date',
      'start_time',
      'end_time',
      'start_at',
      'end_at',
      'party_size',
      'seating_preference',
      'status',
      'customer_name',
      'customer_email',
      'customer_phone',
      'notes',
      'reference',
      'source',
      'booking_type',
      'checked_in_at',
      'checked_out_at',
    ],
    rows: bookingRows,
    onConflictSql: 'on conflict (reference) do nothing',
    chunkSize: 200,
  });

  const assignmentRows: unknown[][] = [];
  for (const b of bookings) {
    if (Math.random() > args.assignmentRate) continue;
    const viable = tableRows.filter((t) => t.capacity >= b.party);
    const chosen = (viable.length > 0 ? pick(viable) : pick(tableRows)).id;
    assignmentRows.push([
      randomUUID(),
      b.id,
      chosen,
      ownerUserId,
      `Seed assignment (${args.seedTag})`,
      b.startAt,
      b.endAt,
    ]);
  }

  const assignmentsInserted = await insertMany(client, {
    table: 'public.booking_table_assignments',
    columns: ['id', 'booking_id', 'table_id', 'assigned_by', 'notes', 'start_at', 'end_at'],
    rows: assignmentRows,
    onConflictSql: 'on conflict do nothing',
    chunkSize: 300,
  });

  return { bookingsInserted, assignmentsInserted };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertStaging(args.apply, args.expectedProjectRef);

  const connectionString = buildPgConnectionString();
  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
    statement_timeout: 15 * 60 * 1000,
  });

  const taskDir = path.join(projectRoot, 'tasks/staging-perf-dataset-20260207-1647');
  const artifactsDir = path.join(taskDir, 'artifacts');
  const summaryPath = path.join(artifactsDir, 'seed-summary.json');

  const plan = {
    apply: args.apply,
    expectedProjectRef: args.expectedProjectRef,
    sourceSlug: args.sourceSlug,
    seedTag: args.seedTag,
    restaurantCount: args.restaurantCount,
    customersPerRestaurant: args.customersPerRestaurant,
    daysPast: args.daysPast,
    daysFuture: args.daysFuture,
    bookingsPerDay: args.bookingsPerDay,
    assignmentRate: args.assignmentRate,
    estimatedTotals: {
      restaurants: args.restaurantCount,
      customers: args.restaurantCount * args.customersPerRestaurant,
      days: args.daysPast + args.daysFuture + 1,
      bookings: args.restaurantCount * (args.daysPast + args.daysFuture + 1) * args.bookingsPerDay,
    },
  };

  if (!args.apply) {
    console.log(JSON.stringify(plan, null, 2));
    console.log('');
    console.log('Dry-run only. Re-run with `--apply` to write seed data.');
    return;
  }

  await client.connect();
  try {
    const source = await resolveSourceRestaurant(client, args.sourceSlug);
    const ownerUserId = await resolveOwnerUserId(client);

    console.log(`[seed-perf] Source restaurant: ${source.slug} (${source.id})`);
    console.log(`[seed-perf] Owner user: ${ownerUserId}`);

    const restaurants = await ensureSeedRestaurants(client, args, source, ownerUserId);

    let configRestaurantsCopied = 0;
    const configRows: Record<string, number> = {};

    let customersInserted = 0;
    let bookingsInserted = 0;
    let assignmentsInserted = 0;

    for (const r of restaurants) {
      console.log(`[seed-perf] Restaurant ${r.slug}`);

      await client.query('begin');
      try {
        const config = await copyRestaurantConfig(client, source.id, r.id);
        if (config.copied) {
          configRestaurantsCopied += 1;
          for (const [k, v] of Object.entries(config.rows)) {
            configRows[k] = (configRows[k] ?? 0) + v;
          }
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      }

      const { inserted, customers } = await seedCustomers(client, r.id, r.slug, args);
      customersInserted += inserted;

      const seed = await seedBookingsAndAssignments(
        client,
        r.id,
        r.slug,
        ownerUserId,
        customers,
        args,
      );
      bookingsInserted += seed.bookingsInserted;
      assignmentsInserted += seed.assignmentsInserted;
    }

    const summary = {
      ...plan,
      ranAtUtc: new Date().toISOString(),
      results: {
        seedRestaurants: restaurants.length,
        configRestaurantsCopied,
        configRows,
        customersInserted,
        bookingsInserted,
        assignmentsInserted,
      },
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`[seed-perf] Wrote summary: ${summaryPath}`);
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error('[seed-perf] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
