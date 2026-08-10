import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import {
  censusDefaultCoreOutbox,
  runDefaultCoreOutbox,
} from '@/server/dual-sync/core-outbox/runtime';
import { isDualSyncAutoCandidatesEnabled } from '@/server/dual-sync/runtime-controls';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { flushPosthogLogsAfterResponse } from '@/src/instrumentation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.core-outbox';
const DEFAULT_MAX_JOBS = 50;
const MAX_JOBS = 100;

function requestedLimit(value: string | null): number {
  if (value === null) return DEFAULT_MAX_JOBS;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_JOBS) : DEFAULT_MAX_JOBS;
}

function isDryRun(value: string | null): boolean {
  return value !== null && ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  await flushPosthogLogsAfterResponse();
  const response = await requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    if (!isDualSyncAutoCandidatesEnabled()) {
      return NextResponse.json(
        { error: 'Core-change candidate discovery is disabled.' },
        { status: 409 },
      );
    }
    const url = new URL(request.url);
    const maxJobs = requestedLimit(url.searchParams.get('maxJobs'));
    const dryRun = isDryRun(url.searchParams.get('dryRun'));

    try {
      if (dryRun) {
        const census = await censusDefaultCoreOutbox({ limit: maxJobs });
        return NextResponse.json({ success: true, runId: auth.runId, dryRun, maxJobs, census });
      }
      const result = await runDefaultCoreOutbox({ workerId: auth.runId, maxJobs });
      return NextResponse.json({ success: true, runId: auth.runId, dryRun, maxJobs, ...result });
    } catch (error) {
      logger.error('Dual-sync core outbox cron failed.', {
        source: 'cron.dual-sync.core-outbox',
        runId: auth.runId,
        errorKind: error instanceof Error ? 'error' : typeof error,
      });
      // captureServerException sanitizes exception content before external telemetry.
      captureServerException(error, {
        properties: { source: 'cron', kind: 'dual-sync-core-outbox', runId: auth.runId },
      });
      return NextResponse.json(
        { error: 'Core-change outbox processing failed.', code: 'core_outbox_processing_failed' },
        { status: 500 },
      );
    }
  });
  return noStore(response);
}
