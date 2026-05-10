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

import { isDualSyncScheduledRefreshEnabled } from '@/server/dual-sync/flag';
import { runScheduledRefreshForAllTenants } from '@/server/dual-sync/scheduling';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.refresh';
const MAX_RESTAURANTS_PER_RUN = 50;

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
  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    if (!isDualSyncScheduledRefreshEnabled()) {
      return NextResponse.json(
        { error: 'Dual-sync scheduled refresh is disabled for this deployment.' },
        { status: 409 },
      );
    }

    const url = new URL(request.url);
    const dryRun = isTruthyFlag(url.searchParams.get('dryRun'));
    const requestedMaxRestaurants = parseOptionalInt(url.searchParams.get('limit'));
    const maxRestaurants = requestedMaxRestaurants
      ? Math.min(requestedMaxRestaurants, MAX_RESTAURANTS_PER_RUN)
      : undefined;

    try {
      const summary = await runScheduledRefreshForAllTenants({
        client: getServiceSupabaseClient(),
        maxRestaurants,
        dryRun,
      });
      return NextResponse.json({ success: true, runId: auth.runId, ...summary });
    } catch (error) {
      console.error('[cron][dual-sync.refresh] failed to run', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      return NextResponse.json({ error: 'Dual-sync refresh cron failed.' }, { status: 500 });
    }
  });
}
