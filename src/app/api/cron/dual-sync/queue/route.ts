/**
 * GET /api/cron/dual-sync/queue
 *
 * Cron-authenticated durable queue drain for unified dual-sync jobs.
 * Each tick claims and executes a bounded number of available jobs.
 */

import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

import { processNextDualSyncJob } from '@/server/dual-sync/queue';
import { recordObservabilityEvent } from '@/server/observability';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.queue';
const DEFAULT_MAX_JOBS = 10;
const MAX_JOBS_PER_RUN = 25;

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
    const requestedMaxJobs = parseOptionalInt(url.searchParams.get('maxJobs'));
    const maxJobs = Math.min(requestedMaxJobs ?? DEFAULT_MAX_JOBS, MAX_JOBS_PER_RUN);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        runId: auth.runId,
        dryRun: true,
        maxJobs,
        processed: 0,
        results: [],
      });
    }

    try {
      await recordObservabilityEvent({
        source: 'cron.dual-sync.queue',
        eventType: 'drain.triggered',
        severity: 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          maxJobs,
        },
      });

      const client = getServiceSupabaseClient();
      const results = [];
      for (let i = 0; i < maxJobs; i += 1) {
        const result = await processNextDualSyncJob({
          client,
          workerId: auth.runId,
        });
        if (result.status === 'idle') break;
        results.push({
          status: result.status,
          jobId: result.job.id,
          jobKind: result.job.jobKind,
          restaurantId: result.job.restaurantId,
          attemptCount: result.job.attemptCount,
          lastErrorCode: result.job.lastErrorCode,
        });
      }

      const failedCount = results.filter(
        (result) => result.status === 'retrying' || result.status === 'dead_letter',
      ).length;
      await recordObservabilityEvent({
        source: 'cron.dual-sync.queue',
        eventType: 'drain.completed',
        severity: failedCount > 0 ? 'warning' : 'info',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          maxJobs,
          processed: results.length,
          failed: failedCount,
          succeeded: results.filter((result) => result.status === 'succeeded').length,
          results,
        },
      });

      return NextResponse.json({
        success: true,
        runId: auth.runId,
        dryRun: false,
        maxJobs,
        processed: results.length,
        results,
      });
    } catch (error) {
      console.error('[cron][dual-sync.queue] failed to run', {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      captureServerException(error, {
        properties: {
          jobName: auth.jobName,
          runId: auth.runId,
          source: 'cron',
          kind: 'dual-sync-queue',
        },
      });
      await recordObservabilityEvent({
        source: 'cron.dual-sync.queue',
        eventType: 'drain.failed',
        severity: 'error',
        context: {
          jobName: auth.jobName,
          runId: auth.runId,
          maxJobs,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return NextResponse.json({ error: 'Dual-sync queue cron failed.' }, { status: 500 });
    }
  });
}
