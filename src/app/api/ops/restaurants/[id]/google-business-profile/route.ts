import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { logger } from '@/lib/logger';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { loadGbpOperatorConnectionState } from '@/server/dual-sync/freshness/operator-connection-state';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
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

function errorResponse(message: string, status: number, extra?: Record<string, unknown>) {
  return gbpNoStoreJson({ message, error: message, ...extra }, { status });
}

// The status is still derived from the domain message, but the response carries fixed copy and a
// stable code only: the message can carry provider or database internals.
function unexpectedErrorResponse(
  error: unknown,
  restaurantId: string,
  action: 'link' | 'sync' | 'disconnect',
  response: { message: string; status: number; code: string },
) {
  logger.error(`ops.restaurants.google-business-profile.${action} failed`, {
    route: 'ops.restaurants.google-business-profile',
    restaurantId,
    status: response.status,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  return errorResponse(response.message, response.status, { code: response.code });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
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
  } catch {
    return errorResponse('Unable to load Google Business Profile connection.', 500, {
      code: 'GBP_CONNECTION_STATE_FAILED',
    });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof linkSchema>;
  try {
    const parsed = linkSchema.parse(await req.json());
    payload = parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(
        { message: 'Invalid payload', error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return errorResponse('Invalid payload', 400);
  }

  try {
    const state = await linkGoogleBusinessProfileLocation(restaurantId, payload);
    return gbpNoStoreJson(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return unexpectedErrorResponse(
      error,
      restaurantId,
      'link',
      message.includes('no longer available')
        ? {
            message: 'The selected Google Business Profile location is no longer available.',
            status: 404,
            code: 'GBP_LOCATION_NOT_FOUND',
          }
        : {
            message: 'Unable to link Google Business Profile location.',
            status: 500,
            code: 'GBP_LINK_FAILED',
          },
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof syncSchema>;
  try {
    payload = syncSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(
        { message: 'Invalid payload', error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return errorResponse('Invalid payload', 400);
  }

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
      return gbpNoStoreJson(
        { message: error.message, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : '';
    return unexpectedErrorResponse(
      error,
      restaurantId,
      'sync',
      message.includes('Link a Google Business Profile location') ||
        message.includes('not connected')
        ? {
            message:
              'Connect Google and link a Google Business Profile location before syncing business information.',
            status: 409,
            code: 'GBP_LOCATION_NOT_LINKED',
          }
        : message.includes('authorization') || message.includes('reconnect')
          ? {
              message: 'Reconnect Google Business Profile, then try again.',
              status: 409,
              code: 'GBP_REAUTH_REQUIRED',
            }
          : {
              message: 'Unable to sync Google Business Profile business information.',
              status: 500,
              code: 'GBP_SYNC_FAILED',
            },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return gbpNoStoreResponse(access);
  }

  let payload: z.infer<typeof disconnectSchema>;
  try {
    payload = disconnectSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return gbpNoStoreJson(
        { message: 'Invalid payload', error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return errorResponse('Invalid payload', 400);
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    const state = await disconnectGoogleBusinessProfileConnection(restaurantId);
    return gbpNoStoreJson(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return gbpNoStoreJson(
        { message: error.message, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return unexpectedErrorResponse(error, restaurantId, 'disconnect', {
      message: 'Unable to disconnect Google Business Profile.',
      status: 500,
      code: 'GBP_DISCONNECT_FAILED',
    });
  }
}
