import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest} from 'next/server';

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

const paramsSchema = z.object({
  id: z.string().uuid(),
});

async function resolveInviteId(paramsPromise: Promise<{ id: string | string[] }>): Promise<string | null> {
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

export async function DELETE(_request: NextRequest, context: RouteParams) {
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

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('restaurant_invites')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      console.error('[ops][team][invitations][DELETE]', deleteError);
      return NextResponse.json({ error: 'Unable to delete invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ops][team][invitations][DELETE]', error);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
