import { canInviteRestaurantRole, isRestaurantRole } from '@/lib/owner/auth/roles';
import { normalizeEmail } from '@/server/customers';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  invalidateUserMembershipsCache,
  requireMembershipForRestaurant,
} from '@/server/team/access';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { RestaurantInvite } from '@/server/team/invite-types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type AcceptInviteForUserParams = {
  invite: RestaurantInvite;
  userId: string;
  userEmail: string;
  client?: DbClient;
};

export async function assertInvitableRole(params: {
  actorUserId: string;
  restaurantId: string;
  invitedRole: RestaurantRole;
  client?: DbClient;
}): Promise<void> {
  const { actorUserId, restaurantId, invitedRole, client = getServiceSupabaseClient() } = params;
  const actorMembership = await requireMembershipForRestaurant({
    userId: actorUserId,
    restaurantId,
    client,
  });
  const actorRole = actorMembership.role as RestaurantRole;

  if (!isRestaurantRole(actorRole) || !canInviteRestaurantRole(actorRole, invitedRole)) {
    throw Object.assign(new Error('Actor cannot invite this role'), {
      code: 'INVITE_ROLE_FORBIDDEN' as const,
      actorRole,
      invitedRole,
    });
  }
}

export async function assertInviteRoleStillAllowed(
  invite: RestaurantInvite,
  client: DbClient = getServiceSupabaseClient(),
): Promise<void> {
  if (!isRestaurantRole(invite.role)) {
    throw Object.assign(new Error('Unsupported role for invitation'), {
      code: 'INVALID_INVITE_ROLE' as const,
    });
  }

  if (!invite.invited_by) {
    throw Object.assign(new Error('Invite has no inviter to validate'), {
      code: 'INVITE_ROLE_FORBIDDEN' as const,
    });
  }

  await assertInvitableRole({
    actorUserId: invite.invited_by,
    restaurantId: invite.restaurant_id,
    invitedRole: invite.role,
    client,
  });
}

export async function acceptInviteForAuthenticatedUser(
  params: AcceptInviteForUserParams,
): Promise<RestaurantInvite> {
  const { invite, userId, userEmail, client = getServiceSupabaseClient() } = params;
  const normalizedSessionEmail = normalizeEmail(userEmail);
  const normalizedInviteEmail = normalizeEmail(invite.email);

  if (normalizedSessionEmail !== normalizedInviteEmail) {
    throw Object.assign(new Error('Authenticated email does not match invitation'), {
      code: 'INVITE_EMAIL_MISMATCH' as const,
    });
  }

  await assertInviteRoleStillAllowed(invite, client);

  const rpcClient = client as SupabaseClient<Database> & {
    rpc: (
      fn: 'accept_restaurant_invite',
      args: {
        p_invite_id: string;
        p_user_id: string;
        p_restaurant_id: string;
        p_role: string;
      },
    ) => Promise<{
      data: RestaurantInvite | null;
      error: { code?: string; message?: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc('accept_restaurant_invite', {
    p_invite_id: invite.id,
    p_user_id: userId,
    p_restaurant_id: invite.restaurant_id,
    p_role: invite.role,
  });

  if (error) {
    if (error.code === 'P0001') {
      throw Object.assign(new Error('Invite not found or already processed'), {
        code: 'INVITE_NOT_FOUND' as const,
      });
    }
    throw error;
  }

  if (!data) {
    throw Object.assign(new Error('Invite not found or already processed'), {
      code: 'INVITE_NOT_FOUND' as const,
    });
  }

  invalidateUserMembershipsCache(userId);
  return data;
}
