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

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const state = await getGoogleBusinessProfileConnectionState(restaurantId);
    return NextResponse.json(state);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load Google Business Profile connection.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
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
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const state = await linkGoogleBusinessProfileLocation(restaurantId, payload);
    return NextResponse.json(state);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to link Google Business Profile location.';
    const status = message.includes('no longer available') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return access;
  }

  let payload: z.infer<typeof syncSchema>;
  try {
    payload = syncSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: payload.password,
    });

    const state = await syncGoogleBusinessProfileBusinessInformation(restaurantId);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
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

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) {
    return access;
  }

  try {
    const state = await disconnectGoogleBusinessProfileConnection(restaurantId);
    return NextResponse.json(state);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to disconnect Google Business Profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
