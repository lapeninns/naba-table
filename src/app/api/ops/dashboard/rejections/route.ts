import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { getRejectionAnalytics } from '@/server/ops/rejections';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  buildDashboardAccessErrorResponse,
  requireDashboardAccess,
} from '@/src/app/api/ops/dashboard/_shared';

import type { NextRequest } from 'next/server';

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
  bucket: z.enum(['day', 'hour']).optional(),
});

type RejectionsQuery = z.infer<typeof querySchema>;

const MAX_REJECTION_ANALYTICS_RANGE_DAYS = 7;

function parseIsoBound(value: string | undefined, fallback: DateTime): DateTime | null {
  if (!value) {
    return fallback;
  }
  const parsed = DateTime.fromISO(value, { zone: 'utc' });
  return parsed.isValid ? parsed : null;
}

function normalizeRange(
  query: RejectionsQuery,
): { ok: true; from: string; to: string } | { ok: false; response: NextResponse } {
  const fallbackTo = DateTime.utc();
  const to = parseIsoBound(query.to, fallbackTo);
  if (!to) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid query' }, { status: 400 }) };
  }

  const from = parseIsoBound(query.from, to.minus({ days: 1 }));
  if (!from) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid query' }, { status: 400 }) };
  }

  if (from > to) {
    return {
      ok: false,
      response: NextResponse.json({ error: '`from` must be before `to`' }, { status: 400 }),
    };
  }

  if (to.diff(from, 'days').days > MAX_REJECTION_ANALYTICS_RANGE_DAYS) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Date range must be ${MAX_REJECTION_ANALYTICS_RANGE_DAYS} days or less` },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    from: from.toUTC().toISO() ?? from.toString(),
    to: to.toUTC().toISO() ?? to.toString(),
  };
}

function parseQuery(request: NextRequest): RejectionsQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = querySchema.safeParse(entries);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }
  const range = normalizeRange(query);
  if (!range.ok) {
    return range.response;
  }

  try {
    await requireDashboardAccess(query.restaurantId);
  } catch (error) {
    return buildDashboardAccessErrorResponse('rejections', error);
  }

  try {
    const rateLimit = await requireApiRateLimit({
      request,
      scope: 'ops-dashboard:rejections',
      tenantId: query.restaurantId,
      limit: 30,
      windowMs: 60_000,
      message: 'Too many rejection analytics requests',
    });
    if (rateLimit) {
      return rateLimit;
    }

    const analytics = await getRejectionAnalytics(query.restaurantId, {
      client: getServiceSupabaseClient(),
      from: range.from,
      to: range.to,
      bucket: query.bucket,
    });

    return NextResponse.json(analytics);
  } catch (analyticsError) {
    console.error('[ops/dashboard][rejections] failed to load analytics', analyticsError);
    captureServerException(analyticsError, {
      groups: { restaurant: query.restaurantId },
      properties: {
        restaurantId: query.restaurantId,
        source: 'ops',
        kind: 'ops-dashboard-rejections',
      },
    });
    return NextResponse.json({ error: 'Unable to load rejection analytics' }, { status: 500 });
  }
}
