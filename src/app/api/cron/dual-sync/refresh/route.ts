/**
 * GET /api/cron/dual-sync/refresh
 *
 * Cross-tenant scheduled refresh entry point. Discovers linked Google Business
 * Profile restaurants and pulls provider snapshots into the dual-sync state
 * engine. It does not publish local changes to Google.
 *
 * Query parameters:
 *   - `dryRun=1` — return discovered restaurants without pulling Google.
 *   - `limit=N` — cap the number of restaurants processed in this run.
 */

import { NextResponse } from 'next/server';

import { isDualSyncEnabled } from '@/server/dual-sync/flag';
import { runScheduledRefreshForAllTenants } from '@/server/dual-sync/scheduling';
import { getServiceSupabaseClient } from '@/server/supabase';

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseOptionalInt(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isTruthyFlag(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const hasValidBearer = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && !hasValidBearer) {
    console.warn('[cron][dual-sync.refresh] Unauthorized request', {
      hasAuthHeader: Boolean(authHeader),
      hasCronSecret: Boolean(CRON_SECRET),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CRON_SECRET) {
    console.warn('[cron][dual-sync.refresh] CRON_SECRET not set - endpoint is unprotected');
  }

  if (!isDualSyncEnabled()) {
    return NextResponse.json(
      { error: 'Dual-sync is not enabled for this deployment.' },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const dryRun = isTruthyFlag(url.searchParams.get('dryRun'));
  const maxRestaurants = parseOptionalInt(url.searchParams.get('limit'));

  try {
    const summary = await runScheduledRefreshForAllTenants({
      client: getServiceSupabaseClient(),
      maxRestaurants,
      dryRun,
    });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[cron][dual-sync.refresh] failed to run', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
