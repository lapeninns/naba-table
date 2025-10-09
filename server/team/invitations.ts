import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isRestaurantRole, type RestaurantRole } from "@/lib/owner/auth/roles";
import { buildInviteUrl } from "@/lib/owner/team/invite-links";
import { sendTeamInviteEmail } from "@/server/emails/invitations";
import { normalizeEmail } from "@/server/customers";
import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Tables } from "@/types/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

export type RestaurantInvite = Tables<"restaurant_invites">;

const INVITE_SELECT =
  "id,restaurant_id,email,email_normalized,role,token_hash,status,expires_at,invited_by,accepted_at,revoked_at,created_at,updated_at";

export type InviteStatus = RestaurantInvite["status"];

export const INVITE_STATUS_PENDING: InviteStatus = "pending";
export const INVITE_STATUS_ACCEPTED: InviteStatus = "accepted";
export const INVITE_STATUS_REVOKED: InviteStatus = "revoked";
export const INVITE_STATUS_EXPIRED: InviteStatus = "expired";

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
  token: string;
  inviteUrl: string;
};

export type ListInvitesParams = {
  restaurantId: string;
  authClient: DbClient;
  status?: InviteStatus | "all";
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
  const raw = randomBytes(bytes).toString("base64url");
  return {
    token: raw,
    hash: hashInviteToken(raw),
  };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRestaurantInvite(params: CreateInviteParams): Promise<CreateInviteResult> {
  const { restaurantId, email, role, invitedBy, expiresAt, authClient } = params;

  if (!isRestaurantRole(role)) {
    throw Object.assign(new Error("Unsupported role for invitation"), {
      code: "INVALID_INVITE_ROLE" as const,
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const { token, hash } = generateInviteToken();

  const { data, error } = await authClient
    .from("restaurant_invites")
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
    if (error.code === "23505") {
      throw Object.assign(new Error("An invitation for this email already exists"), {
        code: "INVITE_ALREADY_EXISTS" as const,
      });
    }

    throw error;
  }

  const invite = data as RestaurantInvite;

  await sendTeamInviteEmail({
    invite,
    token,
  });

  return { invite, token, inviteUrl: buildInviteUrl(token) };
}

export async function resolveInviteContext(invite: RestaurantInvite): Promise<{
  restaurantName: string;
  inviterName: string | null;
}> {
  const service = getServiceSupabaseClient();
  const [{ data: restaurant }, { data: inviter }] = await Promise.all([
    service.from("restaurants").select("name").eq("id", invite.restaurant_id).maybeSingle(),
    invite.invited_by
      ? service.from("profiles").select("name").eq("id", invite.invited_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    restaurantName: restaurant?.name ?? "Restaurant",
    inviterName: inviter?.name ?? null,
  };
}

export async function expireRestaurantInvites(
  restaurantId: string,
  authClient: DbClient,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await authClient
    .from("restaurant_invites")
    .update({ status: INVITE_STATUS_EXPIRED })
    .eq("restaurant_id", restaurantId)
    .eq("status", INVITE_STATUS_PENDING)
    .lt("expires_at", nowIso);

  if (error && error.code !== "42501") {
    throw error;
  }
}

export async function listRestaurantInvites(params: ListInvitesParams): Promise<RestaurantInvite[]> {
  const { restaurantId, authClient, status = INVITE_STATUS_PENDING } = params;

  await expireRestaurantInvites(restaurantId, authClient);

  let query = authClient
    .from("restaurant_invites")
    .select(INVITE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as RestaurantInvite[];
}

export function inviteHasExpired(invite: RestaurantInvite): boolean {
  return new Date(invite.expires_at).getTime() < Date.now();
}

export async function markInviteExpired(inviteId: string, client: DbClient = getServiceSupabaseClient()) {
  const { data, error } = await client
    .from("restaurant_invites")
    .update({ status: INVITE_STATUS_EXPIRED })
    .eq("id", inviteId)
    .eq("status", INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return data as RestaurantInvite;
}

export async function revokeRestaurantInvite(params: RevokeInviteParams): Promise<RestaurantInvite> {
  const { inviteId, restaurantId, authClient } = params;

  const { data, error } = await authClient
    .from("restaurant_invites")
    .update({
      status: INVITE_STATUS_REVOKED,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("restaurant_id", restaurantId)
    .eq("status", INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw Object.assign(new Error("Invite not found"), { code: "INVITE_NOT_FOUND" as const });
  }

  return data as RestaurantInvite;
}

export async function findInviteByToken(token: string, client: DbClient = getServiceSupabaseClient()) {
  const hash = hashInviteToken(token);
  const { data, error } = await client
    .from("restaurant_invites")
    .select(INVITE_SELECT)
    .eq("token_hash", hash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as RestaurantInvite | null;
}

export async function markInviteAccepted(inviteId: string, client: DbClient = getServiceSupabaseClient()) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("restaurant_invites")
    .update({ status: INVITE_STATUS_ACCEPTED, accepted_at: now })
    .eq("id", inviteId)
    .eq("status", INVITE_STATUS_PENDING)
    .select(INVITE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw Object.assign(new Error("Invite not found or already processed"), {
      code: "INVITE_NOT_FOUND" as const,
    });
  }

  return data as RestaurantInvite;
}
