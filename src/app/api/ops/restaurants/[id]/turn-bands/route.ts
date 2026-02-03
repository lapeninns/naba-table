import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { inferMealTypeFromTime } from '@/server/bookings';
import { getVenuePolicy, type ServiceKey, type TurnBand } from '@/server/capacity/policy';
import { getServicePeriods } from '@/server/restaurants/servicePeriods';
import {
  getRestaurantTurnBands,
  replaceRestaurantTurnBands,
  type TurnBandInput,
  type TurnBandsPayload,
} from '@/server/restaurants/turnBands';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

const bandSchema = z.object({
  maxPartySize: z.number().int(),
  durationMinutes: z.number().int(),
});

const payloadSchema = z.record(z.string(), z.array(bandSchema));

function cloneBands(bands: TurnBand[]): TurnBandInput[] {
  return bands.map((band) => ({
    maxPartySize: band.maxPartySize,
    durationMinutes: band.durationMinutes,
  }));
}

function resolveServiceKey(optionKey: string, startTime: string | null): ServiceKey {
  if (optionKey === 'lunch' || optionKey === 'dinner') {
    return optionKey;
  }
  return inferMealTypeFromTime(startTime ?? '18:00');
}

async function resolveRestaurantId(
  paramsPromise: Promise<{ id: string | string[] }> | undefined,
): Promise<string | null> {
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
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
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
    console.error('[ops][restaurants][turn-bands] admin permission required', error);
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

function deriveDefaultBands(
  optionKeys: Set<string>,
  startTimes: Map<string, string>,
): TurnBandsPayload {
  const policy = getVenuePolicy();
  const defaults: TurnBandsPayload = {};

  optionKeys.forEach((optionKey) => {
    const serviceKey = resolveServiceKey(optionKey, startTimes.get(optionKey) ?? null);
    const service = policy.services[serviceKey];
    if (service?.turnBands?.length) {
      defaults[optionKey] = cloneBands(service.turnBands);
    }
  });

  return defaults;
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

    const supabase = await getRouteHandlerSupabaseClient();
    const [bands, periods] = await Promise.all([
      getRestaurantTurnBands(restaurantId, supabase),
      getServicePeriods(restaurantId, supabase),
    ]);

    const optionKeys = new Set<string>();
    const optionStartTimes = new Map<string, string>();

    periods.forEach((period) => {
      const optionKey = period.bookingOption;
      optionKeys.add(optionKey);
      const existingStart = optionStartTimes.get(optionKey);
      if (!existingStart || period.startTime < existingStart) {
        optionStartTimes.set(optionKey, period.startTime);
      }
    });

    Object.keys(bands).forEach((optionKey) => optionKeys.add(optionKey));
    optionKeys.add('lunch');
    optionKeys.add('dinner');

    const defaults = deriveDefaultBands(optionKeys, optionStartTimes);

    return NextResponse.json({ restaurantId, bands, defaults });
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][turn-bands][GET]');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let payload: TurnBandsPayload;
  try {
    const json = await req.json();
    payload = payloadSchema.parse(json ?? {}) as TurnBandsPayload;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse) {
      return authResponse;
    }

    const supabase = await getRouteHandlerSupabaseClient();
    const bands = await replaceRestaurantTurnBands(restaurantId, payload, supabase);
    const periods = await getServicePeriods(restaurantId, supabase);

    const optionKeys = new Set<string>();
    const optionStartTimes = new Map<string, string>();

    periods.forEach((period) => {
      const optionKey = period.bookingOption;
      optionKeys.add(optionKey);
      const existingStart = optionStartTimes.get(optionKey);
      if (!existingStart || period.startTime < existingStart) {
        optionStartTimes.set(optionKey, period.startTime);
      }
    });

    Object.keys(bands).forEach((optionKey) => optionKeys.add(optionKey));
    optionKeys.add('lunch');
    optionKeys.add('dinner');

    const defaults = deriveDefaultBands(optionKeys, optionStartTimes);

    return NextResponse.json({ restaurantId, bands, defaults });
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][turn-bands][PUT]');
  }
}
