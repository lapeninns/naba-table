/**
 * Phase 3b of the unified dual-sync engine.
 *
 * POST /api/ops/restaurants/{id}/dual-sync/publish
 *
 * Runs the per-field publish orchestrator with the project's default
 * concrete ports (profile imports wired; other sections + exports
 * pending). Returns the publish-job summary so the UI can render the
 * resulting per-field operation rows and any failures.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  dualSyncErrorResponse,
  dualSyncPausedResponse,
} from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { logger } from '@/lib/logger';
import { DUAL_SYNC_SECTION_KEYS } from '@/server/dual-sync';
import {
  gbpExactPublishRequestV1Schema,
  gbpPublishResponseV1Schema,
} from '@/server/dual-sync/contracts';
import {
  assertDualSyncRestaurantNotPaused,
  isDualSyncRestaurantPausedError,
} from '@/server/dual-sync/controls';
import { isDualSyncLockError } from '@/server/dual-sync/locks';
import {
  buildSupportedExactConsentPlan,
  confirmExactConsentAndIssue,
  ExactConsentError,
  readSupportedExactConsentEligibility,
  readSupportedGoogleUpdates,
  withExactConsentListingLock,
  type FreshExactConsentPlan,
} from '@/server/dual-sync/publish/exact-consent';
import { exactConsentPublicError } from '@/server/dual-sync/publish/exact-consent/public-errors';
import { createDurableDualSyncGoogleEditThrottle } from '@/server/dual-sync/publish/google-safety';
import { runPublish } from '@/server/dual-sync/publish/orchestrator';
import { defaultDualSyncPorts } from '@/server/dual-sync/publish/ports';
import { enqueueDualSyncJob } from '@/server/dual-sync/queue';
import { gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const decisionSchema = z.object({
  fieldKey: z.string().min(1),
  sectionKey: z.enum(DUAL_SYNC_SECTION_KEYS),
  action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
  pinnedCoreHash: z.string().nullable(),
  pinnedGbpHash: z.string().nullable(),
});

const publishRequestSchema = z.object({
  decisions: z.array(decisionSchema).min(1).max(200),
  clientRequestId: z.string().trim().min(1).max(128).optional(),
  publishBatchId: z.string().trim().min(1).max(128).optional(),
  pinnedCoreSnapshotHash: z.string().nullable().optional(),
  pinnedGbpSnapshotHash: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string | string[] }> };

function privateNoStore(response: NextResponse): NextResponse {
  return gbpNoStoreResponse(response);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return privateNoStore(dualSyncErrorResponse('Missing restaurant id', 400));
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish', req);
  if (access instanceof NextResponse) return privateNoStore(access);

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return privateNoStore(
      dualSyncErrorResponse('Invalid JSON body', 400, 'DUAL_SYNC_INVALID_JSON'),
    );
  }
  const exactRequested = body !== null && typeof body === 'object' && 'confirmationVersion' in body;
  const parsed = (exactRequested ? gbpExactPublishRequestV1Schema : publishRequestSchema).safeParse(
    body,
  );
  if (!parsed.success) {
    return privateNoStore(
      dualSyncErrorResponse('Invalid request', 422, 'DUAL_SYNC_INVALID_REQUEST', {
        details: parsed.error.flatten(),
      }),
    );
  }

  try {
    const client = getServiceSupabaseClient();
    await assertDualSyncRestaurantNotPaused({ client, restaurantId });
    if (exactRequested && 'confirmationVersion' in parsed.data) {
      const exact = gbpExactPublishRequestV1Schema.parse(parsed.data);
      let fresh: Awaited<ReturnType<typeof buildSupportedExactConsentPlan>> | undefined;
      const result = await confirmExactConsentAndIssue({
        client,
        submittedPreview: exact.preview,
        acknowledged: exact.acknowledged,
        riskAcknowledgements: exact.riskAcknowledgements,
        actorUserId: access.userId,
        mode: exact.mode,
        withListingLock: (work) => withExactConsentListingLock(client, restaurantId, work),
        rebuild: async (window): Promise<FreshExactConsentPlan> => {
          fresh = await buildSupportedExactConsentPlan({
            client,
            publish: {
              restaurantId,
              decisions: exact.decisions,
              actorUserId: access.userId,
              clientRequestId: exact.clientRequestId ?? null,
              publishBatchId: exact.publishBatchId ?? null,
              pinnedCoreSnapshotHash: exact.pinnedCoreSnapshotHash ?? null,
              pinnedGbpSnapshotHash: exact.pinnedGbpSnapshotHash ?? null,
            },
            clock: () => new Date(window.issuedAt),
          });
          if (fresh.preview.expiresAt !== window.expiresAt) {
            throw new ExactConsentError('GBP_PREVIEW_MISMATCH', 'The approval window was changed.');
          }
          return fresh;
        },
        readEligibility: async () => {
          if (!fresh) throw new Error('Exact write plan was not rebuilt.');
          return readSupportedExactConsentEligibility({ client, preview: fresh.preview });
        },
        readGoogleUpdates: async () => {
          if (!fresh) throw new Error('Exact write plan was not rebuilt.');
          return readSupportedGoogleUpdates({
            accessToken: fresh.linked.accessToken,
            preview: fresh.preview,
          });
        },
      });
      const response = gbpPublishResponseV1Schema.parse(result);
      return privateNoStore(
        NextResponse.json(response, { status: response.mode === 'queued' ? 202 : 200 }),
      );
    }
    if (parsed.data.decisions.some((decision) => decision.action === 'export_to_google')) {
      return privateNoStore(
        dualSyncErrorResponse(
          'Google exports require an exact-consent preview and confirmation.',
          409,
          'GBP_EXACT_CONSENT_REQUIRED',
        ),
      );
    }
    if (req.nextUrl.searchParams.get('queue') === '1') {
      const job = await enqueueDualSyncJob({
        client,
        restaurantId,
        jobKind: 'publish_batch',
        idempotencyKey: parsed.data.clientRequestId ?? null,
        payload: {
          decisions: parsed.data.decisions,
          actorUserId: access.userId,
          clientRequestId: parsed.data.clientRequestId ?? null,
          publishBatchId: parsed.data.publishBatchId ?? null,
          pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
          pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
        },
        priority: 50,
      });
      return privateNoStore(NextResponse.json({ queued: true, job }, { status: 202 }));
    }

    const result = await runPublish(
      client,
      {
        restaurantId,
        decisions: parsed.data.decisions,
        actorUserId: access.userId,
        clientRequestId: parsed.data.clientRequestId ?? null,
        publishBatchId: parsed.data.publishBatchId ?? null,
        pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
        pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
      },
      {
        ports: defaultDualSyncPorts(),
        googleEditThrottle: createDurableDualSyncGoogleEditThrottle(client),
        refreshGoogleBeforePublish: true,
      },
    );
    return privateNoStore(NextResponse.json(result.summary, { status: 200 }));
  } catch (error) {
    if (isDualSyncRestaurantPausedError(error)) {
      return privateNoStore(dualSyncPausedResponse('Google synchronization is paused.'));
    }
    if (isDualSyncLockError(error)) {
      return privateNoStore(
        dualSyncErrorResponse(
          'Another Google synchronization job is active.',
          409,
          'DUAL_SYNC_LOCK_HELD',
        ),
      );
    }
    const publicError = exactConsentPublicError(error, 'publish');
    logger.error('Exact Google write failed.', {
      restaurantId,
      failureKind: publicError.code,
    });
    return privateNoStore(
      dualSyncErrorResponse(publicError.message, publicError.status, publicError.code),
    );
  }
}

export const runtime = 'nodejs';
