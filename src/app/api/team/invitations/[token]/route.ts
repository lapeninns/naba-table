import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  findInviteByToken,
  getInviteAvailability,
  markInviteExpired,
} from '@/server/team/invitations';
import { resolveInviteContext } from '@/server/team/invite-context';
import { inviteUnavailableResponse } from '@/server/team/invite-response';

import type { NextRequest } from 'next/server';

const paramsSchema = z.object({
  token: z.string().min(10),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return apiError(400, 'INVALID_INVITE_TOKEN', 'This invitation link isn’t valid.');
  }

  try {
    const invite = await findInviteByToken(parsed.data.token);

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

    const { restaurantName, inviterName } = await resolveInviteContext(invite);

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expires_at,
        restaurant: {
          id: invite.restaurant_id,
          name: restaurantName,
        },
        inviter: inviterName,
      },
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'team-invitation' },
    });
    return internalError(
      error,
      { route: 'team.invitations.token.get' },
      'The invitation couldn’t be loaded. Try again.',
    );
  }
}
