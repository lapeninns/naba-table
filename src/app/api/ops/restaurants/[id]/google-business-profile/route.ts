import { NextResponse } from 'next/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  getRestaurantGoogleBusinessProfileStatus,
  refreshRestaurantGoogleBusinessProfileCatalog,
  removeRestaurantGoogleBusinessProfile,
} from '@/server/google-business-profile/service';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureAuthorized(restaurantId: string) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    return { response: NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status }), user: null };
  }

  if (!user) {
    return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }), user: null };
  }

  try {
    await requireAdminMembership({ userId: user.id, restaurantId, client: supabase });
  } catch (membershipError) {
    console.error('[ops][restaurant-google-business-profile] membership check failed', membershipError);
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  }

  return { response: null, user };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const auth = await ensureAuthorized(restaurantId);
  if (auth.response) {
    return auth.response;
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    const status = await getRestaurantGoogleBusinessProfileStatus(restaurantId, serviceClient);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][GET] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to load Google Business Profile status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const auth = await ensureAuthorized(restaurantId);
  if (auth.response) {
    return auth.response;
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    const status = await refreshRestaurantGoogleBusinessProfileCatalog(restaurantId, serviceClient);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][POST] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to refresh Google Business Profile locations.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: restaurantId } = await context.params;
  const auth = await ensureAuthorized(restaurantId);
  if (auth.response) {
    return auth.response;
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    await removeRestaurantGoogleBusinessProfile(restaurantId, serviceClient);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ops][restaurant-google-business-profile][DELETE] failed', error);
    const message = error instanceof Error ? error.message : 'Unable to disconnect Google Business Profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
