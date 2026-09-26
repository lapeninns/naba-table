import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { apiError, internalError, validationError } from '@/lib/api/errors';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { loadGbpOperatorConnectionState } from '@/server/dual-sync/freshness/operator-connection-state';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import {
  classifyGoogleBusinessProfileRouteError,
  type GoogleBusinessProfileRouteAction,
} from '@/server/google-business-profile/routeErrors';
import {
  disconnectGoogleBusinessProfileConnection,
  getGoogleBusinessProfileConnectionState,
  linkGoogleBusinessProfileLocation,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const linkSchema = z.object({
  accountName: z.string().min(1),
  accountId: z.string().min(1),
  locationName: z.string().min(1),
  locationId: z.string().min(1),
});
const syncSchema = z.object({
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});
const disconnectSchema = syncSchema;

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

const ROUTE = 'ops.restaurants.google-business-profile';

function missingRestaurantId() {
  return gbpNoStoreResponse(apiError(400, 'MISSING_RESTAURANT_ID', 'Missing restaurant id.'));
}

async function readJsonBody(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => undefined);
}

function invalidBody(body: unknown, error?: z.ZodError) {
  if (body === undefined) {
    return gbpNoStoreResponse(apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
  }
  return gbpNoStoreResponse(
    error ? validationError(error) : apiError(400, 'VALIDATION_FAILED', 'Invalid payload.'),
  );
}

function passwordConfirmationFailure(error: PasswordConfirmationError) {
  return gbpNoStoreResponse(apiError(error.status, error.code, error.message));
}

/**
 * Known GBP failures are classified by `GoogleBusinessProfileError.code` (never by message);
 * anything else is logged and returned as a generic 500.
 */
function serviceFailure(
  error: unknown,
  restaurantId: string,
  action: GoogleBusinessProfileRouteAction,
  fallbackMessage: string,
) {
  const known = classifyGoogleBusinessProfileRouteError(error, action);
  if (known) {
    return gbpNoStoreResponse(
      apiError(known.status, known.code, known.message, {
        retryable: known.retryable,
      }),
    );
  }
  return gbpNoStoreResponse(
    internalError(error, { route: ROUTE, restaurantId, action }, fallbackMessage),
  );
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'connection-state-read',
    limit: 60,
  });
  if (rateLimit) {
    return gbpNoStoreResponse(rateLimit);
  }

  try {
    const state = await getGoogleBusinessProfileConnectionState(restaurantId);
    const response = await loadGbpOperatorConnectionState({
      client: getServiceSupabaseClient(),
      restaurantId,
      connection: state,
    });
    return gbpNoStoreJson(response);
  } catch (error) {
    return serviceFailure(
      error,
      restaurantId,
      'read',
      'Unable to load Google Business Profile connection.',
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  const body = await readJsonBody(req);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return invalidBody(body, parsed.error);
  }

  try {
    const state = await linkGoogleBusinessProfileLocation(restaurantId, parsed.data);
    return gbpNoStoreJson(state);
  } catch (error) {
    return serviceFailure(
      error,
      restaurantId,
      'link',
      'Unable to link Google Business Profile location.',
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  const body = await readJsonBody(req);
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return invalidBody(body, parsed.error);
  }
  const payload = parsed.data;

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    const rateLimit = await requireProviderRefreshBudget({
      provider: 'google_business_profile',
      restaurantId,
      action: 'business-info-sync',
    });
    if (rateLimit) {
      return gbpNoStoreResponse(rateLimit);
    }

    const state = await syncGoogleBusinessProfileBusinessInformation(restaurantId);
    return gbpNoStoreJson(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return passwordConfirmationFailure(error);
    }
    return serviceFailure(
      error,
      restaurantId,
      'sync',
      'Unable to sync Google Business Profile business information.',
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return missingRestaurantId();
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  const body = await readJsonBody(req);
  const parsed = disconnectSchema.safeParse(body);
  if (!parsed.success) {
    return invalidBody(body, parsed.error);
  }
  const payload = parsed.data;

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    const state = await disconnectGoogleBusinessProfileConnection(restaurantId);
    return gbpNoStoreJson(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return passwordConfirmationFailure(error);
    }
    return serviceFailure(
      error,
      restaurantId,
      'disconnect',
      'Unable to disconnect Google Business Profile.',
    );
  }
}
