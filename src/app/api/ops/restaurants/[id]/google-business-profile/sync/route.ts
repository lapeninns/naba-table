import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { syncRestaurantGoogleBusinessProfile } from '@/server/google-business-profile/service';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const syncSchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  locationId: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let payload: z.infer<typeof syncSchema> = {};
  try {
    payload = syncSchema.parse(await request.json().catch(() => ({})));
  } catch (parseError) {
    if (parseError instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: parseError.flatten() }, { status: 400 });
    }
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId, client: supabase });
    const serviceClient = getServiceSupabaseClient();
    const result = await syncRestaurantGoogleBusinessProfile(
      {
        restaurantId,
        accountId: payload.accountId ?? null,
        locationId: payload.locationId ?? null,
      },
      serviceClient,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][sync] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to sync Google Business Profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
