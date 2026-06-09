import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { ensureProfileRow } from '@/lib/profile/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import {
  acceptInviteForAuthenticatedUser,
  findInviteByToken,
  inviteHasExpired,
  markInviteExpired,
} from '@/server/team/invitations';

import type { NextRequest } from 'next/server';

const paramsSchema = z.object({ token: z.string().min(10) });

const payloadSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
});

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return withCsrfProtectedMutation(request, () => postAcceptInvitation(request, context));
}

async function postAcceptInvitation(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedPayload = payloadSchema.safeParse(body);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const sessionClient = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser();

    if (authError) {
      const mapped = mapSupabaseAuthError(authError);
      return NextResponse.json(
        { error: mapped.message, code: mapped.code },
        { status: mapped.status },
      );
    }

    if (!user?.id || !user.email) {
      return NextResponse.json(
        { error: 'Sign in as the invited email before accepting this invitation' },
        { status: 401 },
      );
    }

    const invite = await findInviteByToken(parsedParams.data.token);

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.status === 'revoked') {
      return NextResponse.json({ error: 'Invitation revoked' }, { status: 410 });
    }

    if (invite.status === 'accepted') {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
    }

    if (invite.status === 'expired' || inviteHasExpired(invite)) {
      if (invite.status === 'pending') {
        await markInviteExpired(invite.id);
      }
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    const service = getServiceSupabaseClient();
    await acceptInviteForAuthenticatedUser({
      invite,
      userId: user.id,
      userEmail: user.email,
      client: service,
    });
    const profileUser = parsedPayload.data.name
      ? {
          ...user,
          user_metadata: {
            ...(user.user_metadata ?? {}),
            name: parsedPayload.data.name,
          },
        }
      : user;
    await ensureProfileRow(service, profileUser);

    return NextResponse.json({
      success: true,
      email: invite.email.toLowerCase(),
      restaurantId: invite.restaurant_id,
      role: invite.role,
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'INVITE_EMAIL_MISMATCH') {
        return NextResponse.json(
          { error: 'Sign in as the invited email before accepting this invitation' },
          { status: 403 },
        );
      }
      if (code === 'INVITE_ROLE_FORBIDDEN' || code === 'INVALID_INVITE_ROLE') {
        return NextResponse.json(
          { error: 'Invitation role is no longer allowed' },
          { status: 403 },
        );
      }
      if (code === 'INVITE_NOT_FOUND') {
        return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
      }
    }

    console.error('[api/team/invitations/token/accept][POST] failed', error);
    captureServerException(error, {
      properties: { source: 'api', kind: 'team-invitation-accept' },
    });
    return NextResponse.json({ error: 'Unable to accept invitation' }, { status: 500 });
  }
}
