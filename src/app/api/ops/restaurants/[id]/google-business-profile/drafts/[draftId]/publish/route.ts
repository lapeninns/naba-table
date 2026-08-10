// TODO(gbp-ia-audit-20260502-1201): Orphan route handler with no client caller after the F-10 hook deletions; decide whether to delete or rewire it.
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { captureRestaurantServerEvent } from '@/lib/posthog/server';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { publishGoogleBusinessProfileWorkflowDraft } from '@/server/google-business-profile/workflow';

import type { GoogleBusinessProfileFieldDecisionInput } from '@/server/google-business-profile/workflow';
import type { NextRequest } from 'next/server';
const directionIntentSchema = z.enum([
  'google_to_nabatable',
  'google_to_nabatable_with_google_sync',
  'nabatable_to_google',
]);

const publishSchema = z
  .object({
    password: z.string().trim().min(1, 'Enter your password to confirm this GBP publish.'),
    publishJobId: z.string().trim().min(1, 'Run preflight before publishing.').optional(),
    publishPlanId: z.string().trim().min(1, 'Run preflight before publishing.').optional(),
    idempotencyKey: z.string().trim().min(1, 'Run preflight before publishing.'),
    selectedApprovals: z.record(z.string(), z.boolean()).optional(),
    decisions: z
      .array(
        z.object({
          sectionKey: z.string().trim().min(1),
          fieldKey: z.string().trim().min(1),
          action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
          reviewedNabatableValueHash: z.string().trim().min(1),
          reviewedGoogleValueHash: z.string().trim().min(1),
        }),
      )
      .optional(),
    directionIntent: directionIntentSchema.optional(),
    pushToGoogle: z.boolean().optional(),
  })
  .refine((payload) => payload.publishJobId || payload.publishPlanId, {
    message: 'Run preflight before publishing.',
    path: ['publishPlanId'],
  });

function getPublishErrorStatus(error: unknown): number {
  if (
    error instanceof Error &&
    (error.name === 'GBP_DRAFT_STALE' ||
      error.name === 'GBP_DRAFT_INVALID_STATE' ||
      error.name === 'GBP_DRAFT_NOT_APPROVED' ||
      error.name === 'GBP_GOOGLE_PUSH_DISABLED' ||
      error.name === 'GBP_GOOGLE_PUSH_FAILED' ||
      error.name === 'GBP_DIRECTION_CONFLICT' ||
      error.name === 'GBP_DECISION_INVALID' ||
      error.name === 'GBP_PUBLISH_JOB_MISMATCH' ||
      error.name === 'GBP_PUBLISH_JOB_INVALID_STATE')
  ) {
    return error.name === 'GBP_DIRECTION_CONFLICT' || error.name === 'GBP_DECISION_INVALID'
      ? 400
      : 409;
  }
  if (error instanceof Error && error.name === 'GBP_PUBLISH_JOB_NOT_FOUND') {
    return 404;
  }

  return 500;
}

type RouteContext = {
  params: Promise<{ id: string | string[]; draftId: string | string[] }>;
};

function legacyGoogleWriteRetiredResponse() {
  return gbpNoStoreJson(
    {
      error: 'Legacy Google Business Profile writes are retired.',
      code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED',
    },
    { status: 410 },
  );
}

function isCoreOnlyPublish(payload: z.infer<typeof publishSchema>): boolean {
  if (payload.decisions?.some((decision) => decision.action === 'export_to_google') ?? false) {
    return false;
  }
  return (
    payload.directionIntent === 'google_to_nabatable' ||
    (payload.directionIntent === undefined && payload.pushToGoogle === false)
  );
}

async function resolveDraftId(paramsPromise: RouteContext['params']): Promise<string | null> {
  const params = await paramsPromise;
  const { draftId } = params;
  if (typeof draftId === 'string') return draftId;
  if (Array.isArray(draftId)) return draftId[0] ?? null;
  return null;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const [restaurantId, draftId] = await Promise.all([
    resolveRestaurantId(params),
    resolveDraftId(params),
  ]);
  if (!restaurantId || !draftId) {
    return gbpNoStoreJson({ error: 'Missing restaurant or draft id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-publish',
    req,
  );
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof publishSchema>;
  try {
    payload = publishSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return gbpNoStoreJson({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!isCoreOnlyPublish(payload)) {
    return legacyGoogleWriteRetiredResponse();
  }

  captureRestaurantServerEvent('gbp_publish_started', {
    restaurantId,
    distinctId: access.userId,
    props: { draftId, source: 'ops' },
  });

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    const published = await publishGoogleBusinessProfileWorkflowDraft({
      restaurantId,
      draftId,
      actorUserId: access.userId,
      publishJobId: payload.publishJobId,
      publishPlanId: payload.publishPlanId,
      idempotencyKey: payload.idempotencyKey,
      selectedApprovals: payload.selectedApprovals,
      decisions: payload.decisions as GoogleBusinessProfileFieldDecisionInput[] | undefined,
      directionIntent: payload.directionIntent,
      pushToGoogle: payload.pushToGoogle,
    });

    captureRestaurantServerEvent('gbp_publish_completed', {
      restaurantId,
      distinctId: access.userId,
      props: { draftId, source: 'ops' },
    });

    return gbpNoStoreJson(published);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return gbpNoStoreJson({ message: error.message, code: error.code }, { status: error.status });
    }

    const status = getPublishErrorStatus(error);
    captureRestaurantServerEvent('gbp_publish_failed', {
      restaurantId,
      distinctId: access.userId,
      props: { draftId, source: 'ops', status },
    });
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: {
        draftId,
        source: 'ops',
        status,
        path: '/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish',
      },
    });

    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to publish Google Business Profile review draft.',
      status,
    });
  }
}

export const runtime = 'nodejs';
