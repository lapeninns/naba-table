import { NextResponse } from 'next/server';

import { internalError } from '@/lib/api/errors';
import { firstString } from '@/lib/api/query-params';
import { generateCSV } from '@/lib/export/csv';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getAllCustomersWithHistory, type CustomerGuestRecord } from '@/server/ops/customers';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import { parseOpsCustomersQuery } from '../schema';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/customers/export';

const CUSTOMER_EXPORT_MAX_ROWS = 5000;

function formatDate(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

const CUSTOMER_EXPORT_COLUMNS: {
  header: string;
  accessor: (row: CustomerGuestRecord) => unknown;
}[] = [
  { header: 'Name', accessor: (row: CustomerGuestRecord) => row.name },
  { header: 'Email', accessor: (row: CustomerGuestRecord) => row.email },
  { header: 'Phone', accessor: (row: CustomerGuestRecord) => row.phone },
  { header: 'Total Bookings', accessor: (row: CustomerGuestRecord) => row.totalBookings },
  { header: 'Total Covers', accessor: (row: CustomerGuestRecord) => row.totalCovers },
  { header: 'Total Cancellations', accessor: (row: CustomerGuestRecord) => row.totalCancellations },
  {
    header: 'First Booking',
    accessor: (row: CustomerGuestRecord) => formatDate(row.firstBookingAt),
  },
  { header: 'Last Booking', accessor: (row: CustomerGuestRecord) => formatDate(row.lastVisitAt) },
  {
    header: 'Marketing Opt-in',
    accessor: (row: CustomerGuestRecord) => formatBoolean(row.marketingOptIn),
  },
];

function buildFilename(restaurantName: string | null | undefined): string {
  const baseName = restaurantName?.trim().toLowerCase() ?? 'restaurant';
  const safeName = baseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'restaurant';
  const date = new Date().toISOString().split('T')[0];
  return `guests-${safeName}-${date}.csv`;
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logger.error('[ops/customers/export][GET] failed to resolve auth', {
      route: ROUTE,
      error: authError.message,
    });
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rawParams = {
    restaurantId: firstString(req.nextUrl.searchParams, 'restaurantId'),
    sort: firstString(req.nextUrl.searchParams, 'sort'),
    sortBy: firstString(req.nextUrl.searchParams, 'sortBy'),
    search: firstString(req.nextUrl.searchParams, 'search'),
    marketingOptIn: firstString(req.nextUrl.searchParams, 'marketingOptIn'),
    lastVisit: firstString(req.nextUrl.searchParams, 'lastVisit'),
    minBookings: firstString(req.nextUrl.searchParams, 'minBookings'),
  };

  const parsed = parseOpsCustomersQuery(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-customers-export' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to verify memberships');
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const targetRestaurantId = params.restaurantId ?? membershipIds[0] ?? null;

  const membership = targetRestaurantId
    ? memberships.find((item) => item.restaurant_id === targetRestaurantId)
    : null;

  if (!membership || !targetRestaurantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'ops-customers:export',
    tenantId: targetRestaurantId,
    userId: user.id,
    limit: 6,
    windowMs: 60_000,
    message: 'Too many export requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  const serviceSupabase = getServiceSupabaseClient();
  const sortOrder = params.sort;
  const sortBy = params.sortBy ?? 'last_visit';

  let customers: CustomerGuestRecord[];
  try {
    customers = await getAllCustomersWithHistory({
      restaurantId: targetRestaurantId,
      sortOrder,
      sortBy,
      search: params.search ?? null,
      marketingOptIn: params.marketingOptIn,
      lastVisit: params.lastVisit,
      minBookings: params.minBookings,
      client: serviceSupabase,
      maxRows: CUSTOMER_EXPORT_MAX_ROWS,
    });
  } catch (error) {
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: targetRestaurantId },
      properties: { restaurantId: targetRestaurantId, source: 'ops', kind: 'ops-customers-export' },
    });
    return internalError(error, { route: ROUTE }, 'Unable to export guests');
  }

  const csv = generateCSV(customers, CUSTOMER_EXPORT_COLUMNS);
  const withBom = `\uFEFF${csv}`;
  const filename = buildFilename(membership.restaurants?.name);

  return new NextResponse(withBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
