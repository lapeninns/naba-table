import { createHash, randomBytes } from 'node:crypto';

import { logger } from '@/lib/logger';
import { isRestaurantRole, type RestaurantRole } from '@/lib/owner/auth/roles';
import { normalizeEmail } from '@/server/customers';
import { sendTeamInviteEmail } from '@/server/emails/invitations';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantInvite } from '@/server/team/invite-types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type { RestaurantInvite } from '@/server/team/invite-types';
export {
  acceptInviteForAuthenticatedUser,
  assertInvitableRole,
  assertInviteRoleStillAllowed,
} from '@/server/team/invite-acceptance';
export type { AcceptInviteForUserParams } from '@/server/team/invite-acceptance';

const INVITE_SELECT =
  'id,restaurant_id,email,email_normalized,role,token_hash,status,expires_at,invited_by,accepted_at,revoked_at,created_at,updated_at';

export type InviteStatus = RestaurantInvite['status'];

export const INVITE_STATUS_PENDING: InviteStatus = 'pending';
export const INVITE_STATUS_ACCEPTED: InviteStatus = 'accepted';
export const INVITE_STATUS_REVOKED: InviteStatus = 'revoked';
export const INVITE_STATUS_EXPIRED: InviteStatus = 'expired';

export type CreateInviteParams = {
  restaurantId: string;
  email: string;
  role: RestaurantRole;
  invitedBy: string | null;
  expiresAt: string;
  authClient: DbClient;
};

export type CreateInviteResult = {
  invite: RestaurantInvite;
  /**
   * False when the invite row exists but the email did not go out (provider failure or a
   * suppressed recipient). The invite stays pending, so an admin can resend it.
   */
  emailSent: boolean;
};

export type ResendInviteParams = {
  inviteId: string;
  restaurantId: string;
  authClient: DbClient;
};

export type ResendInviteResult = {
  invite: RestaurantInvite;
  /** False when the recipient is suppressed at the provider, so nothing was delivered. */
  emailSent: boolean;
};

/** Default and allowed window for a new invitation, in days from now. */
export const INVITE_EXPIRY_DEFAULT_DAYS = 7;
export const INVITE_EXPIRY_MIN_DAYS = 1;
export const INVITE_EXPIRY_MAX_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The expiry stored for a new invite. A requested value is clamped to 1 to 30 days from now,
 * so a client can't create an invite that never expires or one that is already expired.
 */
export function resolveInviteExpiry(requested?: string | null, now: Date = new Date()): string {
  const nowMs = now.getTime();
  const min = nowMs + INVITE_EXPIRY_MIN_DAYS * DAY_MS;
  const max = nowMs + INVITE_EXPIRY_MAX_DAYS * DAY_MS;
  const requestedMs = requested ? new Date(requested).getTime() : Number.NaN;
  if (Number.isNaN(requestedMs)) {
    return new Date(nowMs + INVITE_EXPIRY_DEFAULT_DAYS * DAY_MS).toISOString();
  }
  return new Date(Math.min(max, Math.max(min, requestedMs))).toISOString();
}

/** What a stored invite means for the person holding its link right now. */
export type InviteAvailability = 'pending' | 'accepted' | 'revoked' | 'expired';

export function getInviteAvailability(
  invite: Pick<RestaurantInvite, 'status' | 'expires_at'>,
  now: number = Date.now(),
): InviteAvailability {
  if (invite.status === INVITE_STATUS_ACCEPTED) return 'accepted';
  if (invite.status === INVITE_STATUS_REVOKED) return 'revoked';
  if (invite.status === INVITE_STATUS_EXPIRED) return 'expired';
  return new Date(invite.expires_at).getTime() <= now ? 'expired' : 'pending';
}

function inviteError<C extends string>(code: C, message: string, cause?: unknown) {
  return Object.assign(new Error(message, cause === undefined ? undefined : { cause }), { code });
}

function describeFailure(error: unknown): { errorName: string; errorKind?: string } {
  if (error instanceof Error) {
    const kind = (error as { code?: unknown }).code;
    return {
      errorName: error.name,
      ...(typeof kind === 'string' || typeof kind === 'number' ? { errorKind: String(kind) } : {}),
    };
  }
  return { errorName: typeof error };
}

/**
 * Sends the invite email. Never throws for a provider failure: the result says whether the
 * email went out, and the failure is logged without the recipient or provider text.
 */
async function deliverInviteEmail(invite: RestaurantInvite, token: string): Promise<boolean> {
  try {
    const { delivered } = await sendTeamInviteEmail({ invite, token });
    return delivered;
  } catch (error) {
    logger.warn('team_invite.email_failed', {
      restaurantId: invite.restaurant_id,
      inviteId: invite.id,
      ...describeFailure(error),
    });
    return false;
  }
}

export type ListInvitesParams = {
  restaurantId: string;
  authClient: DbClient;
  status?: InviteStatus | 'all';
};

export type RevokeInviteParams = {
  inviteId: string;
  restaurantId: string;
  authClient: DbClient;
};

export type AcceptInviteParams = {
  token: string;
  authClient: DbClient;
};

export function generateInviteToken(bytes = 24): { token: string; hash: string } {
  const raw = randomBytes(bytes).toString('base64url');
  return {
    token: raw,
    hash: hashInviteToken(raw),
  };
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRestaurantInvite(
  params: CreateInviteParams,
): Promise<CreateInviteResult> {
  const { restaurantId, email, role, invitedBy, expiresAt, authClient } = params;

  if (!isRestaurantRole(role)) {
    throw Object.assign(new Error('Unsupported role for invitation'), {
      code: 'INVALID_INVITE_ROLE' as const,
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const { token, hash } = generateInviteToken();

  // A pending row past its expiry still holds the one-pending-invite-per-email slot. Expire
  // stale rows first (one atomic UPDATE), so re-inviting after expiry doesn't 409.
  await expireRestaurantInvites(restaurantId, authClient);

  const { data, error } = await authClient
    .from('restaurant_invites')
    .insert({
      restaurant_id: restaurantId,
      email: normalizedEmail,
      role,
      token_hash: hash,
      status: INVITE_STATUS_PENDING,
      expires_at: expiresAt,
      invited_by: invitedBy,
    })
    .select(INVITE_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw Object.assign(new Error('An invitation for this email already exists'), {
        code: 'INVITE_ALREADY_EXISTS' as const,
      });
    }

    throw error;
  }

  const invite = data as RestaurantInvite;
  const emailSent = await deliverInviteEmail(invite, token);

  return { invite, emailSent };
}

/**
 * Re-sends a pending invite. The raw token is never stored, so a resend rotates it: one
 * atomic UPDATE, guarded on pending and unexpired, swaps the token hash, and the previous
 * link stops working. When no row matches, the invite is re-read only to report why.
 */
export async function resendRestaurantInvite(
  params: ResendInviteParams,
): Promise<ResendInviteResult> {
  const { inviteId, restaurantId, authClient } = params;
  const { token, hash } = generateInviteToken();
  const nowIso = new Date().toISOString();

  const { data, error } = await authClient
    .from('restaurant_invites')
    .update({ token_hash: hash })
    .eq('id', inviteId)
    .eq('restaurant_id', restaurantId)
    .eq('status', INVITE_STATUS_PENDING)
    .gt('expires_at', nowIso)
    .select(INVITE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const { data: current, error: readError } = await authClient
      .from('restaurant_invites')
      .select(INVITE_SELECT)
      .eq('id', inviteId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (readError) {
      throw readError;
    }
    if (!current) {
      throw inviteError('INVITE_NOT_FOUND', 'Invite not found');
    }
    const availability = getInviteAvailability(current as RestaurantInvite);
    if (availability === 'expired') {
      throw inviteError('INVITE_EXPIRED', 'Invite has expired');
    }
    throw inviteError('INVITE_NOT_PENDING', 'Invite is no longer pending');
  }

  const invite = data as RestaurantInvite;
  try {
    const { delivered } = await sendTeamInviteEmail({ invite, token });
    return { invite, emailSent: delivered };
  } catch (sendError) {
    logger.warn('team_invite.resend_email_failed', {
      restaurantId: invite.restaurant_id,
      inviteId: invite.id,
      ...describeFailure(sendError),
    });
    throw inviteError('INVITE_EMAIL_FAILED', 'Invite email could not be sent', sendError);
  }
}

export async function expireRestaurantInvites(
  restaurantId: string,
  authClient: DbClient,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await authClient
    .from('restaurant_invites')
    .update({ status: INVITE_STATUS_EXPIRED })
    .eq('restaurant_id', restaurantId)
    .eq('status', INVITE_STATUS_PENDING)
    .lt('expires_at', nowIso);

  if (error && error.code !== '42501') {
    throw error;
  }
}

export async function listRestaurantInvites(
  params: ListInvitesParams,
): Promise<RestaurantInvite[]> {
  const { restaurantId, authClient, status = INVITE_STATUS_PENDING } = params;

  await expireRestaurantInvites(restaurantId, authClient);

  let query = authClient
    .from('restaurant_invites')
    .select(INVITE_SELECT)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as RestaurantInvite[];
}

export function inviteHasExpired(invite: RestaurantInvite): boolean {
  return new Date(invite.expires_at).getTime() <= Date.now();
}

export async function markInviteExpired(
  inviteId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantInvite | null> {
  // maybeSingle: a concurrent accept, revoke or expiry leaves nothing to update, which is fine.
  const { data, error } = await client
    .from('restaurant_invites')
    .update({ status: INVITE_STATUS_EXPIRED })
    .eq('id', inviteId)
    .eq('status', INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as RestaurantInvite | null;
}

export async function revokeRestaurantInvite(
  params: RevokeInviteParams,
): Promise<RestaurantInvite> {
  const { inviteId, restaurantId, authClient } = params;

  const { data, error } = await authClient
    .from('restaurant_invites')
    .update({
      status: INVITE_STATUS_REVOKED,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', inviteId)
    .eq('restaurant_id', restaurantId)
    .eq('status', INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw Object.assign(new Error('Invite not found or already processed'), {
      code: 'INVITE_NOT_FOUND' as const,
    });
  }

  return data as RestaurantInvite;
}

export async function findInviteByToken(
  token: string,
  client: DbClient = getServiceSupabaseClient(),
) {
  const hash = hashInviteToken(token);
  const { data, error } = await client
    .from('restaurant_invites')
    .select(INVITE_SELECT)
    .eq('token_hash', hash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as RestaurantInvite | null;
}

export async function markInviteAccepted(
  inviteId: string,
  client: DbClient = getServiceSupabaseClient(),
) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('restaurant_invites')
    .update({ status: INVITE_STATUS_ACCEPTED, accepted_at: now })
    .eq('id', inviteId)
    .eq('status', INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw Object.assign(new Error('Invite not found or already processed'), {
      code: 'INVITE_NOT_FOUND' as const,
    });
  }

  return data as RestaurantInvite;
}
