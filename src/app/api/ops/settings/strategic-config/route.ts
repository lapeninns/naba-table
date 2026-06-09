import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getStrategicConfigSnapshot } from '@/server/capacity/strategic-config';
import { clearStrategicCaches } from '@/server/capacity/strategic-maintenance';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership, requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const getQuerySchema = z.object({
  restaurantId: z.string().uuid(),
});

const payloadSchema = z.object({
  restaurantId: z.string().uuid(),
  weights: z.object({
    scarcity: z.number().min(0).max(1000),
    demandMultiplier: z.number().min(0).max(10).nullable().optional(),
    futureConflictPenalty: z.number().min(0).max(100000).nullable().optional(),
  }),
});

function formatResponse(params: {
  restaurantId: string;
  source: 'db' | 'env';
  scarcityWeight: number;
  demandMultiplierOverride: number | null;
  futureConflictPenalty: number | null;
  updatedAt: string | null;
}) {
  return {
    restaurantId: params.restaurantId,
    source: params.source,
    weights: {
      scarcity: params.scarcityWeight,
      demandMultiplier: params.demandMultiplierOverride,
      futureConflictPenalty: params.futureConflictPenalty,
    },
    updatedAt: params.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const query = getQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!query.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const { restaurantId } = query.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/settings][strategic-config][GET] auth lookup failed', error.message);
    const mapped = mapSupabaseAuthError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId });
  } catch (membershipError) {
    console.error('[ops/settings][strategic-config][GET] membership check failed', membershipError);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = getStrategicConfigSnapshot({ restaurantId });
    return NextResponse.json(
      formatResponse({
        restaurantId,
        source: snapshot.source,
        scarcityWeight: snapshot.scarcityWeight,
        demandMultiplierOverride: snapshot.demandMultiplierOverride,
        futureConflictPenalty: snapshot.futureConflictPenalty,
        updatedAt: snapshot.updatedAt,
      }),
    );
  } catch (settingsError) {
    console.error('[ops/settings][strategic-config][GET] failed to load config', settingsError);
    captureServerException(settingsError, {
      properties: { source: 'ops', kind: 'ops-strategic-config' },
    });
    return NextResponse.json({ error: 'Unable to load strategic settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { restaurantId } = payload.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/settings][strategic-config][POST] auth lookup failed', error.message);
    const mapped = mapSupabaseAuthError(error);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
  } catch (membershipError) {
    console.error(
      '[ops/settings][strategic-config][POST] membership check failed',
      membershipError,
    );
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  clearStrategicCaches();

  return NextResponse.json(
    {
      error:
        'Strategic configuration is now defined in code/env. Deploy a change to update weights.',
    },
    { status: 501 },
  );
}
