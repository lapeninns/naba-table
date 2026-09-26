import { apiError, type ApiErrorBody } from '@/lib/api/errors';

import type { InviteAvailability } from '@/server/team/invitations';
import type { RestaurantInvite } from '@/server/team/invite-types';
import type { NextResponse } from 'next/server';

/** C1 codes and safe copy for an invite link that can no longer be used. */
export const INVITE_UNAVAILABLE_RESPONSES = {
  notFound: {
    status: 404,
    code: 'INVITE_NOT_FOUND',
    message: 'This invitation link isn’t valid. Check the link or ask for a new invitation.',
  },
  revoked: {
    status: 410,
    code: 'INVITE_REVOKED',
    message: 'This invitation was revoked. Ask the restaurant for a new one.',
  },
  accepted: {
    status: 409,
    code: 'INVITE_ALREADY_ACCEPTED',
    message: 'This invitation has already been accepted.',
  },
  expired: {
    status: 410,
    code: 'INVITE_EXPIRED',
    message: 'This invitation has expired. Ask the restaurant to send a new one.',
  },
} as const;

export function inviteUnavailableResponse(
  reason: Exclude<InviteAvailability, 'pending'> | 'notFound',
): NextResponse<ApiErrorBody> {
  const { status, code, message } = INVITE_UNAVAILABLE_RESPONSES[reason];
  return apiError(status, code, message);
}

/** Reads a string `code` from a thrown domain error. */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** The ops API shape of an invite. Never includes the token hash. */
export function serializeInvite(invite: RestaurantInvite) {
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
