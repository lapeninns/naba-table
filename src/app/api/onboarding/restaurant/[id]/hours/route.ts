import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { updateOperatingHours } from '@/server/restaurants/operatingHours';
import { validateCsrfToken } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

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
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ message: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const { id: restaurantId } = await context.params;
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ message: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
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
    const message = updateError instanceof Error ? updateError.message : 'Unable to save operating hours';
    return NextResponse.json({ message }, { status: 500 });
  }
}
