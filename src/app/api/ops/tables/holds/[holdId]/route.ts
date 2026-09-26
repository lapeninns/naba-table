/**
 * DELETE /api/ops/tables/holds/[holdId]?restaurantId=… — staff release of a table hold from the
 * table timeline. Holds may be unbound (no booking), so only the hold id and the restaurant are
 * needed. Any member of the restaurant may release; the hold is loaded by id and restaurant, so
 * another tenant's hold is a 404. A hold that is already gone from the active set is an
 * idempotent success.
 */

import { NextResponse } from 'next/server';

import { internalError, notFound } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { isUuid, withRestaurantAuthorization } from '@/server/auth/guards';
import { releaseRestaurantTableHold } from '@/server/ops/table-holds';
import { getTenantServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops/tables/holds/[holdId]';

type RouteContext = {
  params: Promise<{ holdId: string }>;
};

type ReleaseTableHoldResponse = {
  data: { holdId: string; released: true; alreadyReleased: boolean };
};

function holdNotFound() {
  return notFound('HOLD_NOT_FOUND', 'This hold has already ended.');
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId');
  const auth = await withRestaurantAuthorization(req, restaurantId, { csrf: true });
  if (!auth.ok) {
    return auth.response;
  }

  const { holdId } = await context.params;
  if (!isUuid(holdId)) {
    return holdNotFound();
  }

  try {
    const result = await releaseRestaurantTableHold({
      client: getTenantServiceSupabaseClient(auth.restaurantId),
      restaurantId: auth.restaurantId,
      holdId,
      actorId: auth.user.id,
    });

    if (!result.found) {
      return holdNotFound();
    }

    logger.info('ops.table_hold.released', {
      restaurantId: auth.restaurantId,
      holdId: result.holdId,
      actorId: auth.user.id,
      alreadyReleased: result.alreadyReleased,
    });

    const body: ReleaseTableHoldResponse = {
      data: { holdId: result.holdId, released: true, alreadyReleased: result.alreadyReleased },
    };
    return NextResponse.json(body);
  } catch (error) {
    return internalError(error, {
      route: ROUTE,
      method: 'DELETE',
      restaurantId: auth.restaurantId,
      holdId,
    });
  }
}
