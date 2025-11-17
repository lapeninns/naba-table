import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getRestaurantDetails,
  updateRestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/server/restaurants/details';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest} from 'next/server';

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

const detailsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(120)
    .optional(),
  timezone: z.string().min(1),
  capacity: z.number().int().min(0).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  bookingPolicy: z.string().max(800).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

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
    console.error('[ops][restaurants][details] admin permission required', error);
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

    const details = await getRestaurantDetails(restaurantId);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][details][GET]');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let payload: UpdateRestaurantDetailsInput;
  try {
    const json = await req.json();
    const parsed = detailsSchema.parse(json);
    payload = {
      name: parsed.name,
      slug: parsed.slug,
      timezone: parsed.timezone,
      capacity: parsed.capacity ?? null,
      contactPhone: parsed.phone ?? null,
      contactEmail: parsed.email ?? null,
      address: parsed.address ?? null,
      bookingPolicy: parsed.bookingPolicy ?? null,
      logoUrl: parsed.logoUrl ?? null,
    };
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

    const details = await updateRestaurantDetails(restaurantId, payload);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][details][PUT]');
  }
}
