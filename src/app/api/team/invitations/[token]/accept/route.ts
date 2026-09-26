import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, forbidden, internalError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { ensureProfileRow } from '@/lib/profile/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import {
  acceptInviteForAuthenticatedUser,
  findInviteByToken,
  getInviteAvailability,
  markInviteExpired,
} from '@/server/team/invitations';
import { getErrorCode, inviteUnavailableResponse } from '@/server/team/invite-response';

import type { NextRequest } from 'next/server';

const ROUTE = 'team.invitations.accept';

const paramsSchema = z.object({ token: z.string().min(10) });

const payloadSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
});

const SIGN_IN_AS_INVITEE = 'Sign in as the invited email before accepting this invitation.';

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return withCsrfProtectedMutation(request, () => postAcceptInvitation(request, context));
}

/**
 * Why the atomic accept found nothing to accept. The RPC only accepts a pending, unexpired
 * invite; re-reading tells the invitee whether it expired, was revoked or was already accepted.
 */
async function explainRejectedAccept(token: string) {
  const current = await findInviteByToken(token);
  if (!current) {
    return inviteUnavailableResponse('notFound');
  }
  const availability = getInviteAvailability(current);
  if (availability === 'pending') {
    return apiError(
      409,
      'INVITE_NOT_PENDING',
      'This invitation changed while you were accepting it. Reload the page and try again.',
    );
  }
  if (availability === 'expired' && current.status === 'pending') {
    await markInviteExpired(current.id);
  }
  return inviteUnavailableResponse(availability);
}

async function postAcceptInvitation(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    return apiError(400, 'INVALID_INVITE_TOKEN', 'This invitation link isn’t valid.');
  }
  const { token } = parsedParams.data;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsedPayload = payloadSchema.safeParse(body);
  if (!parsedPayload.success) {
    return validationError(parsedPayload.error);
  }

  try {
    const sessionClient = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser();

    if (authError) {
      const mapped = mapSupabaseAuthError(authError);
      return apiError(mapped.status, mapped.code, mapped.message);
    }

    if (!user?.id || !user.email) {
      return apiError(401, 'UNAUTHENTICATED', SIGN_IN_AS_INVITEE);
    }

    const invite = await findInviteByToken(token);

    if (!invite) {
      return inviteUnavailableResponse('notFound');
    }

    const availability = getInviteAvailability(invite);
    if (availability !== 'pending') {
      if (availability === 'expired' && invite.status === 'pending') {
        await markInviteExpired(invite.id);
      }
      return inviteUnavailableResponse(availability);
    }

    const service = getServiceSupabaseClient();
    try {
      await acceptInviteForAuthenticatedUser({
        invite,
        userId: user.id,
        userEmail: user.email,
        client: service,
      });
    } catch (acceptError) {
      if (getErrorCode(acceptError) === 'INVITE_NOT_FOUND') {
        return explainRejectedAccept(token);
      }
      throw acceptError;
    }

    const profileUser = {
      ...user,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        name: parsedPayload.data.name,
      },
    };
    await ensureProfileRow(service, profileUser);

    return NextResponse.json({
      success: true,
      email: invite.email.toLowerCase(),
      restaurantId: invite.restaurant_id,
      role: invite.role,
    });
  } catch (error) {
    const code = getErrorCode(error);
    if (code === 'INVITE_EMAIL_MISMATCH') {
      return forbidden('INVITE_EMAIL_MISMATCH', SIGN_IN_AS_INVITEE);
    }
    if (code === 'INVITE_ROLE_FORBIDDEN' || code === 'INVALID_INVITE_ROLE') {
      return forbidden(
        'INVITE_ROLE_NOT_ALLOWED',
        'This invitation’s role is no longer allowed. Ask the restaurant for a new invitation.',
      );
    }

    captureServerException(error, {
      properties: { source: 'api', kind: 'team-invitation-accept' },
    });
    return internalError(
      error,
      { route: ROUTE },
      'The invitation couldn’t be accepted. Try again.',
    );
  }
}
