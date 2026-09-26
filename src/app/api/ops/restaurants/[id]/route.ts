import { NextResponse } from 'next/server';

import {
  apiError,
  forbidden,
  internalError,
  notFound,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { RESTAURANT_ROLE_OWNER } from '@/lib/owner/auth/roles';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { deleteRestaurant, updateRestaurant } from '@/server/restaurants';
import { getRestaurantBusinessDescription } from '@/server/restaurants/details';
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { isRestaurantUpdateError } from '@/server/restaurants/update-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import {
  invalidateUserMembershipsCache,
  requireAdminMembership,
  requireMembershipForRestaurant,
} from '@/server/team/access';

import {
  updateRestaurantSchema,
  type RestaurantResponse,
  type DeleteRestaurantResponse,
  type RestaurantDTO,
} from '../schema';

import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MembershipGuardErrorCode = 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_ROLE_DENIED';

function getMembershipGuardErrorCode(error: unknown): MembershipGuardErrorCode | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = (error as { code?: string }).code;
  if (code === 'MEMBERSHIP_NOT_FOUND' || code === 'MEMBERSHIP_ROLE_DENIED') {
    return code;
  }

  return null;
}

const ROUTE = 'ops.restaurants.profile';
const SAVE_FAILED_MESSAGE = 'Something went wrong saving these settings.';

function authFailure(authError: unknown) {
  const mapped = mapSupabaseAuthError(authError);
  return apiError(mapped.status, mapped.code, mapped.message);
}

function membershipFailure(
  error: unknown,
  ctx: { route: string; restaurantId: string; roleDeniedMessage: string },
) {
  const membershipErrorCode = getMembershipGuardErrorCode(error);
  if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
    return forbidden();
  }
  if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
    return forbidden('FORBIDDEN', ctx.roleDeniedMessage);
  }
  return internalError(error, {
    route: ctx.route,
    restaurantId: ctx.restaurantId,
    stage: 'membership',
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return authFailure(authError);
  }

  if (!user) {
    return unauthenticated();
  }

  const { id: restaurantId } = await context.params;
  let membershipRole: RestaurantDTO['role'] = 'viewer';
  try {
    const membership = await requireAdminMembership({ userId: user.id, restaurantId });
    membershipRole = (membership.role as RestaurantDTO['role']) ?? 'viewer';
  } catch (error) {
    return membershipFailure(error, {
      route: ROUTE,
      restaurantId,
      roleDeniedMessage: "You don't have permission to do that.",
    });
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    const selectRestaurant = (includeLogo: boolean) =>
      serviceSupabase
        .from('restaurants')
        .select(restaurantSelectColumns(includeLogo))
        .eq('id', restaurantId)
        .single<RestaurantRow>();

    let { data, error } = await selectRestaurant(true);

    if (error && isLogoUrlColumnMissing(error)) {
      logLogoColumnFallback('ops/restaurants/[id] GET');
      ({ data, error } = await selectRestaurant(false));
      data = ensureLogoColumnOnRow(data);
    }

    if (error) {
      throw error;
    }

    if (!data) {
      return notFound('RESTAURANT_NOT_FOUND', 'Restaurant not found.');
    }

    const restaurantRow = ensureLogoColumnOnRow(data);
    const businessDescription = await getRestaurantBusinessDescription(
      restaurantId,
      serviceSupabase,
    );
    const restaurant: RestaurantDTO = {
      id: restaurantRow.id,
      name: restaurantRow.name,
      slug: restaurantRow.slug,
      isActive: restaurantRow.is_active ?? true,
      timezone: restaurantRow.timezone,
      capacity: restaurantRow.capacity,
      contactEmail: restaurantRow.contact_email,
      contactPhone: restaurantRow.contact_phone,
      address: restaurantRow.address,
      businessDescription,
      managerDailySummaryEnabled: restaurantRow.manager_daily_summary_enabled ?? false,
      managerWhatsappEnabled: restaurantRow.manager_whatsapp_enabled ?? false,
      managerName: restaurantRow.manager_name,
      managerNotificationPhone: restaurantRow.manager_notification_phone,
      googleMapUrl: safeGoogleMapsUrl(restaurantRow.google_map_url),
      googleReviewUrl: safeGoogleReviewUrl(restaurantRow.google_review_url),
      bookingPolicy: restaurantRow.booking_policy,
      logoUrl: restaurantRow.logo_url,
      emailSendReminder24h: restaurantRow.email_send_reminder_24h ?? true,
      emailSendReminderShort: restaurantRow.email_send_reminder_short ?? true,
      emailSendReviewRequest: restaurantRow.email_send_review_request ?? true,
      reservationIntervalMinutes: restaurantRow.reservation_interval_minutes,
      reservationDefaultDurationMinutes: restaurantRow.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: restaurantRow.reservation_last_seating_buffer_minutes,
      reservationLifecycleGraceMinutes:
        restaurantRow.reservation_lifecycle_grace_minutes ??
        DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
      createdAt: restaurantRow.created_at,
      updatedAt: restaurantRow.updated_at,
      role: membershipRole,
    };

    const response: RestaurantResponse = {
      restaurant,
    };

    return NextResponse.json(response);
  } catch (error) {
    return internalError(error, { route: ROUTE, restaurantId, method: 'GET' });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => patchRestaurant(req, context));
}

async function patchRestaurant(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return authFailure(authError);
  }

  if (!user) {
    return unauthenticated();
  }

  const { id: restaurantId } = await context.params;
  let membershipRole: RestaurantDTO['role'] = 'viewer';
  try {
    const membership = await requireAdminMembership({ userId: user.id, restaurantId });
    membershipRole = (membership.role as RestaurantDTO['role']) ?? 'viewer';
  } catch (error) {
    return membershipFailure(error, {
      route: ROUTE,
      restaurantId,
      roleDeniedMessage: 'Only an owner or manager can change these settings.',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'The request body could not be read.');
  }

  const parsed = updateRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const input = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const restaurant = await updateRestaurant(
      restaurantId,
      {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        capacity: input.capacity,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        managerDailySummaryEnabled: input.managerDailySummaryEnabled,
        managerWhatsappEnabled: input.managerWhatsappEnabled,
        managerWhatsappConsentActorId: user.id,
        managerName: input.managerName,
        managerNotificationPhone: input.managerNotificationPhone,
        googleMapUrl: input.googleMapUrl,
        googleReviewUrl: input.googleReviewUrl,
        bookingPolicy: input.bookingPolicy,
        logoUrl: input.logoUrl,
        reservationIntervalMinutes: input.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: input.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: input.reservationLastSeatingBufferMinutes,
        reservationLifecycleGraceMinutes: input.reservationLifecycleGraceMinutes,
        emailSendReminder24h: input.emailSendReminder24h,
        emailSendReminderShort: input.emailSendReminderShort,
        emailSendReviewRequest: input.emailSendReviewRequest,
        // Written in the same transaction as the restaurant row.
        businessDescription: input.businessDescription,
      },
      serviceSupabase,
    );

    if (input.name !== undefined || input.slug !== undefined) {
      // The ops shell reads restaurant names and slugs from the cached memberships.
      invalidateUserMembershipsCache(user.id);
    }

    const response: RestaurantResponse = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        isActive: restaurant.isActive ?? true,
        timezone: restaurant.timezone,
        capacity: restaurant.capacity,
        contactEmail: restaurant.contactEmail,
        contactPhone: restaurant.contactPhone,
        address: restaurant.address,
        businessDescription: restaurant.businessDescription,
        managerDailySummaryEnabled: restaurant.managerDailySummaryEnabled,
        managerWhatsappEnabled: restaurant.managerWhatsappEnabled,
        managerName: restaurant.managerName,
        managerNotificationPhone: restaurant.managerNotificationPhone,
        googleMapUrl: restaurant.googleMapUrl,
        googleReviewUrl: restaurant.googleReviewUrl,
        bookingPolicy: restaurant.bookingPolicy,
        logoUrl: restaurant.logoUrl,
        emailSendReminder24h: restaurant.emailSendReminder24h,
        emailSendReminderShort: restaurant.emailSendReminderShort,
        emailSendReviewRequest: restaurant.emailSendReviewRequest,
        reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
        reservationLifecycleGraceMinutes: restaurant.reservationLifecycleGraceMinutes,
        createdAt: restaurant.createdAt,
        updatedAt: restaurant.updatedAt,
        role: membershipRole,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (isRestaurantUpdateError(error)) {
      return apiError(error.status, error.code, error.message, { fields: error.fields });
    }
    captureRestaurantServerEvent('restaurant_profile_section_save_failed', {
      restaurantId,
      distinctId: user.id,
      props: { section: 'restaurant', source: 'ops' },
    });
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: restaurantId },
      properties: { section: 'restaurant', source: 'ops', path: '/api/ops/restaurants/[id]' },
    });
    return internalError(
      error,
      { route: ROUTE, restaurantId, method: 'PATCH' },
      SAVE_FAILED_MESSAGE,
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => deleteRestaurantRoute(req, context));
}

async function deleteRestaurantRoute(req: NextRequest, context: RouteContext) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return authFailure(authError);
  }

  if (!user) {
    return unauthenticated();
  }

  const { id: restaurantId } = await context.params;
  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId,
      allowedRoles: [RESTAURANT_ROLE_OWNER],
    });
  } catch (error) {
    return membershipFailure(error, {
      route: ROUTE,
      restaurantId,
      roleDeniedMessage: 'Only an owner can delete a restaurant.',
    });
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    await deleteRestaurant(restaurantId, serviceSupabase);

    const response: DeleteRestaurantResponse = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: restaurantId },
      properties: { source: 'ops', path: '/api/ops/restaurants/[id]' },
    });
    return internalError(
      error,
      { route: ROUTE, restaurantId, method: 'DELETE' },
      'Unable to delete restaurant.',
    );
  }
}
