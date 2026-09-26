import { z } from 'zod';

import { apiError, internalError, notFound, unauthenticated, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { GuardError, requireRestaurantMember, requireSession } from '@/server/auth/guards';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import type { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export type QueueJobRouteContext = { params: Promise<{ jobId: string }> };

const bodySchema = z.object({
  restaurantId: z.string().uuid(),
});

const JOB_NOT_FOUND_MESSAGE = 'That email job no longer exists.';

export function queueJobNotFound() {
  return notFound('NOT_FOUND', JOB_NOT_FOUND_MESSAGE);
}

/**
 * Shared shell for the operator queue-job mutations (cancel, requeue): validate the job id and
 * body, rate limit per user and job, require restaurant membership (a non-member sees a uniform
 * 404), then run the action. Responses use the C1 error contract.
 */
export async function handleQueueJobMutation(
  request: NextRequest,
  context: QueueJobRouteContext,
  options: {
    route: string;
    rateLimitScope: string;
    rateLimit: number;
    rateLimitMessage: string;
    run: (input: { jobId: string; restaurantId: string }) => Promise<NextResponse>;
  },
): Promise<NextResponse> {
  const { jobId: rawJobId } = await context.params;
  const jobId = rawJobId?.trim() ?? '';
  if (!jobId || jobId.length > 512) {
    return apiError(400, 'INVALID_REQUEST', 'Invalid job id.');
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, 'INVALID_REQUEST', 'Invalid request body.');
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const { restaurantId } = parsed.data;

  try {
    const { supabase, user } = await requireSession();

    const rateLimit = await requireApiRateLimit({
      request,
      scope: options.rateLimitScope,
      userId: user.id,
      parts: [restaurantId, jobId],
      limit: options.rateLimit,
      windowMs: 60_000,
      message: options.rateLimitMessage,
    });
    if (rateLimit) return rateLimit;

    await requireRestaurantMember({ supabase, userId: user.id, restaurantId });

    return await options.run({ jobId, restaurantId });
  } catch (error) {
    if (error instanceof GuardError) {
      return error.code === 'UNAUTHENTICATED' ? unauthenticated() : queueJobNotFound();
    }

    captureServerException(error, {
      properties: { source: 'ops', path: options.route },
    });
    return internalError(error, { route: options.route, restaurantId });
  }
}
