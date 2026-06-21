import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import {
  disconnectGoogleBusinessProfileConnection,
  getGoogleBusinessProfileConnectionState,
  linkGoogleBusinessProfileLocation,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';

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
  return NextResponse.json({ message, error: message, ...extra }, { status });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return access;
  }

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId,
    action: 'connection-state-read',
    limit: 60,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const state = await getGoogleBusinessProfileConnectionState(restaurantId);
    return NextResponse.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load Google Business Profile connection.';
    return errorResponse(message, 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof linkSchema>;
  try {
    const parsed = linkSchema.parse(await req.json());
    payload = parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid payload', error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return errorResponse('Invalid payload', 400);
  }

  try {
    const state = await linkGoogleBusinessProfileLocation(restaurantId, payload);
    return NextResponse.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to link Google Business Profile location.';
    const status = message.includes('no longer available') ? 404 : 500;
    return errorResponse(message, status);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof syncSchema>;
  try {
    payload = syncSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
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
      return rateLimit;
    }

    const state = await syncGoogleBusinessProfileBusinessInformation(restaurantId);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Unable to sync Google Business Profile business information.';

    const status =
      message.includes('Link a Google Business Profile location') ||
      message.includes('not connected')
        ? 409
        : message.includes('authorization') || message.includes('reconnect')
          ? 409
          : 500;

    return errorResponse(message, status);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return errorResponse('Missing restaurant id', 400);
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile', req);
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof disconnectSchema>;
  try {
    payload = disconnectSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
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
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unable to disconnect Google Business Profile.';
    return errorResponse(message, 500);
  }
}
