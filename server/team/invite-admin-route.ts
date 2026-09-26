import { z } from 'zod';

import { apiError, forbidden, internalError, notFound, unauthenticated } from '@/lib/api/errors';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { ApiErrorBody } from '@/lib/api/errors';
import type { Database } from '@/types/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';

export type InviteIdRouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const inviteIdSchema = z.string().uuid();

export type InviteAdminContext = {
  supabase: SupabaseClient<Database>;
  user: User;
  inviteId: string;
  restaurantId: string;
};

/**
 * Shared guard for `/api/ops/team/invitations/[id]/*`: a signed-in user, a valid id, an
 * invite visible to them (RLS) and an owner/manager membership of its restaurant.
 * Returns the context or the C1 error response to send.
 */
export async function resolveInviteAdminContext(
  context: InviteIdRouteParams,
  route: string,
): Promise<InviteAdminContext | NextResponse<ApiErrorBody>> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  const { id } = await context.params;
  const rawId = Array.isArray(id) ? id[0] : id;
  const parsed = inviteIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return apiError(400, 'INVALID_INVITE_ID', 'This invitation id isn’t valid.');
  }
  const inviteId = parsed.data;

  const { data: invite, error: inviteError } = await supabase
    .from('restaurant_invites')
    .select('id, restaurant_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteError) {
    return internalError(inviteError, { route, inviteId });
  }

  if (!invite) {
    return notFound('INVITE_NOT_FOUND', 'This invitation no longer exists.');
  }

  try {
    await requireAdminMembership({
      userId: user.id,
      restaurantId: invite.restaurant_id,
      client: supabase,
    });
  } catch {
    return forbidden('TEAM_INVITES_FORBIDDEN', 'Only owners and managers can manage invitations.');
  }

  return { supabase, user, inviteId, restaurantId: invite.restaurant_id };
}
