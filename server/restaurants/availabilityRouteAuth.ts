import { apiError, forbidden, internalError, type ApiErrorBody } from '@/lib/api/errors';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextResponse } from 'next/server';

export type AvailabilityRouteActor = {
  userId: string;
  userEmail: string | null;
};

type RouteParams = Promise<{ id: string | string[] }> | undefined;

export async function resolveAvailabilityRouteRestaurantId(
  paramsPromise: RouteParams,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const { id } = await paramsPromise;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

function membershipErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Session + restaurant-admin check shared by the availability routes (hours, service periods,
 * turn bands and the availability command). Runs before the request body is read, so an
 * unauthorised caller learns nothing about validation. Responses use the C1 error contract.
 */
export async function authorizeAvailabilityAdmin(
  restaurantId: string,
  route: string,
): Promise<NextResponse<ApiErrorBody> | AvailabilityRouteActor> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message, {
      retryable: mapped.status >= 500,
    });
  }

  if (!user) {
    return apiError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId, client: supabase });
  } catch (error) {
    if (membershipErrorCode(error) === 'MEMBERSHIP_VALIDATION_UNAVAILABLE') {
      return internalError(error, { route, restaurantId, stage: 'membership' });
    }
    return forbidden('FORBIDDEN', 'Only restaurant owners and managers can change availability.');
  }

  return { userId: user.id, userEmail: user.email ?? null };
}
