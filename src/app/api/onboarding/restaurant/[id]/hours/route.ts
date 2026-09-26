import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, validationError } from '@/lib/api/errors';
import { findOperatingHourIssues } from '@/lib/onboarding/scheduleRules';
import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { onboardingInternalError } from '@/server/onboarding/errors';
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

// Same rules the writer enforces (both times on open days and different, one row per day),
// checked here so a fixable mistake is a 400 with field paths instead of a 500.
const requestSchema = z
  .object({
    operatingHours: z.array(operatingHourSchema).max(7),
  })
  .superRefine((value, context) => {
    for (const issue of findOperatingHourIssues(value.operatingHours)) {
      context.addIssue({
        code: 'custom',
        path: ['operatingHours', ...issue.path],
        message: issue.message,
      });
    }
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
    return apiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
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
    return onboardingInternalError(
      updateError,
      { route: 'onboarding.restaurant.hours', restaurantId, userId: authorization.user.id },
      "We couldn't save your opening hours. Try again.",
    );
  }
}
