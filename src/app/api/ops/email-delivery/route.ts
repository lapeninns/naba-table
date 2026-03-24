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
  getEmailDeliveryAttemptsSummary,
  listEmailDeliveryAttemptsForRestaurant,
} from '@/server/emails/email-delivery-log';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryFeedResponse,
  type OpsEmailDeliverySummaryResponse,
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
  fixture: z.string().trim().min(1).optional(),
  simulateEmailDeliveryError: z.enum(['1']).optional(),
  recipientEmail: z.string().trim().min(1).optional(),
  messageId: z.string().trim().min(1).optional(),
  bookingRef: z.string().trim().min(1).optional(),
  templateType: z.string().trim().min(1).optional(),
  emailType: z.string().trim().min(1).optional(),
  summaryOnly: z.enum(['1']).optional(),
});

function isDevOrTestFaultInjectionEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.APP_ENV === 'development' || process.env.APP_ENV === 'test';
}

function buildRetryActionsFixture(restaurantId: string): Extract<OpsEmailDeliveryFeedResponse, { ok: true }> {
  const failedDeliveryLogId = '11111111-1111-4111-8111-111111111111';
  const bouncedDeliveryLogId = '22222222-2222-4222-8222-222222222222';
  const deliveredDeliveryLogId = '33333333-3333-4333-8333-333333333333';

  const attempts = [
    {
      id: failedDeliveryLogId,
      messageId: 'fixture-provider-message-failed',
      recipientEmail: 'retry.failed@example.com',
      bookingId: 'booking-fixture-failed',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'mock',
      currentStatus: 'failed',
      currentOccurredAt: '2026-03-24T10:02:00.000Z',
      booking: {
        id: 'booking-fixture-failed',
        reference: 'FXT001',
        bookingDate: '2026-03-24',
        startTime: '19:00',
        endTime: '20:30',
        customerName: 'Fixture Failed',
        partySize: 2,
      },
      events: [
        {
          id: 'fixture-failed-sent',
          bookingId: 'booking-fixture-failed',
          restaurantId,
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'retry.failed@example.com',
          messageId: 'fixture-provider-message-failed',
          status: 'sent',
          provider: 'mock',
          occurredAt: '2026-03-24T10:00:00.000Z',
          error: null,
          metadata: { subject: 'Fixture failed retry candidate' },
        },
        {
          id: 'fixture-failed-final',
          bookingId: 'booking-fixture-failed',
          restaurantId,
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'retry.failed@example.com',
          messageId: 'fixture-provider-message-failed',
          status: 'failed',
          provider: 'mock',
          occurredAt: '2026-03-24T10:02:00.000Z',
          error: 'Fixture forced failure for retry validation.',
          metadata: { subject: 'Fixture failed retry candidate' },
        },
      ],
    },
    {
      id: bouncedDeliveryLogId,
      messageId: 'fixture-provider-message-bounced',
      recipientEmail: 'retry.bounced@example.com',
      bookingId: 'booking-fixture-bounced',
      emailType: 'review_request',
      templateType: 'review_request',
      provider: 'mock',
      currentStatus: 'bounced',
      currentOccurredAt: '2026-03-24T09:16:00.000Z',
      booking: {
        id: 'booking-fixture-bounced',
        reference: 'FXT002',
        bookingDate: '2026-03-24',
        startTime: '20:00',
        endTime: '21:30',
        customerName: 'Fixture Bounced',
        partySize: 4,
      },
      events: [
        {
          id: 'fixture-bounced-sent',
          bookingId: 'booking-fixture-bounced',
          restaurantId,
          emailType: 'review_request',
          templateType: 'review_request',
          recipientEmail: 'retry.bounced@example.com',
          messageId: 'fixture-provider-message-bounced',
          status: 'sent',
          provider: 'mock',
          occurredAt: '2026-03-24T09:15:00.000Z',
          error: null,
          metadata: { subject: 'Fixture bounced retry candidate' },
        },
        {
          id: 'fixture-bounced-final',
          bookingId: 'booking-fixture-bounced',
          restaurantId,
          emailType: 'review_request',
          templateType: 'review_request',
          recipientEmail: 'retry.bounced@example.com',
          messageId: 'fixture-provider-message-bounced',
          status: 'bounced',
          provider: 'mock',
          occurredAt: '2026-03-24T09:16:00.000Z',
          error: 'Fixture mailbox bounced for validation.',
          metadata: { subject: 'Fixture bounced retry candidate' },
        },
      ],
    },
    {
      id: deliveredDeliveryLogId,
      messageId: 'fixture-provider-message-delivered',
      recipientEmail: 'retry.delivered@example.com',
      bookingId: 'booking-fixture-delivered',
      emailType: 'updated',
      templateType: 'booking_update',
      provider: 'mock',
      currentStatus: 'delivered',
      currentOccurredAt: '2026-03-24T08:02:00.000Z',
      booking: {
        id: 'booking-fixture-delivered',
        reference: 'FXT003',
        bookingDate: '2026-03-24',
        startTime: '18:30',
        endTime: '20:00',
        customerName: 'Fixture Delivered',
        partySize: 3,
      },
      events: [
        {
          id: 'fixture-delivered-sent',
          bookingId: 'booking-fixture-delivered',
          restaurantId,
          emailType: 'updated',
          templateType: 'booking_update',
          recipientEmail: 'retry.delivered@example.com',
          messageId: 'fixture-provider-message-delivered',
          status: 'sent',
          provider: 'mock',
          occurredAt: '2026-03-24T08:00:00.000Z',
          error: null,
          metadata: { subject: 'Fixture delivered control row' },
        },
        {
          id: 'fixture-delivered-final',
          bookingId: 'booking-fixture-delivered',
          restaurantId,
          emailType: 'updated',
          templateType: 'booking_update',
          recipientEmail: 'retry.delivered@example.com',
          messageId: 'fixture-provider-message-delivered',
          status: 'delivered',
          provider: 'mock',
          occurredAt: '2026-03-24T08:02:00.000Z',
          error: null,
          metadata: { subject: 'Fixture delivered control row' },
        },
      ],
    },
  ] satisfies Extract<OpsEmailDeliveryFeedResponse, { ok: true }>['attempts'];

  return {
    ok: true,
    restaurantId,
    range: '7d',
    pageInfo: { page: 1, pageSize: 50, hasNext: false },
    attempts,
    summary: {
      total: attempts.length,
      sent: 0,
      delivered: 1,
      deliveryDelayed: 0,
      bounced: 1,
      complained: 0,
      failed: 1,
      deliveredRate: 1 / 3,
      failureRate: 2 / 3,
      uniqueRecipients: 3,
      uniqueBookings: 3,
      p50DeliverySeconds: 120,
      p95DeliverySeconds: 120,
      topFailedTemplates: [
        { templateType: 'booking_confirmation', count: 1 },
        { templateType: 'review_request', count: 1 },
      ],
      topFailedEmailTypes: [
        { emailType: 'created', count: 1 },
        { emailType: 'review_request', count: 1 },
      ],
    },
  };
}

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

  if (
    isDevOrTestFaultInjectionEnabled() &&
    (parsedQuery.data.messageId === '__force_error__' || parsedQuery.data.simulateEmailDeliveryError === '1')
  ) {
    return jsonError(418, {
      code: 'FORCED_ERROR',
      error: 'Forced delivery log error for dev/test validation.',
      message: 'Forced delivery log error for dev/test validation.',
    });
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

    if (isDevOrTestFaultInjectionEnabled() && parsedQuery.data.fixture === 'retry-actions') {
      return NextResponse.json(buildRetryActionsFixture(restaurantId), { status: 200 });
    }

    const listResult = await listEmailDeliveryAttemptsForRestaurant({
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

    let summary: Extract<OpsEmailDeliveryFeedResponse, { ok: true }>['summary'] = undefined;
    if (listResult.page === 1 || parsedQuery.data.summaryOnly === '1') {
      try {
        summary = await getEmailDeliveryAttemptsSummary({
          restaurantId,
          range: parsedQuery.data.range,
          statuses: statuses.statuses.length > 0 ? statuses.statuses : undefined,
          recipientEmail: parsedQuery.data.recipientEmail,
          messageId: parsedQuery.data.messageId,
          bookingRef: parsedQuery.data.bookingRef ? parsedQuery.data.bookingRef.toUpperCase() : undefined,
          templateType: parsedQuery.data.templateType,
          emailType: parsedQuery.data.emailType,
        });
      } catch (error) {
        console.error('[ops/email-delivery] failed to compute summary', {
          restaurantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (parsedQuery.data.summaryOnly === '1') {
      return NextResponse.json(
        {
          ok: true,
          restaurantId,
          range: parsedQuery.data.range,
          summary:
            summary ?? {
              total: 0,
              sent: 0,
              delivered: 0,
              deliveryDelayed: 0,
              bounced: 0,
              complained: 0,
              failed: 0,
              deliveredRate: 0,
              failureRate: 0,
              uniqueRecipients: 0,
              uniqueBookings: 0,
              p50DeliverySeconds: null,
              p95DeliverySeconds: null,
              topFailedTemplates: [],
              topFailedEmailTypes: [],
            },
        } satisfies Extract<OpsEmailDeliverySummaryResponse, { ok: true }>,
        { status: 200 },
      );
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
        attempts: listResult.attempts,
        ...(summary ? { summary } : {}),
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
