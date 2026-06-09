/**
 * Phase 3h of the unified dual-sync engine.
 *
 * GET /api/cron/dual-sync/auto-export
 *
 * Cross-tenant cron entry point. Discovers every restaurant with at
 * least one open `dual_sync_outbound_candidates` row and drives the
 * publish orchestrator with `defaultDualSyncPorts` for each.
 *
 * Auth: required `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Query parameters:
 *   - `dryRun=1` — skip the publish step and return the discovery only.
 *   - `limit=N` — cap the number of restaurants processed in this run.
 *   - `maxCandidatesPerRestaurant=M` — forward to the per-restaurant
 *     runner so a single tenant cannot eat the whole budget.
 */

import { NextResponse } from 'next/server';

import { captureServerException } from '@/lib/posthog/server';
import { isDualSyncAutoCandidatesEnabled } from '@/server/dual-sync/runtime-controls';
import { runAutoExportForAllTenants } from '@/server/dual-sync/scheduling/auto-export';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.auto-export';
const MAX_RESTAURANTS_PER_RUN = 50;
const MAX_CANDIDATES_PER_RESTAURANT = 25;

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
  await flushPosthogLogsAfterResponse();
  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    if (!isDualSyncAutoCandidatesEnabled()) {
      return NextResponse.json(
        { error: 'Dual-sync auto-candidate export is disabled for this deployment.' },
        { status: 409 },
      );
    }

    const url = new URL(request.url);
    const dryRun = isTruthyFlag(url.searchParams.get('dryRun'));
    const requestedMaxRestaurants = parseOptionalInt(url.searchParams.get('limit'));
    const requestedMaxCandidatesPerRestaurant = parseOptionalInt(
      url.searchParams.get('maxCandidatesPerRestaurant'),
    );
    const maxRestaurants = requestedMaxRestaurants
      ? Math.min(requestedMaxRestaurants, MAX_RESTAURANTS_PER_RUN)
      : undefined;
    const maxCandidatesPerRestaurant = requestedMaxCandidatesPerRestaurant
      ? Math.min(requestedMaxCandidatesPerRestaurant, MAX_CANDIDATES_PER_RESTAURANT)
      : undefined;

    try {
      const summary = await runAutoExportForAllTenants({
        client: getServiceSupabaseClient(),
        maxRestaurants,
        maxCandidatesPerRestaurant,
        dryRun,
      });
      return NextResponse.json({ success: true, runId: auth.runId, ...summary });
    } catch (error) {
      console.error('[cron][dual-sync.auto-export] failed to run', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      captureServerException(error, {
        properties: { jobName: auth.jobName, runId: auth.runId, source: 'cron' },
      });
      return NextResponse.json({ error: 'Dual-sync auto-export cron failed.' }, { status: 500 });
    }
  });
}
