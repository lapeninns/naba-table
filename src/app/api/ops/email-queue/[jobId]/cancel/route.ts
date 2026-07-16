import { NextResponse } from 'next/server';
import { z } from 'zod';

import { captureServerException } from '@/lib/posthog/server';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import { cancelRestaurantEmailQueueJob } from '@/server/queue/email';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  restaurantId: z.string().uuid(),
});

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message, message }, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  return withCsrfProtectedMutation(request, () => postCancel(request, context));
}

async function postCancel(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId: rawJobId } = await context.params;
  const jobId = rawJobId?.trim() ?? '';
  if (!jobId) {
    return jsonError(400, 'INVALID_REQUEST', 'Invalid job id.');
  }

  let restaurantId: string;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return jsonError(400, 'INVALID_REQUEST', 'Invalid request body.');
    }
    restaurantId = parsed.data.restaurantId;
  } catch {
    return jsonError(400, 'INVALID_REQUEST', 'Invalid request body.');
  }

  try {
    const { supabase, user } = await requireSession();

    const rateLimit = await requireApiRateLimit({
      request,
      scope: 'ops-email-queue:cancel',
      userId: user.id,
      parts: [restaurantId, jobId],
      limit: 20,
      windowMs: 60_000,
      message: 'Too many queue cancel attempts. Please try again later.',
    });
    if (rateLimit) return rateLimit;

    try {
      await requireRestaurantMember({
        supabase,
        userId: user.id,
        restaurantId,
      });
    } catch (error) {
      if (error instanceof GuardError) {
        if (error.code === 'UNAUTHENTICATED') {
          return jsonError(401, 'UNAUTHENTICATED', error.message);
        }
        return jsonError(404, 'NOT_FOUND', 'Queue job not found.');
      }
      throw error;
    }

    const result = await cancelRestaurantEmailQueueJob({ jobId, restaurantId });
    if (result === 'not_found') {
      return jsonError(404, 'NOT_FOUND', 'Queue job not found.');
    }

    return NextResponse.json({ ok: true, jobId, action: 'cancelled' }, { status: 200 });
  } catch (error) {
    if (error instanceof GuardError) {
      if (error.code === 'UNAUTHENTICATED') {
        return jsonError(401, 'UNAUTHENTICATED', error.message);
      }
      return jsonError(404, 'NOT_FOUND', 'Queue job not found.');
    }

    captureServerException(error, {
      properties: { source: 'ops', path: '/api/ops/email-queue/[jobId]/cancel' },
    });
    return jsonError(500, 'INTERNAL', 'Internal error');
  }
}
