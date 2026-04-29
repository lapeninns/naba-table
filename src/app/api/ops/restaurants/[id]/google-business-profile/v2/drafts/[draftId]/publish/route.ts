/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * POST /api/ops/restaurants/{id}/google-business-profile/v2/drafts/{draftId}/publish
 *
 * Executes a publish job. The job must be `preflight_locked` and its frozen
 * contract is re-verified by the orchestrator before any writer is invoked.
 *
 * Operator password is verified server-side with the same stateless
 * Supabase re-auth checkpoint used by the legacy workflow.
 *
 * NOTE: Phase 4 ships the orchestrator + audit + rollback wiring. The
 * actual writer ports are stubbed (see `wiring.ts`); a publish call WILL
 * return a typed `unsupported_field` failure until Phase 4.5 closes the
 * writer integration gap. This is intentional — see the task harness.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';
import { executePublish } from '@/server/google-business-profile-v2/publish/orchestrator';
import { buildOrchestratorPorts } from '@/server/google-business-profile-v2/publish/wiring';
import { getServiceSupabaseClient } from '@/server/supabase';

import { publishRequestSchema } from '../../../_v2-schemas';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; draftId: string | string[] }>;
};

async function resolveDraftId(p: RouteContext['params']): Promise<string | null> {
  const { draftId } = await p;
  if (typeof draftId === 'string') return draftId;
  if (Array.isArray(draftId)) return draftId[0] ?? null;
  return null;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const draftId = await resolveDraftId(params);
  if (!restaurantId || !draftId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
  }
  if (!isGbpSyncV2Enabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'V2 sync is not enabled for this restaurant.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-publish');
  if (access instanceof NextResponse) return access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = publishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: parsed.data.confirmPassword,
    });

    const client = getServiceSupabaseClient();
    const ports = buildOrchestratorPorts({ client });
    const outcome = await executePublish({
      client,
      jobId: parsed.data.publishJobId,
      actorUserId: access.userId,
      ports,
    });
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }

    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to execute V2 sync publish.',
      status: 500,
    });
  }
}

export const runtime = 'nodejs';
