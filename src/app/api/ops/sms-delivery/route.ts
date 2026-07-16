import { NextResponse } from 'next/server';
import { z } from 'zod';

import { RESTAURANT_ADMIN_ROLES } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import {
  getSmsDeliveryAttemptsSummary,
  listSmsDeliveryAttemptsForRestaurant,
  SmsDeliveryLogUnavailableError,
} from '@/server/sms/delivery-log';
import { sanitizeOpsSmsDeliveryAttempts } from '@/src/lib/sms-delivery/sanitize';
import {
  OPS_SMS_DELIVERY_CHANNEL_VALUES,
  OPS_SMS_DELIVERY_RANGE_VALUES,
  SMS_DELIVERY_STATUS_VALUES,
  type OpsSmsDeliveryFeedResponse,
  type SmsDeliveryStatus,
} from '@/types/smsDelivery';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  range: z.enum(OPS_SMS_DELIVERY_RANGE_VALUES).default('7d'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  channel: z.enum(OPS_SMS_DELIVERY_CHANNEL_VALUES).default('all'),
});

function jsonError(
  status: number,
  payload: Omit<Extract<OpsSmsDeliveryFeedResponse, { ok: false }>, 'ok'> & { message?: string },
) {
  return NextResponse.json(
    {
      ok: false,
      ...payload,
      message: payload.message ?? payload.error,
    } satisfies OpsSmsDeliveryFeedResponse & { message: string },
    { status },
  );
}

function parseStatuses(
  raw: string | null,
): { ok: true; statuses: SmsDeliveryStatus[] } | { ok: false } {
  if (!raw) return { ok: true, statuses: [] };
  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const allowed = new Set<string>(SMS_DELIVERY_STATUS_VALUES);
  for (const value of parts) {
    if (!allowed.has(value)) return { ok: false };
  }
  return { ok: true, statuses: parts as SmsDeliveryStatus[] };
}

export async function GET(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(entries);
  if (!parsedQuery.success) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid query' });
  }

  const statuses = parseStatuses(request.nextUrl.searchParams.get('status'));
  if (!statuses.ok) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid status filter' });
  }

  try {
    const { supabase, user } = await requireSession();
    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find((membership) => membership.restaurant_id)?.restaurant_id ?? null;

    const restaurantId = parsedQuery.data.restaurantId ?? fallbackRestaurantId;
    if (!restaurantId) {
      return jsonError(403, { code: 'FORBIDDEN', error: 'No restaurant access' });
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId,
      allowedRoles: RESTAURANT_ADMIN_ROLES,
    });

    const listResult = await listSmsDeliveryAttemptsForRestaurant({
      restaurantId,
      range: parsedQuery.data.range,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
      statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
      channel: parsedQuery.data.channel,
    });

    const summary = await getSmsDeliveryAttemptsSummary({
      restaurantId,
      range: parsedQuery.data.range,
      statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
      channel: parsedQuery.data.channel,
    });

    return NextResponse.json(
      {
        ok: true,
        restaurantId,
        range: parsedQuery.data.range,
        pageInfo: {
          page: listResult.page,
          pageSize: listResult.pageSize,
          hasNext: listResult.hasNext,
        },
        attempts: sanitizeOpsSmsDeliveryAttempts(listResult.attempts),
        summary,
      } satisfies Extract<OpsSmsDeliveryFeedResponse, { ok: true }>,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      const mapped =
        error.code === 'UNAUTHENTICATED'
          ? { status: 401 as const, code: 'UNAUTHENTICATED' as const, error: error.message }
          : error.code === 'FORBIDDEN'
            ? { status: 403 as const, code: 'FORBIDDEN' as const, error: error.message }
            : {
                status: error.status as 401 | 403 | 500,
                code: 'INTERNAL' as const,
                error: error.message,
              };
      return jsonError(mapped.status, { code: mapped.code, error: mapped.error });
    }

    if (error instanceof SmsDeliveryLogUnavailableError) {
      return jsonError(503, {
        code: 'DELIVERY_LOG_UNAVAILABLE',
        error: 'Delivery tracking is temporarily unavailable',
      });
    }

    console.error('[ops/sms-delivery] unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, { properties: { source: 'ops', kind: 'sms-delivery' } });
    return jsonError(500, { code: 'INTERNAL', error: 'Internal error' });
  }
}
