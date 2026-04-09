import { NextResponse } from 'next/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { buildGoogleBusinessProfileAuthorizationUrl } from '@/server/google-business-profile/oauth';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getEffectiveRequestOrigin(request: NextRequest): string {
  const fallback = new URL(request.url);
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (!host) {
    return fallback.origin;
  }

  const nextUrl = new URL(request.url);
  nextUrl.protocol = forwardedProto ? `${forwardedProto}:` : nextUrl.protocol;
  nextUrl.host = host;
  return nextUrl.origin;
}

export async function POST(request: NextRequest, context: RouteContext) {
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
      returnTo: '/settings/restaurant/google-business-profile',
      returnOrigin: getEffectiveRequestOrigin(request),
    });
    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][connect] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to start Google Business Profile connect flow.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
