import { NextResponse } from 'next/server';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getCustomersWithHistory } from '@/server/ops/customers';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import {
  parseOpsCustomersQuery,
  type CustomerDTO,
  type OpsCustomersResponse,
  type OpsCustomersSummaryDTO,
} from './schema';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/customers';

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logger.error('[ops/customers][GET] failed to resolve auth', {
      route: ROUTE,
      errorMessage: sanitizeLogText(authError.message),
    });
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated('Authentication required');
  }

  const rawParams = {
    restaurantId: req.nextUrl.searchParams.get('restaurantId') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
    sortBy: req.nextUrl.searchParams.get('sortBy') ?? undefined,
    search: req.nextUrl.searchParams.get('search') ?? undefined,
    marketingOptIn: req.nextUrl.searchParams.get('marketingOptIn') ?? undefined,
    lastVisit: req.nextUrl.searchParams.get('lastVisit') ?? undefined,
    minBookings: req.nextUrl.searchParams.get('minBookings') ?? undefined,
  };

  const parsed = parseOpsCustomersQuery(rawParams);
  if (!parsed.success) {
    return validationError(parsed.error, 'Invalid query');
  }

  const params = parsed.data;

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-customers' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to verify memberships');
  }

  if (memberships.length === 0) {
    const empty: OpsCustomersResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let targetRestaurantId = params.restaurantId;

  if (targetRestaurantId) {
    const allowed = membershipIds.includes(targetRestaurantId);
    if (!allowed) {
      return forbidden();
    }
  } else {
    targetRestaurantId = membershipIds[0] ?? null;
  }

  if (!targetRestaurantId) {
    const empty: OpsCustomersResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    const result = await getCustomersWithHistory({
      restaurantId: targetRestaurantId,
      page: params.page,
      pageSize: params.pageSize,
      sortOrder: params.sort,
      sortBy: params.sortBy,
      search: params.search,
      marketingOptIn: params.marketingOptIn,
      lastVisit: params.lastVisit,
      minBookings: params.minBookings,
      client: serviceSupabase,
      includeSummary: params.page === 1,
    });

    const items: CustomerDTO[] = result.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      marketingOptIn: customer.marketingOptIn,
      createdAt: customer.createdAt,
      firstBookingAt: customer.firstBookingAt,
      lastBookingAt: customer.lastVisitAt,
      totalBookings: customer.totalBookings,
      totalCovers: customer.totalCovers,
      totalCancellations: customer.totalCancellations,
    }));

    const summary: OpsCustomersSummaryDTO | undefined =
      params.page === 1 && result.summary
        ? {
            total: result.summary.total,
            optedIn: result.summary.optedIn,
            optedOut: result.summary.optedOut,
            returning: result.summary.returning,
            vip: result.summary.vip,
            neverVisited: result.summary.neverVisited,
          }
        : undefined;

    const response: OpsCustomersResponse = {
      items,
      pageInfo: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNext: result.hasNext,
      },
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: targetRestaurantId },
      properties: { restaurantId: targetRestaurantId, source: 'ops', kind: 'ops-customers' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to fetch guests');
  }
}
