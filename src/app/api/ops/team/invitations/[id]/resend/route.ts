import { NextResponse } from 'next/server';

import { apiError, conflict, internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { resendRestaurantInvite } from '@/server/team/invitations';
import {
  resolveInviteAdminContext,
  type InviteIdRouteParams,
} from '@/server/team/invite-admin-route';
import { getErrorCode, serializeInvite } from '@/server/team/invite-response';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const ROUTE = 'ops.team.invitations.resend';
const WINDOW_MS = 10 * 60 * 1000;

/**
 * POST /api/ops/team/invitations/[id]/resend — re-sends a pending, unexpired invite with a
 * fresh link. The previous link stops working only once the new email is delivered; a failed
 * or suppressed send keeps the old link valid. Owners and managers only.
 */
export async function POST(request: NextRequest, context: InviteIdRouteParams) {
  return withCsrfProtectedMutation(request, () => postResendInvitation(request, context));
}

async function postResendInvitation(request: NextRequest, context: InviteIdRouteParams) {
  const resolved = await resolveInviteAdminContext(context, ROUTE);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { supabase, user, inviteId, restaurantId } = resolved;

  // Every invite email from one admin shares the creation budget, and each invite has its own.
  // Attempts are charged before sending, including ones the provider then fails: each attempt
  // reaches the email provider, and refunding failures would let a client retry a failing
  // send without bound. A failed send no longer costs the invitee their link (the old token
  // is restored), so a later retry inside the window loses nothing.
  const aggregateRateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'ops.team_invitations.create.aggregate',
    tenantId: restaurantId,
    userId: user.id,
    limit: 20,
    windowMs: WINDOW_MS,
    message: 'Too many invitation attempts',
  });
  if (aggregateRateLimitResponse) {
    return aggregateRateLimitResponse;
  }

  const inviteRateLimitResponse = await requireApiRateLimit({
    request,
    scope: 'ops.team_invitations.resend',
    tenantId: restaurantId,
    userId: user.id,
    parts: [inviteId],
    limit: 3,
    windowMs: WINDOW_MS,
    message: 'This invitation was resent recently',
  });
  if (inviteRateLimitResponse) {
    return inviteRateLimitResponse;
  }

  try {
    const { invite, emailSent } = await resendRestaurantInvite({
      inviteId,
      restaurantId,
      authClient: supabase,
    });

    if (!emailSent) {
      return apiError(
        422,
        'INVITE_EMAIL_SUPPRESSED',
        'This address isn’t accepting email from us, so the invitation couldn’t be delivered.',
      );
    }

    return NextResponse.json({ invite: serializeInvite(invite), emailSent });
  } catch (error) {
    const code = getErrorCode(error);
    if (code === 'INVITE_EXPIRED') {
      return conflict('INVITE_EXPIRED', 'This invitation has expired. Send a new invitation.');
    }
    if (code === 'INVITE_NOT_PENDING') {
      return conflict(
        'INVITE_NOT_PENDING',
        'This invitation was already accepted or revoked, so it can’t be resent.',
      );
    }
    if (code === 'INVITE_CHANGED') {
      return conflict(
        'INVITE_CHANGED',
        'This invitation was just resent or changed. Refresh the list and try again.',
      );
    }
    if (code === 'INVITE_NOT_FOUND') {
      return apiError(404, 'INVITE_NOT_FOUND', 'This invitation no longer exists.');
    }
    if (code === 'INVITE_EMAIL_FAILED') {
      return apiError(
        502,
        'INVITE_EMAIL_FAILED',
        'The invitation email couldn’t be sent. Try again in a moment.',
        { retryable: true },
      );
    }

    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-team-invitation-resend' },
    });
    return internalError(error, { route: ROUTE, restaurantId, inviteId });
  }
}
