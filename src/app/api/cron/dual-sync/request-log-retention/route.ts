/**
 * GET /api/cron/dual-sync/request-log-retention
 *
 * Cron-authenticated bounded retention census/purge across classified GBP
 * stores. Content summaries are never copied into the legacy archive.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
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

const JOB_NAME = 'dual-sync.request-log-retention';
const DEFAULT_LIMIT = 1_000;
const MAX_LIMIT = 5_000;

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
    const limit = Math.min(
      parseOptionalInt(url.searchParams.get('limit')) ?? DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const cutoff = new Date().toISOString();

    try {
      await recordObservabilityEvent({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.triggered',
        severity: 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          cutoff,
          limit,
        },
      });

      const client = getServiceSupabaseClient();
      const summary = await runContentRetention({
        port: createSupabaseContentRetentionPort(client),
        now: new Date(cutoff),
        limit,
        dryRun,
        timeBudgetMs: 20_000,
      });

      await recordObservabilityEvent({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.completed',
        severity: summary.moreLikely ? 'warning' : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          cutoff: summary.runAt,
          limit: summary.limit,
          matched: summary.totals.matched,
          mutated: summary.totals.mutated,
          oldestOutstandingAgeMs: summary.oldestOutstandingAgeMs,
          level: summary.level,
          moreLikely: summary.moreLikely,
        },
      });

      return NextResponse.json(
        { success: true, runId: auth.runId, ...summary },
        { headers: GBP_NO_STORE_HEADERS },
      );
    } catch (error) {
      logger.error('cron.dual-sync.content-retention.failed', {
        jobName: auth.jobName,
        runId: auth.runId,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      await recordObservabilityEvent({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.failed',
        severity: 'error',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          cutoff,
          limit,
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        },
      });
      return NextResponse.json(
        { error: 'Dual-sync request-log retention cron failed.' },
        { status: 500, headers: GBP_NO_STORE_HEADERS },
      );
    }
  });
  return gbpNoStoreResponse(response);
}
