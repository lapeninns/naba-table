import 'tsconfig-paths/register';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  assertProductionApiScriptSafety,
  DEFAULT_PRODUCTION_PROJECT_REF,
  normalizeSupabaseProjectRef,
} from '../db/safety';
import type { Database } from '../../types/supabase';

const projectRoot = process.cwd();
const envPath = process.env.ENV_PATH
  ? path.resolve(projectRoot, process.env.ENV_PATH)
  : path.join(projectRoot, '.env.vercel-production');

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

const TARGET_RESTAURANT_ID =
  (process.env.TARGET_RESTAURANT_ID ?? process.env.RESTAURANT_ID ?? '').trim() || null;
const ALLOW_ALL_RESTAURANTS_BACKFILL = process.env.ALLOW_ALL_RESTAURANTS_BACKFILL === 'true';

type Args = {
  hours: number;
  limit: number;
  apply: boolean;
  drain: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { hours: 72, limit: 200, apply: false, drain: false };

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i] ?? '';
    if (raw === '--apply') out.apply = true;
    if (raw === '--drain') out.drain = true;

    const takeValue = (prefix: string) => {
      if (raw === prefix) {
        const next = argv[i + 1];
        if (next) {
          i += 1;
          return next;
        }
      }
      if (raw.startsWith(`${prefix}=`)) {
        return raw.slice(prefix.length + 1);
      }
      return null;
    };

    const hoursValue = takeValue('--hours');
    if (hoursValue) {
      const parsed = Number.parseInt(hoursValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.hours = parsed;
    }

    const limitValue = takeValue('--limit');
    if (limitValue) {
      const parsed = Number.parseInt(limitValue, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.limit = parsed;
    }
  }

  return out;
}

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

function resolveSupabaseApiUrl(): string {
  const apiUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required.');
  }
  return apiUrl;
}

function resolveTargetEnv(): string {
  return (process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim() || '').toLowerCase();
}

function assertReviewQueueBackfillSafety(args: Args): void {
  if (!args.apply) return;

  if (TARGET_RESTAURANT_ID && ALLOW_ALL_RESTAURANTS_BACKFILL) {
    throw new Error(
      'Set either TARGET_RESTAURANT_ID/RESTAURANT_ID or ALLOW_ALL_RESTAURANTS_BACKFILL=true, not both.',
    );
  }

  if (args.drain && TARGET_RESTAURANT_ID) {
    throw new Error(
      '--drain calls the global email cron endpoint and cannot be used with TARGET_RESTAURANT_ID/RESTAURANT_ID. Drain targeted jobs through the ops queue tooling instead.',
    );
  }

  if (!TARGET_RESTAURANT_ID && !ALLOW_ALL_RESTAURANTS_BACKFILL) {
    throw new Error(
      'TARGET_RESTAURANT_ID or RESTAURANT_ID is required for review request queue apply mode. Set ALLOW_ALL_RESTAURANTS_BACKFILL=true only for an intentional all-restaurant run.',
    );
  }

  if (
    ALLOW_ALL_RESTAURANTS_BACKFILL &&
    process.env.CONFIRM_REVIEW_EMAIL_GLOBAL_BACKFILL !== 'true'
  ) {
    throw new Error(
      'CONFIRM_REVIEW_EMAIL_GLOBAL_BACKFILL=true is required for all-restaurant review request queue backfills.',
    );
  }

  assertProductionApiScriptSafety({
    apiUrl: resolveSupabaseApiUrl(),
    expectedProjectRef: normalizeSupabaseProjectRef(
      process.env.EXPECTED_PRODUCTION_PROJECT_REF ?? DEFAULT_PRODUCTION_PROJECT_REF,
      'EXPECTED_PRODUCTION_PROJECT_REF',
    ),
    targetEnv: resolveTargetEnv(),
    requireTargetEnv: true,
    apply: true,
    confirmation: process.env.CONFIRM_REVIEW_EMAIL_BACKFILL,
    confirmationName: 'CONFIRM_REVIEW_EMAIL_BACKFILL',
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function isMissingTableError(message: string, tableName: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes(tableName) && normalized.includes('could not find the table');
}

async function queryExistingReviewIntents(
  supabase: SupabaseClient<Database>,
  bookingIds: string[],
): Promise<Set<string>> {
  const existingBookingIds = new Set<string>();
  if (bookingIds.length === 0) {
    return existingBookingIds;
  }

  for (const batch of chunk(bookingIds, 100)) {
    const dedupeKeys = batch.map((id) => `review_request:${id}`);
    const { data: intentRows, error: intentError } = await supabase
      .from('email_dispatch_intents')
      .select('booking_id, dedupe_key')
      .eq('email_type', 'review_request')
      .in('dedupe_key', dedupeKeys)
      .limit(1000);

    if (intentError) {
      throw intentError;
    }

    for (const row of (intentRows ?? []) as Array<{
      booking_id: string | null;
      dedupe_key: string | null;
    }>) {
      if (row.booking_id) {
        existingBookingIds.add(row.booking_id);
        continue;
      }
      const bookingIdFromKey = row.dedupe_key?.startsWith('review_request:')
        ? row.dedupe_key.slice('review_request:'.length)
        : null;
      if (bookingIdFromKey) {
        existingBookingIds.add(bookingIdFromKey);
      }
    }
  }

  return existingBookingIds;
}

async function drainCron(
  types: string,
  maxRuns = 30,
): Promise<{ runs: number; processed: number }> {
  // Prefer the explicit cron origin (stable production alias) over app/site origins.
  const appOrigin = (process.env.CRON_ORIGIN ?? 'https://app.nabatable.com').replace(/\/+$/, '');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new Error('CRON_SECRET is required to drain via cron endpoint.');
  }

  let runs = 0;
  let processedTotal = 0;

  type CronResponse = {
    success?: boolean;
    error?: string;
    processed?: number;
    results?: unknown[];
    message?: string;
  };

  for (let i = 0; i < maxRuns; i += 1) {
    runs += 1;
    const url = new URL(`${appOrigin}/api/cron/process-emails`);
    url.searchParams.set('types', types);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });
    const json = (await res.json().catch(() => null)) as unknown;
    const payload =
      typeof json === 'object' && json !== null
        ? (json as CronResponse)
        : (null as CronResponse | null);

    if (!res.ok) {
      throw new Error(`cron drain failed (${res.status}): ${payload?.error ?? res.statusText}`);
    }

    const processed = Array.isArray(payload?.results)
      ? payload.results.length
      : Number(payload?.processed ?? 0);
    processedTotal += Number.isFinite(processed) ? processed : 0;
    if (!processed || processed <= 0) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  return { runs, processed: processedTotal };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertReviewQueueBackfillSafety(args);

  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const { enqueueEmailJob } = await import('@/server/queue/email');

  const supabase = getServiceSupabaseClient();

  const sinceIso = new Date(Date.now() - args.hours * 60 * 60 * 1000).toISOString();

  // Fetch recent completed bookings (avoid selecting large columns).
  let bookingQuery = supabase
    .from('bookings')
    .select('id, restaurant_id, status, updated_at, customer_email')
    .eq('status', 'completed')
    .gte('updated_at', sinceIso)
    .order('updated_at', { ascending: false })
    .limit(args.limit);

  if (TARGET_RESTAURANT_ID) {
    bookingQuery = bookingQuery.eq('restaurant_id', TARGET_RESTAURANT_ID);
  }

  const { data: bookings, error: bookingError } = await bookingQuery;

  if (bookingError) {
    throw new Error(`Failed to fetch bookings: ${bookingError.message}`);
  }

  const candidates = (bookings ?? []) as Array<{
    id: string;
    restaurant_id: string | null;
    status: string | null;
    updated_at: string | null;
    customer_email: string | null;
  }>;

  const eligible = candidates.filter((b) => isValidEmail(b.customer_email));
  const bookingIds = eligible.map((b) => b.id);

  const sentBookingIds = new Set<string>();
  let deliveryLogAvailable = true;

  // Check delivery log in chunks to keep queries small.
  try {
    for (const batch of chunk(bookingIds, 100)) {
      const { data: sentRows, error: sentError } = await supabase
        .from('email_delivery_log')
        .select('booking_id')
        .eq('template_type', 'review_request')
        .in('booking_id', batch)
        .in('status', ['sent', 'delivered'])
        .gte('occurred_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);

      if (sentError) {
        throw sentError;
      }

      for (const row of (sentRows ?? []) as Array<{ booking_id: string | null }>) {
        if (row.booking_id) sentBookingIds.add(row.booking_id);
      }
    }
  } catch (error) {
    const message = formatError(error);
    // Some production environments may not have the delivery log table yet. This should not block
    // operational backfills when dispatch-intent dedupe remains available.
    if (isMissingTableError(message, 'email_delivery_log')) {
      deliveryLogAvailable = false;
      console.warn(
        '[backfill-review] email_delivery_log table unavailable; skipping delivery-log dedupe',
        {
          error: message,
        },
      );
    } else {
      throw new Error(`Failed to query email delivery log: ${message}`);
    }
  }

  let existingIntentBookingIds = new Set<string>();
  try {
    existingIntentBookingIds = await queryExistingReviewIntents(supabase, bookingIds);
  } catch (error) {
    const message = formatError(error);
    throw new Error(
      `Failed to query email dispatch intents for dedupe; refusing to enqueue review requests: ${message}`,
    );
  }

  const toEnqueue = eligible.filter(
    (b) => !sentBookingIds.has(b.id) && !existingIntentBookingIds.has(b.id),
  );

  console.log('[backfill-review] summary', {
    windowHours: args.hours,
    restaurantTarget:
      TARGET_RESTAURANT_ID ?? (ALLOW_ALL_RESTAURANTS_BACKFILL ? 'all' : 'all-dry-run'),
    fetchedCompleted: candidates.length,
    eligibleWithEmail: eligible.length,
    alreadySent: sentBookingIds.size,
    existingDispatchIntents: existingIntentBookingIds.size,
    toEnqueue: toEnqueue.length,
    deliveryLogAvailable,
    apply: args.apply,
    drain: args.drain,
  });

  if (!args.apply) {
    console.log('[backfill-review] dry run complete. Re-run with --apply to enqueue jobs.');
    return;
  }

  let enqueued = 0;
  let enqueueFailed = 0;

  for (const booking of toEnqueue) {
    try {
      await enqueueEmailJob(
        {
          bookingId: booking.id,
          restaurantId: booking.restaurant_id ?? null,
          type: 'review_request',
          scheduledFor: new Date().toISOString(),
        },
        { jobId: `review_request:${booking.id}`, delayMs: 0 },
      );
      enqueued += 1;
    } catch (error) {
      enqueueFailed += 1;
      console.warn('[backfill-review] failed to enqueue job', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[backfill-review] enqueue results', { enqueued, enqueueFailed });

  if (args.drain && enqueued > 0) {
    const drained = await drainCron('review_request');
    console.log('[backfill-review] drained via cron', drained);
  }
}

main().catch((error) => {
  console.error('[backfill-review] fatal', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
