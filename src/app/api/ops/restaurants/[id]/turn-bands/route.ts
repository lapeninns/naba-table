import { NextResponse } from 'next/server';

import {
  apiError,
  forbidden,
  internalError,
  validationError,
  type ApiErrorBody,
} from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { resolveAvailabilityRouteRestaurantId } from '@/server/restaurants/availabilityRouteAuth';
import { turnBandsPayloadSchema } from '@/server/restaurants/availabilitySchemas';
import { getServicePeriods } from '@/server/restaurants/servicePeriods';
import { buildTurnBandsSnapshot } from '@/server/restaurants/turnBandDefaults';
import {
  getRestaurantTurnBands,
  replaceRestaurantTurnBands,
  type TurnBandsPayload,
} from '@/server/restaurants/turnBands';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops.restaurants.turn-bands';

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

function missingRestaurantId() {
  return apiError(400, 'RESTAURANT_ID_REQUIRED', 'Missing restaurant id.');
}

type SessionClient = Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>;

function membershipErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Route-level guard: session, then restaurant-admin membership, before the body is read and
 * before any service-role client exists. Kept in this file (not only in the shared availability
 * helper) because the PUT writes with the service client, and the service-role route scanner
 * requires the admin check to be visible where that client is created. Same C1 responses as
 * `authorizeAvailabilityAdmin`.
 */
async function requireTurnBandsAdmin(
  restaurantId: string,
): Promise<NextResponse<ApiErrorBody> | { userId: string; supabase: SessionClient }> {
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
      return internalError(error, { route: ROUTE, restaurantId, stage: 'membership' });
    }
    return forbidden('FORBIDDEN', 'Only restaurant owners and managers can change availability.');
  }

  return { userId: user.id, supabase };
}

function handleFailure(error: unknown, method: string, restaurantId: string) {
  captureServerException(error, { properties: { source: 'ops', kind: 'restaurant-turn-bands' } });

  // Domain validation throws plain Errors before any write; their text is never echoed.
  if (method !== 'GET' && error instanceof Error && error.name === 'Error') {
    return apiError(400, 'SETTINGS_REQUEST_FAILED', 'Unable to process these settings.');
  }
  return internalError(error, { route: ROUTE, method, restaurantId });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const actor = await requireTurnBandsAdmin(restaurantId);
  if (actor instanceof NextResponse) {
    return actor;
  }

  try {
    const { supabase } = actor;
    const [bands, periods] = await Promise.all([
      getRestaurantTurnBands(restaurantId, supabase),
      getServicePeriods(restaurantId, supabase),
    ]);
    return NextResponse.json(buildTurnBandsSnapshot(restaurantId, bands, periods));
  } catch (error) {
    return handleFailure(error, 'GET', restaurantId);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withCsrfProtectedMutation(req, () => putTurnBands(req, { params }));
}

async function putTurnBands(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveAvailabilityRouteRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  // Authorise before reading the body and before any service-role client is created.
  const actor = await requireTurnBandsAdmin(restaurantId);
  if (actor instanceof NextResponse) {
    return actor;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body must be JSON.');
  }
  const parsed = turnBandsPayloadSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const payload: TurnBandsPayload = parsed.data;

  try {
    // replace_restaurant_turn_bands is granted to service_role only (the session client gets
    // "permission denied for function"), so the write runs with the service client once the
    // caller is authorised as an admin of this restaurant. Every statement is restaurant_id scoped.
    const serviceClient = getServiceSupabaseClient();
    const bands = await replaceRestaurantTurnBands(restaurantId, payload, serviceClient);
    const periods = await getServicePeriods(restaurantId, serviceClient);
    return NextResponse.json(buildTurnBandsSnapshot(restaurantId, bands, periods));
  } catch (error) {
    return handleFailure(error, 'PUT', restaurantId);
  }
}
