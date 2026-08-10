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
  gbpNotificationParticipationResponseV1Schema,
  gbpTerminalNoticesResponseV1Schema,
} from '@/server/dual-sync/contracts';
import { getGoogleWriteTerminalNoticeCensus } from '@/server/dual-sync/notifications';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import { setGoogleBusinessProfileNotificationParticipation } from '@/server/google-business-profile/service';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { readonly params: Promise<{ readonly id: string | string[] }> };

const participationSchema = z
  .object({
    enabled: z.boolean(),
    password: z.string().trim().min(1),
  })
  .strict();

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) return gbpNoStoreJson({ error: 'Missing restaurant id' }, { status: 400 });
  const access = await ensureRestaurantAdminAccess(restaurantId, 'google-business-profile');
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  const client = getServiceSupabaseClient();
  const now = new Date().toISOString();
  try {
    const [notices, census] = await Promise.all([
      client
        .from('gbp_terminal_outcome_notices_v1')
        .select(
          'id,grant_id,event_id,terminal_kind,safe_reason_code,requires_fresh_preview,status,terminal_at,due_at,dispatched_at,outcome_unknown_at,delivered_at,failed_at,last_error_code,created_at',
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100),
      getGoogleWriteTerminalNoticeCensus({ client, restaurantId, now }),
    ]);
    if (notices.error) throw notices.error;
    const safeNotices = (notices.data ?? []).map((notice) => ({
      ...notice,
      providerInstruction: notice.requires_fresh_preview
        ? 'refresh_then_create_new_preview'
        : 'none',
      operationalDeliveryInstruction:
        notice.status === 'outcome_unknown'
          ? 'in_app_notice_available_verify_operational_channel'
          : 'none',
    }));
    const response = gbpTerminalNoticesResponseV1Schema.parse({
      notices: safeNotices,
      census,
      asOf: now,
    });
    return gbpNoStoreJson(response);
  } catch {
    return gbpNoStoreJson({ error: 'Unable to load Google write notifications.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) return gbpNoStoreJson({ error: 'Missing restaurant id' }, { status: 400 });
  const access = await ensureRestaurantAdminAccess(
    restaurantId,
    'google-business-profile',
    request,
  );
  if (access instanceof NextResponse) return gbpNoStoreResponse(access);

  const parsed = participationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return gbpNoStoreJson(
      { error: 'Invalid notification participation request.' },
      { status: 400 },
    );
  }

  try {
    await verifyUserPasswordConfirmation({
      email: access.userEmail,
      password: parsed.data.password,
    });
    const result = await setGoogleBusinessProfileNotificationParticipation(
      restaurantId,
      parsed.data.enabled,
    );
    return gbpNoStoreJson(gbpNotificationParticipationResponseV1Schema.parse(result));
  } catch (error) {
    if (error instanceof PasswordConfirmationError || error instanceof GoogleBusinessProfileError) {
      return gbpNoStoreJson({ error: error.message, code: error.code }, { status: error.status });
    }
    return gbpNoStoreJson(
      { error: 'Unable to update Google notification participation.' },
      { status: 500 },
    );
  }
}
