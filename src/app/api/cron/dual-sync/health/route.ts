/**
 * GET /api/cron/dual-sync/health
 *
 * Cron-authenticated operational health alert sweep. Loads bounded
 * restaurant-scoped metrics and emits warning/critical dual-sync health
 * notifications through the configured notification port.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  createSupabaseGbpDispatchedGrantRecoveryPort,
  recoverStaleGbpDispatchedGrants,
} from '@/server/dual-sync/health/dispatched-grant-recovery';
import { reconcileGoogleWriteTerminalNotices } from '@/server/dual-sync/notifications';
import { runDualSyncOperationalHealthAlertSweep } from '@/server/dual-sync/observability';
import {
  GBP_NO_STORE_HEADERS,
  createSupabaseContentRetentionPort,
  gbpNoStoreResponse,
  runContentRetention,
} from '@/server/dual-sync/retention';
import { recordObservabilityEvent } from '@/server/observability';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

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
  const response = await requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
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

      const client = getServiceSupabaseClient();
      const recovery = dryRun
        ? {
            mode: 'dry_run_omitted' as const,
            cutoff: null,
            profilesConsidered: 0,
            profilesProcessed: 0,
            recovered: 0,
            capped: false,
            errors: [],
          }
        : await recoverStaleGbpDispatchedGrants({
            port: createSupabaseGbpDispatchedGrantRecoveryPort(client),
            now: new Date(),
          });
      const noticeReconciliation = dryRun
        ? { considered: 0, materialized: 0, failed: 0 }
        : await reconcileGoogleWriteTerminalNotices({ client, limit: 100 });
      const grantRecovery = {
        ...recovery,
        terminalNoticesMaterialized: noticeReconciliation.materialized,
      };
      const summary = await runDualSyncOperationalHealthAlertSweep({
        client,
        maxRestaurants,
        dryRun,
        windowMs: windowHours * 60 * 60 * 1000,
        limit: metricLimit,
        onlyCritical,
      });
      const contentRetention = await runContentRetention({
        port: createSupabaseContentRetentionPort(client),
        now: new Date(),
        dryRun: true,
        limit: 500,
        timeBudgetMs: 10_000,
      });

      await recordObservabilityEvent({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.completed',
        severity:
          summary.errors.length > 0 || summary.alertsEmitted > 0 || grantRecovery.errors.length > 0
            ? 'warning'
            : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          dryRun,
          restaurantsConsidered: summary.restaurantsConsidered,
          restaurantsProcessed: summary.restaurantsProcessed,
          alertsEmitted: summary.alertsEmitted,
          errors: summary.errors.length,
          grantsRecovered: grantRecovery.recovered,
          grantRecoveryErrors: grantRecovery.errors.length,
          terminalNoticesMaterialized: grantRecovery.terminalNoticesMaterialized,
          retentionLevel: contentRetention.level,
          retentionMatched: contentRetention.totals.matched,
          retentionOldestOutstandingAgeMs: contentRetention.oldestOutstandingAgeMs,
        },
      });

      return NextResponse.json(
        {
          success: true,
          runId: auth.runId,
          windowHours,
          metricLimit,
          onlyCritical,
          grantRecovery,
          contentRetention,
          ...summary,
        },
        { headers: GBP_NO_STORE_HEADERS },
      );
    } catch (error) {
      logger.error('cron.dual-sync.health.failed', {
        jobName: auth.jobName,
        runId: auth.runId,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      await recordObservabilityEvent({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.failed',
        severity: 'error',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          dryRun,
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        },
      });
      return NextResponse.json(
        { error: 'Dual-sync health cron failed.' },
        { status: 500, headers: GBP_NO_STORE_HEADERS },
      );
    }
  });
  return gbpNoStoreResponse(response);
}
