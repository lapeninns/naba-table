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
import { isDualSyncEnabled } from '@/server/dual-sync/flag';
import { runPublish } from '@/server/dual-sync/publish/orchestrator';
import { defaultDualSyncPorts } from '@/server/dual-sync/publish/ports';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const decisionSchema = z.object({
  fieldKey: z.string().min(1),
  sectionKey: z.enum([
    'profile',
    'operatingHours',
    'servicePeriods',
    'businessContext.categories',
    'businessContext.serviceAreas',
    'businessContext.attributes',
    'businessContext.serviceItems',
  ]),
  action: z.enum(['import_from_google', 'export_to_google', 'ignore']),
  pinnedCoreHash: z.string().nullable().default(null),
  pinnedGbpHash: z.string().nullable().default(null),
});

const publishRequestSchema = z.object({
  decisions: z.array(decisionSchema).min(1).max(200),
  pinnedCoreSnapshotHash: z.string().nullable().optional(),
  pinnedGbpSnapshotHash: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }
  if (!isDualSyncEnabled({ restaurantId })) {
    return NextResponse.json(
      { error: 'Dual-sync is not enabled for this deployment.' },
      { status: 404 },
    );
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-publish');
  if (access instanceof NextResponse) return access;

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text.length > 0 ? JSON.parse(text) : null;
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
    const result = await runPublish(
      getServiceSupabaseClient(),
      {
        restaurantId,
        decisions: parsed.data.decisions,
        actorUserId: access.userId,
        pinnedCoreSnapshotHash: parsed.data.pinnedCoreSnapshotHash ?? null,
        pinnedGbpSnapshotHash: parsed.data.pinnedGbpSnapshotHash ?? null,
      },
      {
        ports: defaultDualSyncPorts(),
      },
    );
    return NextResponse.json(result.summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
