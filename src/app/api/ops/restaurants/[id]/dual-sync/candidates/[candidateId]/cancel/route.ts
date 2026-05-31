/**
 * POST /api/ops/restaurants/{id}/dual-sync/candidates/{candidateId}/cancel
 *
 * Cancels an open outbound candidate for the scoped restaurant. The row
 * remains in the audit trail; only its status changes.
 */

import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { cancelOutboundCandidate } from '@/server/dual-sync/outbound';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; candidateId: string | string[] }>;
};

function resolveCandidateId(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (Array.isArray(value)) return value[0] && value[0].length > 0 ? value[0] : null;
  return null;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const resolved = await params;
  const restaurantId = await resolveRestaurantId(Promise.resolve({ id: resolved.id }));
  const candidateId = resolveCandidateId(resolved.candidateId);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  if (!candidateId) {
    return dualSyncErrorResponse('Missing candidate id', 400);
  }
  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'dual-sync-candidate-cancel',
    _req,
  );
  if (access instanceof NextResponse) return access;

  try {
    const candidate = await cancelOutboundCandidate({
      client: getServiceSupabaseClient(),
      restaurantId,
      candidateId,
    });
    if (!candidate) {
      return dualSyncErrorResponse(
        'Dual-sync candidate is not cancellable for this restaurant.',
        404,
        'DUAL_SYNC_CANDIDATE_NOT_CANCELLABLE',
      );
    }
    return NextResponse.json({ restaurantId, candidate }, { status: 200 });
  } catch (error) {
    console.error('[dual-sync][candidate-cancel] failed', error);
    return dualSyncErrorResponse(
      'Failed to cancel dual-sync candidate',
      500,
      'DUAL_SYNC_CANDIDATE_CANCEL_ERROR',
    );
  }
}

export const runtime = 'nodejs';
