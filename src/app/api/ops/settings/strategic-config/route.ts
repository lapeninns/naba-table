import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getStrategicConfigSnapshot } from '@/server/capacity/strategic-config';
import { clearStrategicCaches } from '@/server/capacity/strategic-maintenance';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership, requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/settings/strategic-config';

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

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
    return validationError(query.error);
  }

  const { restaurantId } = query.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    logger.warn('[ops/settings][strategic-config][GET] auth lookup failed', {
      route: ROUTE,
      status: mapped.status,
    });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId });
  } catch (membershipError) {
    logger.warn('[ops/settings][strategic-config][GET] membership check failed', {
      route: ROUTE,
      errorName: errorName(membershipError),
    });
    return forbidden();
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
    captureServerException(settingsError, {
      properties: { source: 'ops', kind: 'ops-strategic-config' },
    });
    return internalError(settingsError, { route: ROUTE }, 'Unable to load strategic settings');
  }
}

export async function POST(request: NextRequest) {
  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return validationError(payload.error);
  }

  const { restaurantId } = payload.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    logger.warn('[ops/settings][strategic-config][POST] auth lookup failed', {
      route: ROUTE,
      status: mapped.status,
    });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId });
  } catch (membershipError) {
    logger.warn('[ops/settings][strategic-config][POST] membership check failed', {
      route: ROUTE,
      errorName: errorName(membershipError),
    });
    return forbidden();
  }

  clearStrategicCaches();

  return apiError(
    501,
    'STRATEGIC_CONFIG_READ_ONLY',
    'Strategic settings are read-only. Deploy a configuration change to update weights.',
  );
}
