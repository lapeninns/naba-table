import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { updateServicePeriods } from '@/server/restaurants/servicePeriods';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_ONBOARDING_SERVICE_PERIODS = 50;
const MAX_ONBOARDING_SERVICE_PERIOD_NAME_LENGTH = 80;
const MAX_ONBOARDING_BOOKING_OPTION_LENGTH = 32;

const periodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(MAX_ONBOARDING_SERVICE_PERIOD_NAME_LENGTH),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string().trim().max(8),
  endTime: z.string().trim().max(8),
  bookingOption: z.string().trim().min(1).max(MAX_ONBOARDING_BOOKING_OPTION_LENGTH),
});

const requestSchema = z.object({
  servicePeriods: z.array(periodSchema).max(MAX_ONBOARDING_SERVICE_PERIODS),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const authorization = await withRestaurantAuthorization(req, restaurantId, {
    csrf: true,
    roles: RESTAURANT_ADMIN_ROLES,
  });
  if (!authorization.ok) {
    return authorization.response;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'onboarding:service-periods',
    tenantId: restaurantId,
    userId: authorization.user.id,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many service-period updates. Please try again in a moment.',
  });
  if (rateLimit) {
    return rateLimit;
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
    const periods = await updateServicePeriods(
      restaurantId,
      parsed.data.servicePeriods,
      getServiceSupabaseClient(),
    );
    return NextResponse.json({ servicePeriods: periods });
  } catch (updateError) {
    console.error('[onboarding][service-periods][PATCH]', updateError);
    captureServerException(updateError, {
      distinctId: authorization.user.id,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'api', kind: 'onboarding-service-periods' },
    });
    const message =
      updateError instanceof Error ? updateError.message : 'Unable to save service periods';
    return NextResponse.json({ message }, { status: 500 });
  }
}
