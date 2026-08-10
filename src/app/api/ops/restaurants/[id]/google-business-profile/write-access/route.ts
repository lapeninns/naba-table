import { NextResponse } from 'next/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { gbpWriteAccessRequestV1Schema } from '@/server/dual-sync/contracts';
import {
  GbpWriteAccessTransitionError,
  loadGbpOperatorConnectionState,
  setGbpOperatorWriteAccess,
} from '@/server/dual-sync/freshness/operator-connection-state';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { getGoogleBusinessProfileConnectionState } from '@/server/google-business-profile/service';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

function safeError(message: string, code: string, status: number) {
  return gbpNoStoreJson({ message, error: message, code }, { status });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) return safeError('Missing restaurant id', 'INVALID_RESTAURANT_ID', 400);

  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile-write-access',
    req,
  );
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  const parsed = gbpWriteAccessRequestV1Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return safeError('Invalid payload', 'GBP_WRITE_ACCESS_INVALID_REQUEST', 400);
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: parsed.data.password,
    });
    const client = getServiceSupabaseClient();
    await setGbpOperatorWriteAccess({
      client,
      restaurantId,
      actorUserId: access.userId,
      enabled: parsed.data.eligible,
    });
    const connection = await getGoogleBusinessProfileConnectionState(restaurantId);
    const response = await loadGbpOperatorConnectionState({ client, restaurantId, connection });
    return gbpNoStoreJson(response);
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      return safeError(error.message, error.code, error.status);
    }
    if (error instanceof GbpWriteAccessTransitionError) {
      return safeError(error.message, error.code, error.status);
    }
    return safeError(
      'Unable to change Google Business Profile write access.',
      'GBP_WRITE_ACCESS_FAILED',
      500,
    );
  }
}
