import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { firstString, safeDate } from '@/lib/api/query-params';
import { generateCSV } from '@/lib/export/csv';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { formatTimeRange } from '@/lib/utils/datetime';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getTodayBookingsSummary } from '@/server/ops/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireMembershipForRestaurant } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/bookings/export';

const exportQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type ExportQuery = z.infer<typeof exportQuerySchema>;

function parseQuery(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawDate = firstString(params, 'date');
  return exportQuerySchema.safeParse({
    restaurantId: firstString(params, 'restaurantId'),
    date: rawDate === undefined ? undefined : (safeDate(params, 'date') ?? '__invalid_date__'),
  });
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildFilename(restaurantName: string | null | undefined, date: string): string {
  const baseName = restaurantName?.trim().toLowerCase() ?? 'restaurant';
  const safeName = baseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'restaurant';
  return `bookings-${safeName}-${date}.csv`;
}

export async function GET(request: NextRequest) {
  const parsedQuery = parseQuery(request);
  if (!parsedQuery.success) {
    return validationError(parsedQuery.error, 'Invalid query');
  }
  const query: ExportQuery = parsedQuery.data;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    logger.error('[ops/bookings/export][GET] failed to resolve auth', {
      route: ROUTE,
      errorMessage: sanitizeLogText(error.message),
    });
    const mapped = mapSupabaseAuthError(error);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated('Authentication required');
  }

  let membership;
  try {
    membership = await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: query.restaurantId,
    });
  } catch (membershipError) {
    logger.error('[ops/bookings/export][GET] membership validation failed', {
      route: ROUTE,
      errorName: membershipError instanceof Error ? membershipError.name : typeof membershipError,
    });
    captureServerException(membershipError, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-bookings-export' },
    });
    return forbidden();
  }

  const rateLimit = await requireApiRateLimit({
    request,
    scope: 'ops-bookings:export',
    tenantId: query.restaurantId,
    userId: user.id,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many export requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const summary = await getTodayBookingsSummary(query.restaurantId, {
      client: getServiceSupabaseClient(),
      targetDate: query.date ?? undefined,
    });

    const timezone = summary.timezone;

    const csv = generateCSV(summary.bookings, [
      {
        header: 'Service Time',
        accessor: (booking) => formatTimeRange(booking.startTime, booking.endTime, timezone),
      },
      { header: 'Guest', accessor: (booking) => booking.customerName },
      { header: 'Party Size', accessor: (booking) => booking.partySize },
      { header: 'Status', accessor: (booking) => booking.status },
      { header: 'Email', accessor: (booking) => booking.customerEmail ?? '' },
      { header: 'Phone', accessor: (booking) => booking.customerPhone ?? '' },
      { header: 'Reference', accessor: (booking) => booking.reference ?? '' },
      { header: 'Source', accessor: (booking) => booking.source ?? '' },
      { header: 'Allergies', accessor: (booking) => normalizeText(booking.allergies) },
      {
        header: 'Dietary Restrictions',
        accessor: (booking) => normalizeText(booking.dietaryRestrictions),
      },
      { header: 'Seating Preference', accessor: (booking) => booking.seatingPreference ?? '' },
      {
        header: 'Marketing Opt-in',
        accessor: (booking) => {
          if (booking.marketingOptIn === true) return 'Yes';
          if (booking.marketingOptIn === false) return 'No';
          return '';
        },
      },
      { header: 'Profile Notes', accessor: (booking) => booking.profileNotes ?? '' },
      { header: 'Booking Notes', accessor: (booking) => booking.notes ?? '' },
    ]);

    const withBom = `\uFEFF${csv}`;
    const filename = buildFilename(membership.restaurants?.name, summary.date);

    return new NextResponse(withBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (summaryError) {
    captureServerException(summaryError, {
      distinctId: user.id,
      groups: query.restaurantId ? { restaurant: query.restaurantId } : undefined,
      properties: { restaurantId: query.restaurantId, source: 'ops', kind: 'ops-bookings-export' },
    });
    return internalError(summaryError, { route: ROUTE }, 'Unable to export bookings');
  }
}
