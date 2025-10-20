import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getServicePeriods,
  updateServicePeriods,
  type UpdateServicePeriod,
} from '@/server/restaurants/servicePeriods';
import { getOccasionCatalog } from '@/server/occasions/catalog';
import { TIME_REGEX, canonicalTime } from '@/server/restaurants/timeNormalization';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

const timeSchema = z
  .string()
  .trim()
  .regex(TIME_REGEX)
  .transform((value) => canonicalTime(value));
const nameSchema = z.string().min(1).max(80);

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveRestaurantId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

async function ensureAuthorized(restaurantId: string): Promise<NextResponse | null> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });
  } catch (error) {
    console.error('[owner][restaurants][service-periods] admin permission required', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

function handleUnexpectedError(error: unknown, context: string) {
  console.error(context, error);

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse) {
      return authResponse;
    }

    const periods = await getServicePeriods(restaurantId);
    return NextResponse.json({ restaurantId, periods });
  } catch (error) {
    return handleUnexpectedError(error, '[owner][restaurants][service-periods][GET]');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let payload: UpdateServicePeriod[];
  try {
    const json = await req.json();
    const baseSchema = z.object({
      id: z.string().uuid().optional(),
      name: nameSchema,
      dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
      startTime: timeSchema,
      endTime: timeSchema,
      bookingOption: z.string().trim().min(1),
    });
    payload = z.array(baseSchema).parse(json) as UpdateServicePeriod[];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const catalog = await getOccasionCatalog();
  const validKeys = new Set(catalog.definitions.map((definition) => definition.key.toLowerCase()));

  const sanitizedPayload = payload.map((entry) => ({
    ...entry,
    bookingOption: entry.bookingOption.trim().toLowerCase(),
  })) as UpdateServicePeriod[];

  const invalidEntry = sanitizedPayload.find((entry) => !validKeys.has(entry.bookingOption));
  if (invalidEntry) {
    return NextResponse.json({ error: `Unknown occasion "${invalidEntry.bookingOption}"` }, { status: 400 });
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse) {
      return authResponse;
    }

    const periods = await updateServicePeriods(restaurantId, sanitizedPayload);
    return NextResponse.json({ restaurantId, periods });
  } catch (error) {
    return handleUnexpectedError(error, '[owner][restaurants][service-periods][PUT]');
  }
}
