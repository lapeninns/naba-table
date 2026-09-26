import { NextResponse } from 'next/server';

import {
  apiError,
  conflict,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { withPlatformAdminAuthorization } from '@/server/auth/guards';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { createRestaurant, listRestaurantsForOps } from '@/server/restaurants';
import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';
import { upsertRestaurantBusinessDescription } from '@/server/restaurants/details';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import {
  createRestaurantSchema,
  listRestaurantsQuerySchema,
  type RestaurantDTO,
  type RestaurantsListResponse,
  type RestaurantResponse,
} from './schema';

import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    logger.warn('ops.restaurants.auth_failed', {
      route: '/api/ops/restaurants',
      status: mapped.status,
    });
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  const rawParams = {
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    search: req.nextUrl.searchParams.get('search') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
  };

  const parsed = listRestaurantsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const params = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const result = await listRestaurantsForOps(
      {
        userId: user.id,
        page: params.page,
        pageSize: params.pageSize,
        search: params.search,
        sort: params.sort,
      },
      serviceSupabase,
    );

    const items: RestaurantDTO[] = result.restaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      isActive: restaurant.isActive ?? true,
      timezone: restaurant.timezone,
      capacity: restaurant.capacity,
      contactEmail: restaurant.contactEmail,
      contactPhone: restaurant.contactPhone,
      address: restaurant.address,
      businessDescription: null,
      managerDailySummaryEnabled: restaurant.managerDailySummaryEnabled,
      managerWhatsappEnabled: restaurant.managerWhatsappEnabled,
      managerName: restaurant.managerName,
      managerNotificationPhone: restaurant.managerNotificationPhone,
      googleMapUrl: restaurant.googleMapUrl,
      googleReviewUrl: restaurant.googleReviewUrl,
      bookingPolicy: restaurant.bookingPolicy,
      logoUrl: restaurant.logoUrl,
      emailSendReminder24h: restaurant.emailSendReminder24h ?? true,
      emailSendReminderShort: restaurant.emailSendReminderShort ?? true,
      emailSendReviewRequest: restaurant.emailSendReviewRequest ?? true,
      reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
      reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
      reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
      reservationLifecycleGraceMinutes: restaurant.reservationLifecycleGraceMinutes,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
      role: restaurant.role,
    }));

    const response: RestaurantsListResponse = {
      items,
      pageInfo: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNext: result.hasNext,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-restaurants' },
    });
    return internalError(
      error,
      { route: '/api/ops/restaurants', method: 'GET' },
      'Unable to fetch restaurants',
    );
  }
}

export async function POST(req: NextRequest) {
  const authorization = await withPlatformAdminAuthorization(req, { csrf: true });
  if (!authorization.ok) {
    return authorization.response;
  }

  const rateLimitResponse = await requireApiRateLimit({
    request: req,
    scope: 'ops.restaurants.create',
    limit: 10,
    windowMs: 60_000,
    userId: authorization.user.id,
    message: 'Too many restaurant creation attempts',
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const parsed = createRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const input = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();

  try {
    const restaurant = await createRestaurant(
      {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        capacity: input.capacity,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        managerDailySummaryEnabled: input.managerDailySummaryEnabled,
        managerNotificationPhone: input.managerNotificationPhone,
        googleMapUrl: input.googleMapUrl,
        googleReviewUrl: input.googleReviewUrl,
        bookingPolicy: input.bookingPolicy,
        logoUrl: input.logoUrl,
        emailSendReminder24h: input.emailSendReminder24h,
        emailSendReminderShort: input.emailSendReminderShort,
        emailSendReviewRequest: input.emailSendReviewRequest,
        reservationIntervalMinutes: input.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: input.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: input.reservationLastSeatingBufferMinutes,
        reservationLifecycleGraceMinutes: input.reservationLifecycleGraceMinutes,
      },
      authorization.user.id,
      serviceSupabase,
    );
    const businessDescription =
      input.businessDescription !== undefined
        ? await upsertRestaurantBusinessDescription(
            restaurant.id,
            input.businessDescription,
            serviceSupabase,
          )
        : null;

    const response: RestaurantResponse = {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        isActive: true,
        timezone: restaurant.timezone,
        capacity: restaurant.capacity,
        contactEmail: restaurant.contactEmail,
        contactPhone: restaurant.contactPhone,
        address: restaurant.address,
        businessDescription,
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
        role: 'owner',
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof RestaurantSlugUnavailableError) {
      return conflict('SLUG_TAKEN', 'That web address is taken. Try a different slug.', {
        fields: { slug: ['That web address is taken. Try a different slug.'] },
      });
    }
    if (error instanceof RestaurantAccessExistsError) {
      return conflict('RESTAURANT_ACCESS_EXISTS', 'This account already has restaurant access.');
    }
    if (error instanceof RestaurantCreateValidationError) {
      return apiError(400, 'VALIDATION_FAILED', error.message);
    }
    captureServerException(error, {
      distinctId: authorization.user.id,
      properties: { source: 'ops', kind: 'ops-restaurants' },
    });
    return internalError(
      error,
      { route: '/api/ops/restaurants', method: 'POST' },
      'Unable to create restaurant',
    );
  }
}
