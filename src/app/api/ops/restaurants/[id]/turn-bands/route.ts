import { NextResponse } from 'next/server';

import { apiError, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  authorizeAvailabilityAdmin,
  resolveAvailabilityRouteRestaurantId,
} from '@/server/restaurants/availabilityRouteAuth';
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

  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
  if (actor instanceof NextResponse) {
    return actor;
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
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

  // Authorise before reading the body.
  const actor = await authorizeAvailabilityAdmin(restaurantId, ROUTE);
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
