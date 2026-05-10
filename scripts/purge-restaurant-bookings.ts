import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

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
      '  RESTAURANT_SLUG=three-horseshoes (required) OR RESTAURANT_ID=... (optional override)',
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

function shouldIgnoreMissingTable(message: string): boolean {
  return /schema cache|does not exist|relation .* does not exist/i.test(message);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function deleteByIds(
  supabase: ReturnType<typeof createClient<Database>>,
  table: DeleteSpec['table'],
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let deleted = 0;

  for (const group of chunk(ids, 100)) {
    // Note: we intentionally don't `.select()` here; PostgREST DELETE returning
    // behavior varies by config, and we only need to know "did it succeed".
    const { count, error } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(column, group);
    if (error) {
      if (shouldIgnoreMissingTable(error.message)) {
        return deleted;
      }
      throw new Error(`Failed to delete from ${String(table)}: ${error.message}`);
    }
    deleted += count ?? 0;
  }

  return deleted;
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

  if (APPLY && !CONFIRM_PRODUCTION) {
    console.error('Refusing to delete without CONFIRM_PRODUCTION=true.');
    process.exit(1);
  }

  if (APPLY && !CONFIRM_PURGE_BOOKINGS) {
    console.error('Refusing to delete without CONFIRM_PURGE_BOOKINGS=true.');
    process.exit(1);
  }

  if (APPLY && !EXPECTED_PROJECT_REF) {
    console.error('EXPECTED_PROJECT_REF is required on --apply to avoid accidental deletes.');
    process.exit(1);
  }

  if (EXPECTED_PROJECT_REF && !url.includes(EXPECTED_PROJECT_REF)) {
    console.error(
      `Supabase URL does not match expected project ref (${EXPECTED_PROJECT_REF}). Aborting.`,
    );
    process.exit(1);
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

  for (const spec of deletes) {
    const deleted = await deleteByIds(supabase, spec.table, spec.bookingIdColumn, bookingIds);
    if (deleted > 0) {
      console.log(
        `Deleted ~${deleted} rows from ${String(spec.table)} (by ${spec.bookingIdColumn}).`,
      );
    }
  }

  await deleteByIds(supabase, 'bookings', 'id', bookingIds);
  console.log(`Deleted ${bookingIds.length} rows from bookings.`);
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[purge-restaurant-bookings] Failed: ${message}`);
  process.exit(1);
});
