import { NextResponse } from 'next/server';

import { isEmailQueueEnabled } from '@/server/feature-flags';
import { getEmailQueueStatus } from '@/server/queue/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  if (!hasValidBearerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
