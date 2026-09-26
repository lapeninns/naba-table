import { NextResponse } from 'next/server';

import { conflict } from '@/lib/api/errors';
import { requeueRestaurantEmailQueueJob } from '@/server/queue/email';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import { handleQueueJobMutation, queueJobNotFound, type QueueJobRouteContext } from '../_shared';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE = '/api/ops/email-queue/[jobId]/requeue';

export async function POST(request: NextRequest, context: QueueJobRouteContext) {
  return withCsrfProtectedMutation(request, () =>
    handleQueueJobMutation(request, context, {
      route: ROUTE,
      rateLimitScope: 'ops-email-queue:requeue',
      rateLimit: 10,
      rateLimitMessage: 'Too many requeue attempts. Wait a moment and try again.',
      run: async ({ jobId, restaurantId }) => {
        const result = await requeueRestaurantEmailQueueJob({ jobId, restaurantId });
        if (result === 'not_found') {
          return queueJobNotFound();
        }
        if (result === 'not_requeueable') {
          return conflict('NOT_REQUEUEABLE', 'Only failed emails can be requeued.');
        }
        return NextResponse.json({ ok: true, jobId, action: 'requeued' }, { status: 200 });
      },
    }),
  );
}
