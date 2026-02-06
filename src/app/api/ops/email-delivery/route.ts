import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import {
  EmailDeliveryLogUnavailableError,
  listEmailDeliveryEventsForRestaurant,
} from '@/server/emails/email-delivery-log';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryFeedResponse,
} from '@/types/emailDelivery';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RANGE_VALUES = OPS_EMAIL_DELIVERY_RANGE_VALUES;
const STATUS_VALUES = EMAIL_DELIVERY_STATUS_VALUES;

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  range: z.enum(RANGE_VALUES).default('7d'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  recipientEmail: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1).optional(),
  bookingRef: z.string().trim().min(1).optional(),
  templateType: z.string().trim().min(1).optional(),
  emailType: z.string().trim().min(1).optional(),
});

function jsonError(
  status: number,
  payload: Omit<Extract<OpsEmailDeliveryFeedResponse, { ok: false }>, 'ok'> & { message?: string },
) {
  return NextResponse.json(
    {
      ok: false,
      ...payload,
      message: payload.message ?? payload.error,
    } satisfies OpsEmailDeliveryFeedResponse & { message: string },
    { status },
  );
}

function parseStatuses(raw: string | null): { ok: true; statuses: EmailDeliveryStatus[] } | { ok: false } {
  if (!raw) {
    return { ok: true, statuses: [] };
  }

  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const allowed = new Set<string>(STATUS_VALUES);
  for (const value of parts) {
    if (!allowed.has(value)) {
      return { ok: false };
    }
  }

  return { ok: true, statuses: parts as EmailDeliveryStatus[] };
}

export async function GET(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(entries);
  if (!parsedQuery.success) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid query' });
  }

  const rawStatus = request.nextUrl.searchParams.get('status');
  const statuses = parseStatuses(rawStatus);
  if (!statuses.ok) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid status filter' });
  }

  try {
    const { supabase, user } = await requireSession();

    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find((membership) => typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0)
        ?.restaurant_id ?? null;

    const restaurantId = parsedQuery.data.restaurantId ?? fallbackRestaurantId;

    if (!restaurantId) {
      return jsonError(403, { code: 'FORBIDDEN', error: 'No restaurant access' });
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId,
    });

    const listResult = await listEmailDeliveryEventsForRestaurant({
      restaurantId,
      range: parsedQuery.data.range,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
      statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
      recipientEmail: parsedQuery.data.recipientEmail,
      messageId: parsedQuery.data.messageId,
      bookingRef: parsedQuery.data.bookingRef ? parsedQuery.data.bookingRef.toUpperCase() : undefined,
      templateType: parsedQuery.data.templateType,
      emailType: parsedQuery.data.emailType,
    });

    const events = listResult.events;

    const bookingIds = Array.from(
      new Set(
        events
          .map((event) => event.bookingId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );

    const bookings: Extract<OpsEmailDeliveryFeedResponse, { ok: true }>['bookings'] = [];

    if (bookingIds.length > 0) {
      try {
        const service = getServiceSupabaseClient();
        const { data, error } = await service
          .from('bookings')
          .select('id, reference, booking_date, start_time, end_time, customer_name, party_size')
          .eq('restaurant_id', restaurantId)
          .in('id', bookingIds);

        if (error) {
          console.error('[ops/email-delivery] failed to load booking context', {
            restaurantId,
            code: error.code ?? null,
            message: error.message,
          });
        } else if (data) {
          for (const row of data as Array<{
            id: string;
            reference: string;
            booking_date: string;
            start_time: string;
            end_time: string;
            customer_name: string;
            party_size: number;
          }>) {
            bookings.push({
              id: row.id,
              reference: row.reference,
              bookingDate: row.booking_date,
              startTime: row.start_time,
              endTime: row.end_time,
              customerName: row.customer_name,
              partySize: row.party_size,
            });
          }
        }
      } catch (error) {
        console.error('[ops/email-delivery] booking context lookup threw', {
          restaurantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

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
        events,
        bookings,
      } satisfies Extract<OpsEmailDeliveryFeedResponse, { ok: true }>,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      const mapped =
        error.code === 'UNAUTHENTICATED'
          ? { status: 401 as const, code: 'UNAUTHENTICATED' as const, error: error.message }
          : error.code === 'FORBIDDEN'
            ? { status: 403 as const, code: 'FORBIDDEN' as const, error: error.message }
            : { status: error.status as 401 | 403 | 500, code: 'INTERNAL' as const, error: error.message };
      return jsonError(mapped.status, { code: mapped.code, error: mapped.error });
    }

    if (error instanceof EmailDeliveryLogUnavailableError) {
      return jsonError(503, {
        code: 'DELIVERY_LOG_UNAVAILABLE',
        error: 'Delivery tracking is temporarily unavailable',
      });
    }

    console.error('[ops/email-delivery] unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(500, { code: 'INTERNAL', error: 'Internal error' });
  }
}
