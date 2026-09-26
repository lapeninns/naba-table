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
import { buildOperationsHub } from '@/server/ops/operations-hub';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/operations-hub';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  zoneId: z.string().uuid().optional(),
  service: z.enum(['lunch', 'dinner', 'all']).optional(),
});

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const query = parsed.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    logger.warn('[ops/operations-hub] failed to resolve auth', {
      route: ROUTE,
      status: mapped.status,
    });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    logger.warn('[ops/operations-hub] membership validation failed', {
      route: ROUTE,
      errorName: errorName(membershipError),
    });
    return forbidden();
  }

  try {
    const payload = await buildOperationsHub({
      restaurantId: query.restaurantId,
      date: query.date,
      zoneId: query.zoneId,
      service: query.service,
      client: supabase,
    });

    return NextResponse.json(payload);
  } catch (hubError) {
    captureServerException(hubError, {
      distinctId: user.id,
      groups: { restaurant: query.restaurantId },
      properties: { restaurantId: query.restaurantId, source: 'ops', kind: 'operations-hub' },
    });
    return internalError(hubError, { route: ROUTE }, 'Unable to load operations hub');
  }
}
