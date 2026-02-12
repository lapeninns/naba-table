
import { RESTAURANT_ADMIN_ROLES, RESTAURANT_ROLES, type RestaurantRole } from "@/lib/owner/auth/roles";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

// Select only fields we actually use across the ops layout and membership guards.
// Avoid wide row payloads for server-rendered `/app/*` requests.
const MEMBERSHIP_SELECT = "restaurant_id,role,created_at,restaurants(id,name,slug)";

const USER_MEMBERSHIPS_CACHE_TTL_MS = 30_000;
const USER_MEMBERSHIPS_CACHE_MAX_ENTRIES = 5_000;

type MembershipCacheEntry = {
  expiresAtMs: number;
  memberships: RestaurantMembershipWithDetails[];
};

const userMembershipsCache = new Map<string, MembershipCacheEntry>();

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

function getCachedMemberships(userId: string): RestaurantMembershipWithDetails[] | null {
  const entry = userMembershipsCache.get(userId);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAtMs) {
    userMembershipsCache.delete(userId);
    return null;
  }

  // Return a shallow copy so callers can't mutate the cached array.
  return entry.memberships.slice();
}

function setCachedMemberships(userId: string, memberships: RestaurantMembershipWithDetails[]): void {
  // Keep the cache bounded to avoid long-lived growth across many users.
  if (userMembershipsCache.size >= USER_MEMBERSHIPS_CACHE_MAX_ENTRIES) {
    const firstKey = userMembershipsCache.keys().next().value as string | undefined;
    if (firstKey) userMembershipsCache.delete(firstKey);
  }

  userMembershipsCache.set(userId, {
    expiresAtMs: Date.now() + USER_MEMBERSHIPS_CACHE_TTL_MS,
    memberships,
  });
}

export function invalidateUserMembershipsCache(userId: string): void {
  userMembershipsCache.delete(userId);
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

/**
 * Cached membership lookup for server-rendered ops pages.
 * Intended for `/app/*` layouts to reduce repeated remote membership fetches on hard reloads.
 */
export async function fetchUserMembershipsCached(
  userId: string,
): Promise<RestaurantMembershipWithDetails[]> {
  const cached = getCachedMemberships(userId);
  if (cached) return cached;

  const memberships = await fetchUserMemberships(userId);
  setCachedMemberships(userId, memberships);
  return memberships.slice();
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
