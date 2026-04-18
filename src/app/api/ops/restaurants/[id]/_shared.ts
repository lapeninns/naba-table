import { NextResponse } from 'next/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

type RouteParams = Promise<{ id: string | string[] }> | undefined;

export async function resolveRestaurantId(paramsPromise: RouteParams): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function ensureRestaurantAdminAccess(
  restaurantId: string,
  scope: string = 'menu',
): Promise<NextResponse | { userId: string; userEmail: string | null }> {
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
    console.error(`[ops][${scope}] admin permission required`, error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId: user.id, userEmail: user.email ?? null };
}
