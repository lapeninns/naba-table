import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import {
  disconnectGoogleBusinessProfileConnection,
  getGoogleBusinessProfileBusinessDetailsStatus,
} from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from './_shared';

import type { NextRequest } from 'next/server';

const disconnectSchema = z.object({
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(
      error,
      'Unable to load Google Business Profile business details.',
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params, _req);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  let payload: z.infer<typeof disconnectSchema>;
  try {
    payload = disconnectSchema.parse(await _req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid payload', error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: 'Invalid payload', error: 'Invalid payload' },
      { status: 400 },
    );
  }

  try {
    await verifyUserPasswordConfirmation({
      email: resolved.access.userEmail,
      password: payload.password,
    });
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return NextResponse.json(
        { message: error.message, error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return googleBusinessErrorResponse(
      error,
      'Unable to confirm Google Business Profile disconnect.',
    );
  }

  try {
    await disconnectGoogleBusinessProfileConnection(resolved.restaurantId);
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to disconnect Google Business Profile.');
  }
}
