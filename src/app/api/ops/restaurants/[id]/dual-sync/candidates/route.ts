/**
 * GET /api/ops/restaurants/{id}/dual-sync/candidates
 *
 * Returns durable outbound candidates for one restaurant. Open rows drive
 * auto-export; terminal rows are kept for audit and operator recovery.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { internalError } from '@/lib/api/errors';
import { listOutboundCandidates } from '@/server/dual-sync/outbound';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { captureSafeGbpException } from '@/server/dual-sync/retention/telemetry';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { DualSyncOutboundStatus } from '@/server/dual-sync';
import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

const VALID_STATUSES: ReadonlyArray<DualSyncOutboundStatus> = [
  'open',
  'resolved',
  'superseded',
  'cancelled',
];

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseStatuses(raw: string | null): ReadonlyArray<DualSyncOutboundStatus> | undefined {
  if (!raw) return ['open'];
  const out: DualSyncOutboundStatus[] = [];
  for (const piece of raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    if ((VALID_STATUSES as ReadonlyArray<string>).includes(piece)) {
      out.push(piece as DualSyncOutboundStatus);
    }
  }
  return out.length > 0 ? out : ['open'];
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-candidates');
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  try {
    const candidates = await listOutboundCandidates({
      client: getServiceSupabaseClient(),
      restaurantId,
      limit: parseLimit(req.nextUrl.searchParams.get('limit')),
      statuses: parseStatuses(req.nextUrl.searchParams.get('status')),
    });

    return gbpNoStoreJson({ restaurantId, candidates }, { status: 200 });
  } catch (error) {
    captureSafeGbpException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-candidates' },
    });
    return gbpNoStoreResponse(
      internalError(
        error,
        { route: '/api/ops/restaurants/[id]/dual-sync/candidates', restaurantId },
        'Failed to load dual-sync candidates.',
      ),
    );
  }
}

export const runtime = 'nodejs';
