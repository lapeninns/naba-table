import { NextResponse } from 'next/server';

import { RESTAURANT_ROLES, type RestaurantRole } from '@/lib/owner/auth/roles';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  createSessionExpiredResponse,
  isUnsafeMutationMethod,
  validateCsrfProtectedMutation,
} from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import {
  MembershipAccessError,
  fetchUserMemberships,
  requireMembershipForRestaurant,
  type RestaurantMembershipWithDetails,
} from '@/server/team/access';

import type { Database } from '@/types/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

type TenantClient = SupabaseClient<Database>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRUSTED_OPS_USER_HEADER = 'x-ops-user-id';

export function getOpsUserIdFromHeader(req: NextRequest): string | null {
  const value = req.headers.get(TRUSTED_OPS_USER_HEADER);
  if (!value || !UUID_PATTERN.test(value)) return null;
  return value;
}

export class GuardError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = 'GuardError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

export async function requireSession(
  existingClient?: TenantClient,
): Promise<{ supabase: TenantClient; user: User }> {
  const supabase = existingClient ?? (await getRouteHandlerSupabaseClient());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    throw new GuardError({
      status: mapped.status,
      code: mapped.code,
      message: mapped.message,
      details: error.message ?? error,
      cause: error,
    });
  }

  if (!user) {
    throw new GuardError({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  }

  return { supabase, user };
}

export async function requireRestaurantMember(params: {
  supabase: TenantClient;
  userId: string;
  restaurantId: string | null | undefined;
  allowedRoles?: readonly RestaurantRole[];
}): Promise<RestaurantMembershipWithDetails> {
  const { supabase, userId, restaurantId, allowedRoles = RESTAURANT_ROLES } = params;

  if (!restaurantId) {
    throw new GuardError({
      status: 404,
      code: 'BOOKING_NOT_FOUND',
      message: 'Booking is missing a restaurant association',
    });
  }

  try {
    return await requireMembershipForRestaurant({
      userId,
      restaurantId,
      allowedRoles,
      client: supabase,
    });
  } catch (error) {
    if (error instanceof MembershipAccessError) {
      if (error.code === 'MEMBERSHIP_NOT_FOUND') {
        throw new GuardError({
          status: 403,
          code: 'FORBIDDEN',
          message: 'You are not a member of this restaurant',
          details: error.details,
          cause: error,
        });
      }
      if (error.code === 'MEMBERSHIP_ROLE_DENIED') {
        throw new GuardError({
          status: 403,
          code: 'FORBIDDEN',
          message: 'You do not have sufficient permissions for this restaurant',
          details: error.details,
          cause: error,
        });
      }
      if (error.code === 'MEMBERSHIP_VALIDATION_UNAVAILABLE') {
        throw new GuardError({
          status: 503,
          code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
          message: 'Membership verification is temporarily unavailable',
          details: error.details,
          cause: error,
        });
      }
    }

    throw new GuardError({
      status: 500,
      code: 'MEMBERSHIP_VALIDATION_FAILED',
      message: 'Failed to validate restaurant membership',
      details: error,
      cause: error instanceof Error ? error : undefined,
    });
  }
}

export async function listUserRestaurantMemberships(
  supabase: TenantClient,
  userId: string,
): Promise<RestaurantMembershipWithDetails[]> {
  try {
    return await fetchUserMemberships(userId, supabase);
  } catch (error) {
    if (
      error instanceof MembershipAccessError &&
      error.code === 'MEMBERSHIP_VALIDATION_UNAVAILABLE'
    ) {
      throw new GuardError({
        status: 503,
        code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
        message: 'Membership verification is temporarily unavailable',
        details: error.details,
        cause: error,
      });
    }

    throw new GuardError({
      status: 500,
      code: 'MEMBERSHIP_QUERY_FAILED',
      message: 'Unable to load restaurant memberships',
      details: error,
      cause: error,
    });
  }
}

type RouteGuardSuccess = {
  ok: true;
  supabase: TenantClient;
  user: User;
};

type RouteGuardFailure = {
  ok: false;
  response: NextResponse;
};

type RouteGuardResult = RouteGuardSuccess | RouteGuardFailure;

type RestaurantAuthorizationSuccess = RouteGuardSuccess & {
  restaurantId: string;
  membership: RestaurantMembershipWithDetails;
};

type RestaurantAuthorizationResult = RestaurantAuthorizationSuccess | RouteGuardFailure;

type BookingAuthorizationSuccess = RestaurantAuthorizationSuccess & {
  bookingId: string;
};

type BookingAuthorizationResult = BookingAuthorizationSuccess | RouteGuardFailure;

type PlatformAdminAuthorizationSuccess = RouteGuardSuccess & {
  platformAdmin: true;
};

type PlatformAdminAuthorizationResult = PlatformAdminAuthorizationSuccess | RouteGuardFailure;

function errorResponse(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export async function withOpsMutation(
  req: NextRequest,
  options: { csrf?: boolean } = {},
): Promise<RouteGuardResult> {
  if (options.csrf || isUnsafeMutationMethod(req.method)) {
    const csrfFailure = validateCsrfProtectedMutation(req);
    if (csrfFailure) {
      return {
        ok: false,
        response: csrfFailure,
      };
    }
  }

  try {
    const { supabase, user } = await requireSession();
    return { ok: true, supabase, user };
  } catch (error) {
    if (error instanceof GuardError) {
      const response =
        error.status === 401 || error.code === 'SESSION_RESOLUTION_FAILED'
          ? createSessionExpiredResponse()
          : errorResponse(error.message, error.status, error.code);
      return { ok: false, response };
    }

    console.error('[auth:route] session guard failed', error);
    return {
      ok: false,
      response: errorResponse('Unable to verify session', 500, 'SESSION_VERIFY_FAILED'),
    };
  }
}

export async function withRestaurantAuthorization(
  req: NextRequest,
  restaurantId: string | null | undefined,
  options: { roles?: readonly RestaurantRole[]; csrf?: boolean } = {},
): Promise<RestaurantAuthorizationResult> {
  if (!isUuid(restaurantId)) {
    return {
      ok: false,
      response: errorResponse('Invalid restaurant id', 400, 'INVALID_RESTAURANT_ID'),
    };
  }

  const guarded = await withOpsMutation(req, { csrf: options.csrf });
  if (!guarded.ok) {
    return guarded;
  }

  try {
    const membership = await requireRestaurantMember({
      supabase: guarded.supabase,
      userId: guarded.user.id,
      restaurantId,
      allowedRoles: options.roles,
    });
    return { ...guarded, restaurantId, membership };
  } catch (error) {
    if (error instanceof GuardError) {
      return { ok: false, response: errorResponse(error.message, error.status, error.code) };
    }

    console.error('[auth:route] restaurant authorization failed', { restaurantId, error });
    return {
      ok: false,
      response: errorResponse('Failed to validate restaurant authorization', 500),
    };
  }
}

export async function withBookingAuthorization(
  req: NextRequest,
  bookingId: string | null | undefined,
  options: { action?: string; roles?: readonly RestaurantRole[] } = {},
): Promise<BookingAuthorizationResult> {
  if (!isUuid(bookingId)) {
    return { ok: false, response: errorResponse('Booking not found', 404, 'BOOKING_NOT_FOUND') };
  }

  const guarded = await withOpsMutation(req);
  if (!guarded.ok) {
    return guarded;
  }

  const bookingQuery = await guarded.supabase
    .from('bookings')
    .select('id, restaurant_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingQuery.error) {
    console.error('[auth:route] booking lookup failed', {
      bookingId,
      action: options.action ?? null,
      error: bookingQuery.error,
    });
    return {
      ok: false,
      response: errorResponse('Failed to load booking', 500, 'BOOKING_LOOKUP_FAILED'),
    };
  }

  const restaurantId = bookingQuery.data?.restaurant_id ?? null;
  if (!restaurantId) {
    return { ok: false, response: errorResponse('Booking not found', 404, 'BOOKING_NOT_FOUND') };
  }

  try {
    const membership = await requireRestaurantMember({
      supabase: guarded.supabase,
      userId: guarded.user.id,
      restaurantId,
      allowedRoles: options.roles,
    });
    return { ...guarded, bookingId, restaurantId, membership };
  } catch (error) {
    if (error instanceof GuardError) {
      return { ok: false, response: errorResponse(error.message, error.status, error.code) };
    }

    console.error('[auth:route] booking authorization failed', {
      bookingId,
      restaurantId,
      action: options.action ?? null,
      error,
    });
    return { ok: false, response: errorResponse('Failed to validate booking authorization', 500) };
  }
}

function readCsvEnv(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function withPlatformAdminAuthorization(
  req: NextRequest,
  options: { csrf?: boolean } = {},
): Promise<PlatformAdminAuthorizationResult> {
  const guarded = await withOpsMutation(req, { csrf: options.csrf });
  if (!guarded.ok) {
    return guarded;
  }

  const adminUserIds = readCsvEnv('PLATFORM_ADMIN_USER_IDS');
  const adminEmails = readCsvEnv('PLATFORM_ADMIN_EMAILS');
  const userEmail = guarded.user.email?.toLowerCase() ?? '';
  const isPlatformAdmin =
    adminUserIds.has(guarded.user.id.toLowerCase()) ||
    (userEmail.length > 0 && adminEmails.has(userEmail));

  if (!isPlatformAdmin) {
    return {
      ok: false,
      response: errorResponse(
        'Platform administrator access required',
        403,
        'PLATFORM_ADMIN_REQUIRED',
      ),
    };
  }

  return { ...guarded, platformAdmin: true };
}
