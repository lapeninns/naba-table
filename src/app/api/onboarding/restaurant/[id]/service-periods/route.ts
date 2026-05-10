import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { withRestaurantAuthorization } from '@/server/auth/guards';
import { updateServicePeriods } from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

const periodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string().trim(),
  endTime: z.string().trim(),
  bookingOption: z.string().trim().min(1),
});

const requestSchema = z.object({
  servicePeriods: z.array(periodSchema),
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
    const message =
      updateError instanceof Error ? updateError.message : 'Unable to save service periods';
    return NextResponse.json({ message }, { status: 500 });
  }
}
