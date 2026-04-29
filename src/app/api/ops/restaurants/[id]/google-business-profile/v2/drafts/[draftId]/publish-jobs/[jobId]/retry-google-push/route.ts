/**
 * Phase 4 of the GBP Dual-Sync V2 architecture.
 *
 * POST .../v2/drafts/{draftId}/publish-jobs/{jobId}/retry-google-push
 *
 * Re-runs the export-to-Google leg for a publish job that previously
 * failed only on the Google leg. The orchestrator's idempotency contract
 * means a job already in a terminal state is a no-op.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { googleBusinessProfileWorkflowErrorResponse } from '@/app/api/ops/restaurants/[id]/google-business-profile/_shared';
import { isGbpSyncV2Enabled } from '@/server/google-business-profile-v2/flag';
import {
  setPublishJobStatus,
  getPublishJob,
} from '@/server/google-business-profile-v2/preflight/store';
import { executePublish } from '@/server/google-business-profile-v2/publish/orchestrator';
import { buildOrchestratorPorts } from '@/server/google-business-profile-v2/publish/wiring';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    draftId: string | string[];
    jobId: string | string[];
  }>;
};

async function resolveJobId(p: RouteContext['params']): Promise<string | null> {
  const { jobId } = await p;
  if (typeof jobId === 'string') return jobId;
  if (Array.isArray(jobId)) return jobId[0] ?? null;
  return null;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  const jobId = await resolveJobId(params);
  if (!restaurantId || !jobId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
  }
  if (!isGbpSyncV2Enabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'V2 sync is not enabled for this restaurant.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'gbp-sync-v2-retry-google');
  if (access instanceof NextResponse) return access;

  try {
    const client = getServiceSupabaseClient();
    const job = await getPublishJob({ client, jobId });
    if (!job || job.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Publish job not found' }, { status: 404 });
    }
    if (job.directionIntent !== 'export_to_google') {
      return NextResponse.json(
        { error: 'Only export_to_google jobs can be retried.' },
        { status: 422 },
      );
    }
    if (job.status !== 'failed' && job.status !== 'partial') {
      return NextResponse.json(
        { error: `Publish job is not retry-eligible (status=${job.status}).` },
        { status: 422 },
      );
    }
    // Move job back to preflight_locked so the orchestrator will execute it
    // again. Errors are cleared on the retry attempt.
    await setPublishJobStatus({
      client,
      jobId,
      status: 'preflight_locked',
      patch: {
        retried_at: new Date().toISOString(),
        retried_by_user_id: access.userId,
        errors: [] as never,
      },
    });
    const ports = buildOrchestratorPorts({ client });
    const outcome = await executePublish({ client, jobId, actorUserId: access.userId, ports });
    return NextResponse.json(outcome);
  } catch (error) {
    return googleBusinessProfileWorkflowErrorResponse(error, {
      fallbackMessage: 'Unable to retry V2 Google push.',
      status: 500,
    });
  }
}

export const runtime = 'nodejs';
