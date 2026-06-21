/**
 * GET /api/cron/dual-sync/health
 *
 * Cron-authenticated operational health alert sweep. Loads bounded
 * restaurant-scoped metrics and emits warning/critical dual-sync health
 * notifications through the configured notification port.
 */

import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

import { runDualSyncOperationalHealthAlertSweep } from '@/server/dual-sync/observability';
import { recordObservabilityEvent } from '@/server/observability';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.health';
const MAX_RESTAURANTS_PER_RUN = 50;
const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 168;
const DEFAULT_METRIC_LIMIT = 200;
const MAX_METRIC_LIMIT = 500;

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
    const url = new URL(request.url);
    const dryRun = isTruthyFlag(url.searchParams.get('dryRun'));
    const onlyCritical = isTruthyFlag(url.searchParams.get('onlyCritical'));
    const requestedMaxRestaurants = parseOptionalInt(url.searchParams.get('limit'));
    const requestedWindowHours = parseOptionalInt(url.searchParams.get('windowHours'));
    const requestedMetricLimit = parseOptionalInt(url.searchParams.get('metricLimit'));
    const maxRestaurants = requestedMaxRestaurants
      ? Math.min(requestedMaxRestaurants, MAX_RESTAURANTS_PER_RUN)
      : undefined;
    const windowHours = Math.min(requestedWindowHours ?? DEFAULT_WINDOW_HOURS, MAX_WINDOW_HOURS);
    const metricLimit = Math.min(requestedMetricLimit ?? DEFAULT_METRIC_LIMIT, MAX_METRIC_LIMIT);

    try {
      await recordObservabilityEvent({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.triggered',
        severity: 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          dryRun,
          maxRestaurants: maxRestaurants ?? null,
          windowHours,
          metricLimit,
          onlyCritical,
        },
      });

      const summary = await runDualSyncOperationalHealthAlertSweep({
        client: getServiceSupabaseClient(),
        maxRestaurants,
        dryRun,
        windowMs: windowHours * 60 * 60 * 1000,
        limit: metricLimit,
        onlyCritical,
      });

      await recordObservabilityEvent({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.completed',
        severity: summary.errors.length > 0 || summary.alertsEmitted > 0 ? 'warning' : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          dryRun,
          restaurantsConsidered: summary.restaurantsConsidered,
          restaurantsProcessed: summary.restaurantsProcessed,
          alertsEmitted: summary.alertsEmitted,
          errors: summary.errors.length,
        },
      });

      return NextResponse.json({
        success: true,
        runId: auth.runId,
        windowHours,
        metricLimit,
        onlyCritical,
        ...summary,
      });
    } catch (error) {
      console.error('[cron][dual-sync.health] failed to run', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      captureServerException(error, {
        properties: {
          jobName: auth.jobName,
          runId: auth.runId,
          source: 'cron',
          kind: 'dual-sync-health',
        },
      });
      await recordObservabilityEvent({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.failed',
        severity: 'error',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          dryRun,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return NextResponse.json({ error: 'Dual-sync health cron failed.' }, { status: 500 });
    }
  });
}
