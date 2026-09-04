import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import {
  getReviewGrowthDashboard,
  ReviewGrowthTrackingUnavailableError,
} from '@/server/reviews/dashboard';

import type { ReviewGrowthSummaryResponse } from '@/types/reviewGrowth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  range: z.enum(['7d', '30d']).default('7d'),
});

function errorResponse(
  status: number,
  code: Extract<ReviewGrowthSummaryResponse, { ok: false }>['code'],
  error: string,
) {
  return NextResponse.json({ ok: false, code, error, message: error }, { status });
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) return errorResponse(400, 'INTERNAL', 'Invalid query');

  try {
    const { supabase, user } = await requireSession();
    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const restaurantId =
      parsed.data.restaurantId ??
      memberships.find((membership) => membership.restaurant_id)?.restaurant_id;
    if (!restaurantId) return errorResponse(403, 'FORBIDDEN', 'No restaurant access');
    await requireRestaurantMember({ supabase, userId: user.id, restaurantId });

    const summary = await getReviewGrowthDashboard({
      range: parsed.data.range,
      restaurantId,
    });
    return NextResponse.json({
      ok: true,
      range: parsed.data.range,
      restaurantId,
      summary,
    } satisfies Extract<ReviewGrowthSummaryResponse, { ok: true }>);
  } catch (error) {
    if (error instanceof GuardError) {
      return errorResponse(
        error.status,
        error.code === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        error.message,
      );
    }
    if (error instanceof ReviewGrowthTrackingUnavailableError) {
      return errorResponse(503, 'TRACKING_UNAVAILABLE', error.message);
    }
    return errorResponse(500, 'INTERNAL', 'Internal error');
  }
}
