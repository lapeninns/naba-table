import {
  RESTAURANT_ADMIN_ROLES,
  RESTAURANT_ROLES,
  type RestaurantRole,
} from '@/lib/owner/auth/roles';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

// Select only fields we actually use across the ops layout and membership guards.
// Avoid wide row payloads for server-rendered `/app/*` requests.
const MEMBERSHIP_SELECT = 'restaurant_id,role,created_at,restaurants(id,name,slug)';

const USER_MEMBERSHIPS_CACHE_TTL_MS = 30_000;
const USER_MEMBERSHIPS_CACHE_MAX_ENTRIES = 5_000;

type MembershipCacheEntry = {
  expiresAtMs: number;
  memberships: RestaurantMembershipWithDetails[];
};

const userMembershipsCache = new Map<string, MembershipCacheEntry>();

export type RestaurantMembershipWithDetails = Tables<'restaurant_memberships'> & {
  restaurants?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
};

export class MembershipAccessError extends Error {
  readonly status: number;
  readonly code:
    | 'MEMBERSHIP_NOT_FOUND'
    | 'MEMBERSHIP_ROLE_DENIED'
    | 'MEMBERSHIP_VALIDATION_UNAVAILABLE';
  readonly details?: unknown;

  constructor(params: {
    status: number;
    code: 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_ROLE_DENIED' | 'MEMBERSHIP_VALIDATION_UNAVAILABLE';
    message: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = 'MembershipAccessError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

type RawMembershipRow = Tables<'restaurant_memberships'> & {
  restaurants?:
    | { id: string; name: string | null; slug: string | null }
    | { id: string; name: string | null; slug: string | null }[]
    | null;
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

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = Reflect.get(error, 'status');
  return typeof status === 'number' ? status : null;
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const message = Reflect.get(error, 'message');
  return typeof message === 'string' ? message : '';
}

function isMembershipBackendUnavailable(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null && status >= 500) {
    return true;
  }

  const normalizedMessage = getErrorMessage(error).toLowerCase();
  return (
    normalizedMessage.includes('bad gateway') ||
    normalizedMessage.includes('gateway timeout') ||
    normalizedMessage.includes('cloudflare') ||
    normalizedMessage.includes('<!doctype html>') ||
    normalizedMessage.includes('<html') ||
    normalizedMessage.includes('upstream') ||
    normalizedMessage.includes('fetch failed')
  );
}

function mapMembershipQueryError(error: unknown): unknown {
  if (!isMembershipBackendUnavailable(error)) {
    return error;
  }

  return new MembershipAccessError({
    status: 503,
    code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
    message: 'Membership verification is temporarily unavailable',
    details: error,
    cause: error,
  });
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

function setCachedMemberships(
  userId: string,
  memberships: RestaurantMembershipWithDetails[],
): void {
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
    .from('restaurant_memberships')
    .select(MEMBERSHIP_SELECT)
    .eq('user_id', userId);

  if (error) {
    throw mapMembershipQueryError(error);
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
  useCache?: boolean;
}): Promise<RestaurantMembershipWithDetails> {
  const {
    userId,
    restaurantId,
    allowedRoles = RESTAURANT_ROLES,
    client = getServiceSupabaseClient(),
    useCache = false,
  } = params;
  const cachedMemberships = useCache ? getCachedMemberships(userId) : null;
  const cachedMatch =
    cachedMemberships?.find((membership) => membership.restaurant_id === restaurantId) ?? null;

  if (cachedMatch) {
    if (!allowedRoles.includes(cachedMatch.role as RestaurantRole)) {
      throw new MembershipAccessError({
        status: 403,
        code: 'MEMBERSHIP_ROLE_DENIED',
        message: 'Insufficient permissions for restaurant',
        details: { role: cachedMatch.role, restaurantId, userId },
      });
    }

    return cachedMatch;
  }

  const { data, error } = await client
    .from('restaurant_memberships')
    .select(MEMBERSHIP_SELECT)
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) {
    throw mapMembershipQueryError(error);
  }

  if (!data) {
    console.warn('[auth:membership] Access denied - membership not found', {
      userId,
      restaurantId,
      requiredRoles: allowedRoles,
      timestamp: new Date().toISOString(),
    });
    throw new MembershipAccessError({
      status: 403,
      code: 'MEMBERSHIP_NOT_FOUND',
      message: 'Membership not found',
      details: { restaurantId, userId },
    });
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
    throw new MembershipAccessError({
      status: 403,
      code: 'MEMBERSHIP_ROLE_DENIED',
      message: 'Insufficient permissions for restaurant',
      details: { role: casted.role, restaurantId, userId },
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
