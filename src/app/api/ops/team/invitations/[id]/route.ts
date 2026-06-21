import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';
import { revokeRestaurantInvite, type RestaurantInvite } from '@/server/team/invitations';

import type { NextRequest } from 'next/server';

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function serializeInvite(invite: RestaurantInvite) {
  return {
    id: invite.id,
    restaurantId: invite.restaurant_id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expires_at,
    invitedBy: invite.invited_by,
    acceptedAt: invite.accepted_at,
    revokedAt: invite.revoked_at,
    createdAt: invite.created_at,
    updatedAt: invite.updated_at,
  };
}

async function resolveInviteId(
  paramsPromise: Promise<{ id: string | string[] }>,
): Promise<string | null> {
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function DELETE(_request: NextRequest, context: RouteParams) {
  return withCsrfProtectedMutation(_request, () => deleteTeamInvitation(_request, context));
}

async function deleteTeamInvitation(_request: NextRequest, context: RouteParams) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const inviteId = await resolveInviteId(context.params);
  if (!inviteId) {
    return NextResponse.json({ error: 'Missing invitation id' }, { status: 400 });
  }

  const parsed = paramsSchema.safeParse({ id: inviteId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invitation id' }, { status: 400 });
  }

  try {
    // Get invitation details to check permissions
    const { data: invite, error: inviteError } = await supabase
      .from('restaurant_invites')
      .select('id, restaurant_id')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError) {
      console.error('[ops][team][invitations][DELETE]', inviteError);
      return NextResponse.json({ error: 'Unable to fetch invitation' }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if user has admin access to this restaurant
    try {
      await requireAdminMembership({
        userId: user.id,
        restaurantId: invite.restaurant_id,
        client: supabase,
      });
    } catch (error) {
      console.error('[ops][team][invitations][DELETE] permission denied', error);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const revokedInvite = await revokeRestaurantInvite({
      inviteId,
      restaurantId: invite.restaurant_id,
      authClient: supabase,
    });

    return NextResponse.json({ invite: serializeInvite(revokedInvite) });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'INVITE_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Invitation is no longer pending', code: 'INVITE_NOT_FOUND' },
        { status: 409 },
      );
    }

    console.error('[ops][team][invitations][DELETE]', error);
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-team-invitation' },
    });
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
