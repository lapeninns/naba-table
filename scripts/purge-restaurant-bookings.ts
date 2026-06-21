import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

import { getPgSslConfig } from './db/pg-ssl';
import { assertExactSupabaseApiProjectRef, assertProductionScriptSafety } from './db/safety';
import type { Database } from '../types/supabase';

type DeleteSpec = {
  table: keyof Database['public']['Tables'];
  bookingIdColumn: string;
};

function usage(): never {
  console.error(
    [
      'Usage:',
      '  pnpm -s tsx scripts/purge-restaurant-bookings.ts [--apply]',
      '',
      'Env:',
      '  NEXT_PUBLIC_SUPABASE_URL=... (required)',
      '  SUPABASE_SERVICE_ROLE_KEY=... (required)',
      '  SUPABASE_DB_URL=... (required on apply)',
      '  RESTAURANT_SLUG=three-horseshoes (required) OR RESTAURANT_ID=... (optional override)',
      '  DB_TARGET_ENV=production or APP_ENV=production (required on apply)',
      '',
      'Safety:',
      '  - Dry run by default (no writes).',
      '  - To actually delete, pass --apply AND set:',
      '    - CONFIRM_PRODUCTION=true',
      '    - CONFIRM_PURGE_BOOKINGS=true',
      '    - EXPECTED_PROJECT_REF=<ref> (required on apply)',
      '',
      'Example (dry run):',
      '  RESTAURANT_SLUG=three-horseshoes pnpm -s tsx scripts/purge-restaurant-bookings.ts',
      '',
      'Example (apply):',
      '  CONFIRM_PRODUCTION=true CONFIRM_PURGE_BOOKINGS=true EXPECTED_PROJECT_REF=ndxmivcrehsacuerwxtm RESTAURANT_SLUG=three-horseshoes \\',
      '    pnpm -s tsx scripts/purge-restaurant-bookings.ts --apply',
    ].join('\n'),
  );
  process.exit(1);
}

function quoteIdent(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function resolveDbUrl(): string | null {
  return (
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.DB_URL?.trim() ||
    null
  );
}

function assertPurgeApplySafety(input: {
  apply: boolean;
  dbUrl: string | null;
  expectedProjectRef: string | null;
  restaurantTarget: string | null;
  confirmPurgeBookings: boolean;
  confirmProduction: boolean;
}): string | null {
  if (!input.apply) return null;
  if (!input.dbUrl) {
    throw new Error('SUPABASE_DB_URL, DATABASE_URL, or DB_URL is required on --apply.');
  }
  if (!input.expectedProjectRef) {
    throw new Error('EXPECTED_PROJECT_REF is required on --apply to avoid accidental deletes.');
  }

  assertProductionScriptSafety({
    connectionString: input.dbUrl,
    expectedProjectRef: input.expectedProjectRef,
    targetEnv: process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim() || '',
    requireTargetEnv: true,
    apply: true,
    destructive: true,
    requireRestaurant: true,
    targetRestaurant: input.restaurantTarget,
    confirmation: input.confirmPurgeBookings ? 'true' : undefined,
    confirmationName: 'CONFIRM_PURGE_BOOKINGS',
    breakGlass: input.confirmProduction ? 'true' : undefined,
    breakGlassName: 'CONFIRM_PRODUCTION',
  });

  return input.dbUrl;
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.query<{ exists: string | null }>('select to_regclass($1) as exists', [
    `public.${table}`,
  ]);
  return Boolean(result.rows[0]?.exists);
}

async function purgeBookingsInTransaction(
  connectionString: string,
  restaurantId: string,
  deletes: DeleteSpec[],
): Promise<{
  bookingIds: string[];
  childDeletes: Array<{ table: string; deleted: number; skipped: boolean }>;
  bookingDeletes: number;
}> {
  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(process.env),
  });

  await client.connect();
  try {
    await client.query('begin');
    const bookingRows = await client.query<{ id: string }>(
      'select id from public.bookings where restaurant_id = $1 order by created_at for update',
      [restaurantId],
    );
    const bookingIds = bookingRows.rows.map((row) => row.id);
    const childDeletes: Array<{ table: string; deleted: number; skipped: boolean }> = [];

    if (bookingIds.length > 0) {
      for (const spec of deletes) {
        const tableName = String(spec.table);
        if (!(await tableExists(client, tableName))) {
          childDeletes.push({ table: tableName, deleted: 0, skipped: true });
          continue;
        }

        const result = await client.query(
          `delete from public.${quoteIdent(tableName)} where ${quoteIdent(spec.bookingIdColumn)} = any($1::uuid[])`,
          [bookingIds],
        );
        childDeletes.push({ table: tableName, deleted: result.rowCount ?? 0, skipped: false });
      }
    }

    const bookingDeleteResult =
      bookingIds.length > 0
        ? await client.query('delete from public.bookings where id = any($1::uuid[])', [bookingIds])
        : { rowCount: 0 };

    await client.query('commit');
    return {
      bookingIds,
      childDeletes,
      bookingDeletes: bookingDeleteResult.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function resolveRestaurant(
  supabase: ReturnType<typeof createClient<Database>>,
  restaurantSlug: string | null,
  restaurantId: string | null,
): Promise<{ id: string; slug: string; name: string | null }> {
  if (restaurantId) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, slug, name')
      .eq('id', restaurantId)
      .maybeSingle();
    if (error) throw new Error(`Failed to resolve restaurant by id: ${error.message}`);
    if (!data) throw new Error(`Restaurant not found for id: ${restaurantId}`);
    return { id: data.id, slug: data.slug, name: data.name ?? null };
  }

  if (!restaurantSlug) {
    throw new Error('Set RESTAURANT_SLUG or RESTAURANT_ID.');
  }

  const normalized = restaurantSlug.trim();
  const candidates = Array.from(
    new Set([
      normalized,
      // The user often types "threehorseshoes" while the canonical slug is "three-horseshoes".
      normalized === 'threehorseshoes' ? 'three-horseshoes' : normalized,
    ]),
  );

  for (const slug of candidates) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, slug, name')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(`Failed to resolve restaurant by slug: ${error.message}`);
    if (data) {
      return { id: data.id, slug: data.slug, name: data.name ?? null };
    }
  }

  throw new Error(`Restaurant not found for slug: ${normalized}`);
}

async function loadAllBookingIds(
  supabase: ReturnType<typeof createClient<Database>>,
  restaurantId: string,
): Promise<string[]> {
  const pageSize = 1000;
  const out: string[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list bookings: ${error.message}`);
    }

    const ids = (data ?? []).map((row) => row.id);
    out.push(...ids);

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return out;
}

async function main(): Promise<void> {
  const modulePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(modulePath), '..');
  const envLocalPath = path.join(projectRoot, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: false });
  }

  const APPLY = process.argv.includes('--apply') || process.env.APPLY === 'true';
  const CONFIRM_PRODUCTION = process.env.CONFIRM_PRODUCTION === 'true';
  const CONFIRM_PURGE_BOOKINGS = process.env.CONFIRM_PURGE_BOOKINGS === 'true';
  const EXPECTED_PROJECT_REF = process.env.EXPECTED_PROJECT_REF?.trim() || null;
  const restaurantSlug = process.env.RESTAURANT_SLUG?.trim() || null;
  const restaurantId = process.env.RESTAURANT_ID?.trim() || null;
  const dbUrl = assertPurgeApplySafety({
    apply: APPLY,
    dbUrl: resolveDbUrl(),
    expectedProjectRef: EXPECTED_PROJECT_REF,
    restaurantTarget: restaurantId ?? restaurantSlug,
    confirmPurgeBookings: CONFIRM_PURGE_BOOKINGS,
    confirmProduction: CONFIRM_PRODUCTION,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    usage();
  }

  if (!restaurantSlug && !restaurantId) {
    console.error('Set RESTAURANT_SLUG or RESTAURANT_ID.');
    usage();
  }

  if (EXPECTED_PROJECT_REF) {
    try {
      assertExactSupabaseApiProjectRef(url, EXPECTED_PROJECT_REF);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${message} Aborting.`);
      process.exit(1);
    }
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const restaurant = await resolveRestaurant(supabase, restaurantSlug, restaurantId);

  const { count: bookingCount, error: countError } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id);

  if (countError) {
    throw new Error(`Failed to count bookings: ${countError.message}`);
  }

  const { data: earliest, error: earliestError } = await supabase
    .from('bookings')
    .select('created_at, booking_date, source, reference, status')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true })
    .limit(1);
  if (earliestError) {
    throw new Error(`Failed to load earliest booking: ${earliestError.message}`);
  }

  const { data: latest, error: latestError } = await supabase
    .from('bookings')
    .select('created_at, booking_date, source, reference, status')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (latestError) {
    throw new Error(`Failed to load latest booking: ${latestError.message}`);
  }

  const { data: sample, error: sampleError } = await supabase
    .from('bookings')
    .select('created_at, booking_date, source, reference, status')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(5);
  if (sampleError) {
    throw new Error(`Failed to load sample bookings: ${sampleError.message}`);
  }

  console.log(
    [
      'Target:',
      `  restaurant_id: ${restaurant.id}`,
      `  slug: ${restaurant.slug}`,
      `  name: ${restaurant.name ?? '<no name>'}`,
      '',
      `Bookings matched: ${bookingCount ?? 0}`,
      earliest?.[0]
        ? `Earliest booking: created_at=${earliest[0].created_at} booking_date=${earliest[0].booking_date} source=${earliest[0].source} status=${earliest[0].status} reference=${earliest[0].reference}`
        : 'Earliest booking: <none>',
      latest?.[0]
        ? `Latest booking: created_at=${latest[0].created_at} booking_date=${latest[0].booking_date} source=${latest[0].source} status=${latest[0].status} reference=${latest[0].reference}`
        : 'Latest booking: <none>',
      sample && sample.length > 0
        ? `Sample (most recent ${sample.length}): ${sample
            .map(
              (row) =>
                `{created_at=${row.created_at} date=${row.booking_date} source=${row.source} status=${row.status} ref=${row.reference}}`,
            )
            .join(' ')}`
        : 'Sample: <none>',
      '',
      APPLY ? 'Mode: APPLY (deleting)' : 'Mode: DRY RUN (no writes)',
    ].join('\n'),
  );

  if (!bookingCount || bookingCount === 0) {
    console.log('No bookings to delete.');
    return;
  }

  const bookingIds = await loadAllBookingIds(supabase, restaurant.id);
  if (bookingIds.length !== bookingCount) {
    // Count can drift or be approximate if table is large and PostgREST estimate changes;
    // we proceed with the IDs we fetched because deletion is by ID.
    console.log(`Note: fetched ${bookingIds.length} booking IDs (count reported ${bookingCount}).`);
  }

  const preview = bookingIds.slice(0, 10);
  console.log(`Booking ID preview (first ${preview.length}): ${preview.join(', ')}`);

  if (!APPLY) {
    console.log('');
    console.log('Dry run complete.');
    console.log(
      'Re-run with --apply + CONFIRM_PRODUCTION=true + CONFIRM_PURGE_BOOKINGS=true + EXPECTED_PROJECT_REF=<ref> to perform deletion.',
    );
    return;
  }

  const deletes: DeleteSpec[] = [
    { table: 'booking_table_assignments', bookingIdColumn: 'booking_id' },
    { table: 'booking_state_history', bookingIdColumn: 'booking_id' },
    { table: 'booking_assignment_attempts', bookingIdColumn: 'booking_id' },
    { table: 'booking_assignment_idempotency', bookingIdColumn: 'booking_id' },
    { table: 'booking_confirmation_results', bookingIdColumn: 'booking_id' },
    { table: 'booking_versions', bookingIdColumn: 'booking_id' },
    { table: 'analytics_events', bookingIdColumn: 'booking_id' },
    { table: 'table_holds', bookingIdColumn: 'booking_id' },
    { table: 'table_soft_holds', bookingIdColumn: 'booking_id' },
    { table: 'email_delivery_log', bookingIdColumn: 'booking_id' },
    { table: 'sms_delivery_log', bookingIdColumn: 'booking_id' },
    { table: 'allocations', bookingIdColumn: 'booking_id' },
    // NOTE: capacity_outbox has booking_id but does not always have an FK; we still delete it.
    { table: 'capacity_outbox', bookingIdColumn: 'booking_id' },
  ];

  if (!dbUrl) {
    throw new Error('Internal error: missing transaction DB URL after apply safety checks.');
  }

  const purgeResult = await purgeBookingsInTransaction(dbUrl, restaurant.id, deletes);
  for (const result of purgeResult.childDeletes) {
    if (result.skipped) {
      console.log(`Skipped ${result.table}; table does not exist.`);
      continue;
    }
    if (result.deleted > 0) {
      console.log(`Deleted ${result.deleted} rows from ${result.table}.`);
    }
  }
  console.log(`Deleted ${purgeResult.bookingDeletes} rows from bookings.`);
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[purge-restaurant-bookings] Failed: ${message}`);
  process.exit(1);
});
