import { NextResponse } from 'next/server';

import { internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { getEmailQueueStatus } from '@/server/queue/email';
import { isEmailQueueEnabled } from '@/server/runtime-policy';
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
    captureServerException(error, {
      properties: { source: 'ops', kind: 'admin-queue-status' },
    });
    return internalError(error, { route: '/api/admin/queue-status' });
  }
}
