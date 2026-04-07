import { NextResponse } from 'next/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { buildGoogleBusinessProfileAuthorizationUrl } from '@/server/google-business-profile/oauth';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

  try {
    await requireAdminMembership({ userId: user.id, restaurantId, client: supabase });
    const authorizationUrl = buildGoogleBusinessProfileAuthorizationUrl({
      restaurantId,
      returnTo: '/settings/restaurant/profile',
    });
    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][connect] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to start Google Business Profile connect flow.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
