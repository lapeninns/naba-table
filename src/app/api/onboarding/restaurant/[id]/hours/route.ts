import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { updateOperatingHours } from '@/server/restaurants/operatingHours';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const operatingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z.string().trim().nullable(),
  closesAt: z.string().trim().nullable(),
  isClosed: z.boolean(),
  notes: z.string().nullable().optional(),
  reservationIntervalMinutes: z
    .number()
    .int()
    .min(RESERVATION_INTERVAL_MIN)
    .max(RESERVATION_INTERVAL_MAX)
    .nullable()
    .optional(),
  reservationSlotTimes: z.array(z.string().trim()).nullable().optional(),
});

const requestSchema = z.object({
  operatingHours: z.array(operatingHourSchema),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const authorization = await withRestaurantAuthorization(req, restaurantId, {
    csrf: true,
    roles: RESTAURANT_ADMIN_ROLES,
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const snapshot = await updateOperatingHours(
      restaurantId,
      {
        weekly: parsed.data.operatingHours,
        overrides: [],
      },
      getServiceSupabaseClient(),
    );
    return NextResponse.json({ operatingHours: snapshot });
  } catch (updateError) {
    console.error('[onboarding][hours][PATCH]', updateError);
    captureServerException(updateError, {
      distinctId: authorization.user.id,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'api', kind: 'onboarding-hours' },
    });
    const message =
      updateError instanceof Error ? updateError.message : 'Unable to save operating hours';
    return NextResponse.json({ message }, { status: 500 });
  }
}
