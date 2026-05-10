/**
 * GET /api/cron/dual-sync/request-log-retention
 *
 * Cron-authenticated bounded retention job for redacted Google request-log
 * summaries. Archives, then deletes only expired rows selected by id in the
 * current batch.
 */

import { NextResponse } from 'next/server';

import { pruneExpiredGoogleRequestLogs } from '@/server/dual-sync/publish';
import { recordObservabilityEvent } from '@/server/observability';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';

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
  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const url = new URL(request.url);
    const dryRun = isTruthyFlag(url.searchParams.get('dryRun'));
    const limit = Math.min(
      parseOptionalInt(url.searchParams.get('limit')) ?? DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const cutoff = new Date().toISOString();

    if (dryRun) {
      return NextResponse.json({
        success: true,
        runId: auth.runId,
        dryRun: true,
        cutoff,
        limit,
        selected: 0,
        archived: 0,
        deleted: 0,
        moreLikely: false,
      });
    }

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

      const summary = await pruneExpiredGoogleRequestLogs({
        client: getServiceSupabaseClient(),
        now: cutoff,
        limit,
      });

      await recordObservabilityEvent({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.completed',
        severity: summary.moreLikely ? 'warning' : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          cutoff: summary.cutoff,
          limit: summary.limit,
          selected: summary.selected,
          archived: summary.archived,
          deleted: summary.deleted,
          moreLikely: summary.moreLikely,
        },
      });

      return NextResponse.json({
        success: true,
        runId: auth.runId,
        dryRun: false,
        ...summary,
      });
    } catch (error) {
      console.error('[cron][dual-sync.request-log-retention] failed to run', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
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
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return NextResponse.json(
        { error: 'Dual-sync request-log retention cron failed.' },
        { status: 500 },
      );
    }
  });
}
