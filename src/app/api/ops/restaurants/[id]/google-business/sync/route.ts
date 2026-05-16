import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import {
  getGoogleBusinessProfileBusinessDetailsStatus,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';
import { requireProviderRefreshBudget } from '@/server/security/provider-rate-limit';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../_shared';

import type { NextRequest } from 'next/server';

const syncSchema = z.object({
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params, req);
  if (resolved instanceof NextResponse) {
    return resolved;
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

    return googleBusinessErrorResponse(error, 'Unable to confirm Google Business Profile sync.');
  }

  const rateLimit = await requireProviderRefreshBudget({
    provider: 'google_business_profile',
    restaurantId: resolved.restaurantId,
    action: 'business-info-sync',
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    await syncGoogleBusinessProfileBusinessInformation(resolved.restaurantId);
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to sync Google Business Profile snapshot.');
  }
}
