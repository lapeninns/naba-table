
import { RESTAURANT_ROLES, type RestaurantRole } from "@/lib/owner/auth/roles";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships, requireMembershipForRestaurant, type RestaurantMembershipWithDetails } from "@/server/team/access";

import type { Database } from "@/types/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type TenantClient = SupabaseClient<Database, "public", any>;

export class GuardError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(params: { status: number; code: string; message: string; details?: unknown; cause?: unknown }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = "GuardError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

export async function requireSession(existingClient?: TenantClient): Promise<{ supabase: TenantClient; user: User }> {
  const supabase = existingClient ?? (await getRouteHandlerSupabaseClient());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new GuardError({
      status: 500,
      code: "SESSION_RESOLUTION_FAILED",
      message: "Unable to verify session",
      details: error.message ?? error,
      cause: error,
    });
  }

  if (!user) {
    throw new GuardError({
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
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
      code: "BOOKING_NOT_FOUND",
      message: "Booking is missing a restaurant association",
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
    if (typeof error === "object" && error !== null) {
      const details = error as { code?: unknown; message?: unknown };
      if (details.code === "MEMBERSHIP_NOT_FOUND") {
        throw new GuardError({
          status: 403,
          code: "FORBIDDEN",
          message: "You are not a member of this restaurant",
          details: details.message,
          cause: error,
        });
      }
      if (details.code === "MEMBERSHIP_ROLE_DENIED") {
        throw new GuardError({
          status: 403,
          code: "FORBIDDEN",
          message: "You do not have sufficient permissions for this restaurant",
          details: details.message,
          cause: error,
        });
      }
    }

    throw new GuardError({
      status: 500,
      code: "MEMBERSHIP_VALIDATION_FAILED",
      message: "Failed to validate restaurant membership",
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
    throw new GuardError({
      status: 500,
      code: "MEMBERSHIP_QUERY_FAILED",
      message: "Unable to load restaurant memberships",
      details: error,
      cause: error,
    });
  }
}
