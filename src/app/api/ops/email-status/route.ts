import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';

import { EMAIL_DELIVERY_STATUSES } from '@/lib/emails/delivery-status';
import { EMAIL_JOB_TYPES } from '@/lib/queue/email-types';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { getEmailJobIdCandidates, getEmailQueue, type EmailJobType } from '@/server/queue/email';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import { parseOpsEmailStatusQuery } from './schema';

import type { Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_BOOKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
] as const;

type BookingRow = Pick<
  Tables<'bookings'>,
  'id' | 'restaurant_id' | 'start_at' | 'end_at' | 'status' | 'customer_name' | 'customer_email' | 'customer_phone'
> & { restaurants?: { name: string | null } | null };

type DeliveryRow = {
  id: string;
  booking_id: string | null;
  restaurant_id: string | null;
  email_type: string | null;
  template_type: string | null;
  recipient_email: string;
  message_id: string;
  status: string;
  occurred_at: string | null;
  provider: string | null;
  error: string | null;
  bookings?: { start_at: string | null; status: string | null; customer_name: string | null } | null;
  restaurants?: { name: string | null } | null;
};

type EmailStatusEntry = {
  type: EmailJobType;
  state: 'waiting' | 'active' | 'delayed' | 'failed' | 'none' | 'unknown';
  jobId: string | null;
  processAt: string | null;
  failedReason: string | null;
};

function buildPageInfo(params: { page: number; pageSize: number; total: number }) {
  const { page, pageSize, total } = params;
  return {
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
  };
}

function resolveDeliveryRange(params: { from?: string; to?: string }) {
  const now = DateTime.utc();
  const defaultFrom = now.minus({ days: 30 });
  const defaultTo = now.plus({ days: 30 });
  const from = params.from ? DateTime.fromISO(params.from, { zone: 'utc' }) : defaultFrom;
  const to = params.to ? DateTime.fromISO(params.to, { zone: 'utc' }) : defaultTo;
  return { from, to, now };
}

function normalizeState(state: string): EmailStatusEntry['state'] {
  switch (state) {
    case 'failed':
      return 'failed';
    case 'active':
      return 'active';
    case 'delayed':
      return 'delayed';
    case 'waiting':
    case 'wait':
    case 'paused':
    case 'waiting-children':
      return 'waiting';
    default:
      return 'unknown';
  }
}

async function resolveEmailEntry(params: {
  bookingId: string;
  type: EmailJobType;
}): Promise<EmailStatusEntry> {
  const { bookingId, type } = params;
  const queue = getEmailQueue();
  const candidates = getEmailJobIdCandidates(type, bookingId);
  let job = null;

  for (const candidate of candidates) {
     
    const resolved = await queue.getJob(candidate);
    if (resolved) {
      job = resolved;
      break;
    }
  }

  if (!job) {
    return {
      type,
      state: 'none',
      jobId: null,
      processAt: null,
      failedReason: null,
    };
  }

  try {
    const rawState = await job.getState();
    const state = normalizeState(rawState);
    const delayMs = job.opts.delay ?? 0;
    const processAt = delayMs > 0 ? new Date(job.timestamp + delayMs).toISOString() : null;

    return {
      type,
      state,
      jobId: job.id == null ? null : String(job.id),
      processAt: state === 'delayed' ? processAt : null,
      failedReason: state === 'failed' ? job.failedReason ?? null : null,
    };
  } catch (error) {
    console.error('[ops/email-status] job state lookup failed', error);
    return {
      type,
      state: 'unknown',
      jobId: job.id == null ? null : String(job.id),
      processAt: null,
      failedReason: null,
    };
  }
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/email-status][GET] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rawParams = {
    view: req.nextUrl.searchParams.get('view') ?? undefined,
    restaurantId: req.nextUrl.searchParams.get('restaurantId') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    windowMinutes: req.nextUrl.searchParams.get('windowMinutes') ?? undefined,
    type: req.nextUrl.searchParams.get('type') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
  };

  const parsed = parseOpsEmailStatusQuery(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    console.error('[ops/email-status][GET] membership lookup failed', error);
    return NextResponse.json({ error: 'Unable to verify memberships' }, { status: 500 });
  }

  if (memberships.length === 0) {
    if (params.view === 'delivery') {
      const { from, to, now } = resolveDeliveryRange({ from: params.from, to: params.to });
      return NextResponse.json({
        view: 'delivery',
        items: [],
        pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: 0 }),
        generatedAt: now.toISO(),
        from: from.toISO(),
        to: to.toISO(),
        emailTypes: EMAIL_JOB_TYPES,
        deliveryStatuses: EMAIL_DELIVERY_STATUSES,
      });
    }
    return NextResponse.json({
      view: 'queue',
      items: [],
      pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: 0 }),
      generatedAt: new Date().toISOString(),
      windowMinutes: params.windowMinutes,
      emailTypes: EMAIL_JOB_TYPES,
    });
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let targetRestaurantId = params.restaurantId;

  if (targetRestaurantId) {
    const allowed = membershipIds.includes(targetRestaurantId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    targetRestaurantId = membershipIds[0] ?? null;
  }

  if (!targetRestaurantId) {
    if (params.view === 'delivery') {
      const { from, to, now } = resolveDeliveryRange({ from: params.from, to: params.to });
      return NextResponse.json({
        view: 'delivery',
        items: [],
        pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: 0 }),
        generatedAt: now.toISO(),
        from: from.toISO(),
        to: to.toISO(),
        emailTypes: EMAIL_JOB_TYPES,
        deliveryStatuses: EMAIL_DELIVERY_STATUSES,
      });
    }
    return NextResponse.json({
      view: 'queue',
      items: [],
      pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: 0 }),
      generatedAt: new Date().toISOString(),
      windowMinutes: params.windowMinutes,
      emailTypes: EMAIL_JOB_TYPES,
    });
  }

  const service = getServiceSupabaseClient();
  const offset = (params.page - 1) * params.pageSize;
  const rangeEnd = offset + params.pageSize - 1;

  if (params.view === 'delivery') {
    const { from, to, now } = resolveDeliveryRange({ from: params.from, to: params.to });

    if (!from.isValid || !to.isValid) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    try {
      let query = service
        .from('email_delivery_log')
        .select(
          'id, booking_id, restaurant_id, email_type, template_type, recipient_email, message_id, status, occurred_at, provider, error, bookings(start_at,status,customer_name), restaurants(name)',
          { count: 'exact' },
        )
        .eq('restaurant_id', targetRestaurantId)
        .gte('occurred_at', from.toISO() ?? '')
        .lte('occurred_at', to.toISO() ?? '')
        .order('occurred_at', { ascending: false })
        .range(offset, rangeEnd);

      if (params.type) {
        query = query.eq('email_type', params.type);
      }

      if (params.status) {
        query = query.eq('status', params.status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[ops/email-status][GET] delivery query failed', error.message);
        return NextResponse.json({ error: 'Unable to fetch delivery log' }, { status: 500 });
      }

      const rows = (data ?? []) as DeliveryRow[];
      const items = rows.map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurants?.name ?? null,
        bookingStatus: row.bookings?.status ?? null,
        startAt: row.bookings?.start_at ?? null,
        customerName: row.bookings?.customer_name ?? null,
        recipientEmail: row.recipient_email,
        emailType: row.email_type ?? null,
        templateType: row.template_type ?? null,
        status: row.status,
        occurredAt: row.occurred_at,
        provider: row.provider ?? null,
        messageId: row.message_id,
        error: row.error ?? null,
      }));

      return NextResponse.json({
        view: 'delivery',
        items,
        pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: count ?? 0 }),
        generatedAt: now.toISO(),
        from: from.toISO(),
        to: to.toISO(),
        emailTypes: EMAIL_JOB_TYPES,
        deliveryStatuses: EMAIL_DELIVERY_STATUSES,
      });
    } catch (error) {
      console.error('[ops/email-status][GET] delivery failure', error);
      return NextResponse.json({ error: 'Unable to fetch delivery log' }, { status: 500 });
    }
  }

  const now = DateTime.utc();
  const fromIso = now.minus({ minutes: params.windowMinutes }).toISO();
  const toIso = now.plus({ minutes: params.windowMinutes }).toISO();

  if (!fromIso || !toIso) {
    return NextResponse.json({ error: 'Unable to build time window' }, { status: 500 });
  }

  try {
    const { data, error, count } = await service
      .from('bookings')
      .select(
        'id, restaurant_id, start_at, end_at, status, customer_name, customer_email, customer_phone, restaurants(name)',
        { count: 'exact' },
      )
      .eq('restaurant_id', targetRestaurantId)
      .in('status', [...ACTIVE_BOOKING_STATUSES])
      .gte('start_at', fromIso)
      .lte('start_at', toIso)
      .order('start_at', { ascending: true })
      .range(offset, rangeEnd);

    if (error) {
      console.error('[ops/email-status][GET] booking query failed', error.message);
      return NextResponse.json({ error: 'Unable to fetch bookings' }, { status: 500 });
    }

    const bookings = (data ?? []) as BookingRow[];
    const emailTypes = params.type ? [params.type] : [...EMAIL_JOB_TYPES];
    const items = await Promise.all(
      bookings.map(async (booking) => {
        const entries = await Promise.all(
          emailTypes.map((type) => resolveEmailEntry({ bookingId: booking.id, type })),
        );

        return {
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          restaurantName: booking.restaurants?.name ?? null,
          startAt: booking.start_at,
          endAt: booking.end_at,
          status: booking.status,
          customerName: booking.customer_name ?? null,
          customerEmail: booking.customer_email ?? null,
          customerPhone: booking.customer_phone ?? null,
          entries,
        };
      }),
    );

    return NextResponse.json({
      view: 'queue',
      items,
      pageInfo: buildPageInfo({ page: params.page, pageSize: params.pageSize, total: count ?? 0 }),
      generatedAt: now.toISO(),
      windowMinutes: params.windowMinutes,
      emailTypes: EMAIL_JOB_TYPES,
    });
  } catch (error) {
    console.error('[ops/email-status][GET] unexpected failure', error);
    return NextResponse.json({ error: 'Unable to fetch email status' }, { status: 500 });
  }
}
