import { NextResponse } from 'next/server';

import { conflict, internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { revokeRestaurantInvite } from '@/server/team/invitations';
import {
  resolveInviteAdminContext,
  type InviteIdRouteParams,
} from '@/server/team/invite-admin-route';
import { getErrorCode, serializeInvite } from '@/server/team/invite-response';

import type { NextRequest } from 'next/server';

const ROUTE = 'ops.team.invitations.revoke';

export async function DELETE(request: NextRequest, context: InviteIdRouteParams) {
  return withCsrfProtectedMutation(request, () => deleteTeamInvitation(context));
}

async function deleteTeamInvitation(context: InviteIdRouteParams) {
  const resolved = await resolveInviteAdminContext(context, ROUTE);
  if (resolved instanceof NextResponse) {
    return resolved;
  }
  const { supabase, user, inviteId, restaurantId } = resolved;

  try {
    const revokedInvite = await revokeRestaurantInvite({
      inviteId,
      restaurantId,
      authClient: supabase,
    });

    return NextResponse.json({ invite: serializeInvite(revokedInvite) });
  } catch (error) {
    if (getErrorCode(error) === 'INVITE_NOT_FOUND') {
      return conflict(
        'INVITE_NOT_PENDING',
        'This invitation was already accepted, revoked or expired.',
      );
    }

    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-team-invitation' },
    });
    return internalError(error, { route: ROUTE, restaurantId, inviteId });
  }
}
