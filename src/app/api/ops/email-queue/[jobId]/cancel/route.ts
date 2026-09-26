import { NextResponse } from 'next/server';

import { conflict } from '@/lib/api/errors';
import { cancelRestaurantEmailQueueJob } from '@/server/queue/email';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import { handleQueueJobMutation, queueJobNotFound, type QueueJobRouteContext } from '../_shared';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE = '/api/ops/email-queue/[jobId]/cancel';

export async function POST(request: NextRequest, context: QueueJobRouteContext) {
  return withCsrfProtectedMutation(request, () =>
    handleQueueJobMutation(request, context, {
      route: ROUTE,
      rateLimitScope: 'ops-email-queue:cancel',
      rateLimit: 20,
      rateLimitMessage: 'Too many cancel attempts. Wait a moment and try again.',
      run: async ({ jobId, restaurantId }) => {
        const result = await cancelRestaurantEmailQueueJob({ jobId, restaurantId });
        switch (result) {
          case 'cancelled':
            return NextResponse.json({ ok: true, jobId, action: 'cancelled' }, { status: 200 });
          case 'in_progress':
            return conflict(
              'JOB_IN_PROGRESS',
              'This email is being sent right now, so it can no longer be cancelled.',
            );
          case 'not_cancellable':
            return conflict('JOB_NOT_CANCELLABLE', 'Only scheduled emails can be cancelled.');
          case 'not_found':
          default:
            return queueJobNotFound();
        }
      },
    }),
  );
}
