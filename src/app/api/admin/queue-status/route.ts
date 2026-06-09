import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import { isEmailQueueEnabled } from '@/server/runtime-policy';
import { getEmailQueueStatus } from '@/server/queue/email';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'admin.queue-status';

export async function GET(request: Request) {
  return requireCronAuthAndRun(request, JOB_NAME, async () => getQueueStatus(request));
}

async function getQueueStatus(request: Request) {
  if (!isEmailQueueEnabled()) {
    return NextResponse.json({
      status: 'disabled',
      provider: 'cloudflare',
      queue: {
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          total: 0,
        },
        jobs: null,
      },
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const url = new URL(request.url);
    const includeJobs = ['1', 'true', 'yes'].includes(
      (url.searchParams.get('includeJobs') ?? '').toLowerCase(),
    );
    const snapshot = await getEmailQueueStatus(includeJobs);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[admin][queue-status] error:', error);
    captureServerException(error, {
      properties: { source: 'ops', kind: 'admin-queue-status' },
    });
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
