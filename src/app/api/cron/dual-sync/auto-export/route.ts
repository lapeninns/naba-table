/**
 * Phase 3h of the unified dual-sync engine.
 *
 * GET /api/cron/dual-sync/auto-export
 *
 * Cross-tenant cron entry point. Discovers every restaurant with at
 * least one open `dual_sync_outbound_candidates` row and drives the
 * publish orchestrator with `defaultDualSyncPorts` for each.
 *
 * Auth: optional `Authorization: Bearer ${CRON_SECRET}` header. When
 * `CRON_SECRET` is unset, the endpoint logs a warning and runs unguarded
 * — same model as the other cron endpoints in this repo.
 *
 * Query parameters:
 *   - `dryRun=1` — skip the publish step and return the discovery only.
 *   - `limit=N` — cap the number of restaurants processed in this run.
 *   - `maxCandidatesPerRestaurant=M` — forward to the per-restaurant
 *     runner so a single tenant cannot eat the whole budget.
 */

import { NextResponse } from 'next/server';

import { isDualSyncEnabled } from '@/server/dual-sync/flag';
import { runAutoExportForAllTenants } from '@/server/dual-sync/scheduling/auto-export';
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
    console.warn('[cron][dual-sync.auto-export] Unauthorized request', {
      hasAuthHeader: Boolean(authHeader),
      hasCronSecret: Boolean(CRON_SECRET),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!CRON_SECRET) {
    console.warn(
      '[cron][dual-sync.auto-export] CRON_SECRET not set - endpoint is unprotected',
    );
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
  const maxCandidatesPerRestaurant = parseOptionalInt(
    url.searchParams.get('maxCandidatesPerRestaurant'),
  );

  try {
    const summary = await runAutoExportForAllTenants({
      client: getServiceSupabaseClient(),
      maxRestaurants,
      maxCandidatesPerRestaurant,
      dryRun,
    });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[cron][dual-sync.auto-export] failed to run', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
