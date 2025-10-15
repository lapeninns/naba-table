import type { SupabaseClient } from "@supabase/supabase-js";

import { RESTAURANT_ADMIN_ROLES, RESTAURANT_ROLES, type RestaurantRole } from "@/lib/owner/auth/roles";
import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Tables } from "@/types/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

const MEMBERSHIP_SELECT = "restaurant_id,role,user_id,created_at,restaurants(id,name,slug)";

export type RestaurantMembershipWithDetails = Tables<"restaurant_memberships"> & {
  restaurants?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
};

type RawMembershipRow = Tables<"restaurant_memberships"> & {
  restaurants?: { id: string; name: string | null; slug: string | null } | { id: string; name: string | null; slug: string | null }[] | null;
};

function normalizeMembership(row: RawMembershipRow): RestaurantMembershipWithDetails {
  const restaurantRelation = row.restaurants;
  const normalized =
    Array.isArray(restaurantRelation) && restaurantRelation.length > 0
      ? restaurantRelation[0]
      : !Array.isArray(restaurantRelation)
        ? restaurantRelation
        : null;

  return {
    ...row,
    restaurants: normalized ?? null,
  };
}

export async function fetchUserMemberships(
  userId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantMembershipWithDetails[]> {
  const { data, error } = await client
    .from("restaurant_memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RawMembershipRow[];
  return rows.map(normalizeMembership);
}

export async function requireMembershipForRestaurant(params: {
  userId: string;
  restaurantId: string;
  allowedRoles?: readonly RestaurantRole[];
  client?: DbClient;
}): Promise<RestaurantMembershipWithDetails> {
  const { userId, restaurantId, allowedRoles = RESTAURANT_ROLES, client = getServiceSupabaseClient() } = params;

  const { data, error } = await client
    .from("restaurant_memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    console.warn('[auth:membership] Access denied - membership not found', {
      userId,
      restaurantId,
      requiredRoles: allowedRoles,
      timestamp: new Date().toISOString(),
    });
    throw Object.assign(new Error("Membership not found"), { code: "MEMBERSHIP_NOT_FOUND" as const });
  }

  const casted = normalizeMembership(data as RawMembershipRow);
  if (!allowedRoles.includes(casted.role as RestaurantRole)) {
    console.warn('[auth:role] Insufficient permissions', {
      userId,
      restaurantId,
      requiredRoles: allowedRoles,
      actualRole: casted.role,
      timestamp: new Date().toISOString(),
    });
    throw Object.assign(new Error("Insufficient permissions for restaurant"), {
      code: "MEMBERSHIP_ROLE_DENIED" as const,
      role: casted.role,
    });
  }

  return casted;
}

export async function requireAdminMembership(params: {
  userId: string;
  restaurantId: string;
  client?: DbClient;
}): Promise<RestaurantMembershipWithDetails> {
  return requireMembershipForRestaurant({
    ...params,
    allowedRoles: RESTAURANT_ADMIN_ROLES,
  });
}
