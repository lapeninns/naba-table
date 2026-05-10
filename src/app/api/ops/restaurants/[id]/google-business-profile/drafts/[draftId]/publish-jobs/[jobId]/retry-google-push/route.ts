// TODO(gbp-ia-audit-20260502-1201): Orphan route handler; no client caller after the F-10 hook deletions. See tasks/google-business-profile-ia-audit-20260502-1201/FINDINGS.md (F-11). Decide whether to delete or rewire in a follow-up.
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { retryGoogleBusinessProfileWorkflowGooglePush } from '@/server/google-business-profile/workflow';

import type { NextRequest } from 'next/server';

const retrySchema = z.object({
  password: z.string().trim().min(1, 'Enter your password to retry Google-only sync.'),
});

type RouteContext = {
  params: Promise<{
    id: string | string[];
    draftId: string | string[];
    jobId: string | string[];
  }>;
};

async function resolveRouteIds(paramsPromise: RouteContext['params']): Promise<{
  draftId: string | null;
  jobId: string | null;
}> {
  const params = await paramsPromise;
  const draftId = typeof params.draftId === 'string' ? params.draftId : (params.draftId[0] ?? null);
  const jobId = typeof params.jobId === 'string' ? params.jobId : (params.jobId[0] ?? null);
  return { draftId, jobId };
}

function getRetryErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.name === 'GBP_PUBLISH_JOB_NOT_FOUND') return 404;
    if (
      error.name === 'GBP_PUBLISH_JOB_INVALID_STATE' ||
      error.name === 'GBP_GOOGLE_PUSH_DISABLED' ||
      error.name === 'GBP_PUBLISH_JOB_CORE_CHANGED'
    ) {
      return 409;
    }
  }
  return 500;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const [restaurantId, ids] = await Promise.all([
    resolveRestaurantId(params),
    resolveRouteIds(params),
  ]);
  if (!restaurantId || !ids.draftId || !ids.jobId) {
    return NextResponse.json({ error: 'Missing restaurant, draft, or job id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile-retry');
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof retrySchema>;
  try {
    payload = retrySchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    return NextResponse.json(
      await retryGoogleBusinessProfileWorkflowGooglePush({
        restaurantId,
        draftId: ids.draftId,
        publishJobId: ids.jobId,
        actorUserId: access.userId,
      }),
    );
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }

    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to retry Google Business Profile push.',
      status: getRetryErrorStatus(error),
    });
  }
}

export const runtime = 'nodejs';
