import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { buildOperationsHub } from '@/server/ops/operations-hub';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  zoneId: z.string().uuid().optional(),
  service: z.enum(['lunch', 'dinner', 'all']).optional(),
});

type Query = z.infer<typeof querySchema>;

function parseQuery(request: NextRequest): Query | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = querySchema.safeParse(entries);
  if (!result.success) return null;
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[ops/operations-hub] failed to resolve auth', error.message);
    const mapped = mapSupabaseAuthError(error);
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error('[ops/operations-hub] membership validation failed', membershipError);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const payload = await buildOperationsHub({
      restaurantId: query.restaurantId,
      date: query.date,
      zoneId: query.zoneId,
      service: query.service,
      client: supabase,
    });

    return NextResponse.json(payload);
  } catch (hubError) {
    console.error('[ops/operations-hub] failed to build payload', hubError);
    return NextResponse.json({ error: 'Unable to load operations hub' }, { status: 500 });
  }
}
