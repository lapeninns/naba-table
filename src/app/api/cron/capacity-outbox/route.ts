import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { runOutboxWorker } from '@/server/jobs/outbox-worker';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Drains `capacity_outbox` (hold-confirmed and assignment-sync telemetry). Each batch is claimed
 * atomically with a lease (`claim_capacity_outbox_batch`), so an overlapping run on another
 * instance cannot process a row twice. Scheduled in vercel.json every 5 minutes.
 */
const JOB_NAME = 'capacity-outbox';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function requestedLimit(value: string | null): number {
  if (value === null) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  await flushPosthogLogsAfterResponse();
  const response = await requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const limit = requestedLimit(new URL(request.url).searchParams.get('limit'));

    try {
      const { error, ...summary } = await runOutboxWorker({ limit });
      if (error) {
        logger.error('Capacity outbox drain could not claim a batch.', {
          source: 'cron.capacity-outbox',
          runId: auth.runId,
          errorCode: error,
        });
        return NextResponse.json(
          {
            success: false,
            runId: auth.runId,
            code: 'OUTBOX_CLAIM_FAILED',
            error: 'The capacity outbox could not be drained right now.',
            retryable: true,
            limit,
            ...summary,
          },
          { status: 503 },
        );
      }
      if (summary.dead > 0) {
        // Dead letters need an operator: they will not be retried.
        logger.warn('Capacity outbox drain dead-lettered events.', {
          source: 'cron.capacity-outbox',
          runId: auth.runId,
          dead: summary.dead,
          processed: summary.processed,
          failed: summary.failed,
          batches: summary.batches,
        });
      }
      return NextResponse.json({ success: true, runId: auth.runId, limit, ...summary });
    } catch (error) {
      logger.error('Capacity outbox drain failed.', {
        source: 'cron.capacity-outbox',
        runId: auth.runId,
        errorKind: error instanceof Error ? error.name : typeof error,
      });
      // captureServerException sanitizes exception content before external telemetry.
      captureServerException(error, {
        properties: { source: 'cron', kind: 'capacity-outbox', runId: auth.runId },
      });
      return NextResponse.json(
        { error: 'Capacity outbox processing failed.', code: 'OUTBOX_DRAIN_FAILED' },
        { status: 500 },
      );
    }
  });
  return noStore(response);
}
