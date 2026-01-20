import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { isRestaurantAdminRole, type RestaurantRole } from '@/lib/owner/auth/roles';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from '@/server/booking';
import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import {
  calculateDurationMinutes,
  deriveEndTime,
  fetchBookingsForContact,
  generateUniqueBookingReference,
  inferMealTypeFromTime,
  logAuditEvent,
  insertBookingRecord,
} from '@/server/bookings';
import {
  PastBookingError,
  assertBookingNotInPast,
  canOverridePastBooking,
} from '@/server/bookings/pastTimeValidation';
import { validateBookingWindow } from '@/server/capacity';
import { normalizeEmail, upsertCustomer } from '@/server/customers';
import { isAutoAssignOnBookingEnabled } from '@/server/feature-flags';
import {
  enqueueBookingCreatedSideEffects,
  safeBookingPayload,
} from '@/server/jobs/booking-side-effects';
import { recordObservabilityEvent } from '@/server/observability';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp, extractClientIp } from '@/server/security/request';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships, requireMembershipForRestaurant } from '@/server/team/access';

import { opsWalkInBookingSchema, type OpsWalkInBookingPayload } from './schema';

import type { BookingType } from '@/lib/enums';
import type { BookingRecord } from '@/server/bookings';
import type { Json, Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const OPS_CHANNEL = 'ops.walkin';
const OPS_WALK_IN_SOURCE = 'walk-in';

type BookingPayload = OpsWalkInBookingPayload;

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

type UnifiedCreateParams = {
  req: NextRequest;
  payload: BookingPayload;
  user: AuthenticatedUser;
  service: ReturnType<typeof getServiceSupabaseClient>;
  normalizedIdempotencyKey: string | null;
  clientRequestId: string;
  userAgent: string | null;
  clientIp: string | null;
  contactEmail: string | null;
};

type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

function extractPostgrestError(error: unknown): PostgrestErrorLike {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
    };
  }
  return {};
}

function buildRequestDetails(params: {
  idempotencyKey: string | null;
  clientRequestId: string;
  userAgent: string | null;
  staffId: string;
  staffEmail: string | null;
  emailProvided: boolean;
  phoneProvided: boolean;
  emailValue: string;
  phoneValue: string;
}): Record<string, unknown> {
  return {
    channel: OPS_CHANNEL,
    request: {
      idempotency_key: params.idempotencyKey,
      client_request_id: params.clientRequestId,
      user_agent: params.userAgent ?? null,
    },
    staff: {
      id: params.staffId,
      email: params.staffEmail,
    },
    created_by: OPS_WALK_IN_SOURCE,
    provided_contact: {
      email: params.emailProvided,
      phone: params.phoneProvided,
      email_value: params.emailValue || null,
      phone_value: params.phoneValue || null,
    },
  } as const;
}

function ensureFallbackContact(
  value: string | null | undefined,
  clientRequestId: string,
  kind: 'email' | 'phone',
): string {
  const trimmed = (value ?? '').trim();
  if (trimmed) {
    return trimmed;
  }

  const slug = clientRequestId.replace(/[^a-z0-9]/gi, '').slice(0, 24) || randomUUID();
  if (kind === 'email') {
    return `walkin+${slug}@system.local`;
  }
  return `000-${slug}`;
}

type RestaurantContactDetails = {
  email: string | null;
  phone: string | null;
};

async function fetchRestaurantContactDetails(
  client: ReturnType<typeof getServiceSupabaseClient>,
  restaurantId: string,
): Promise<RestaurantContactDetails> {
  try {
    const { data, error } = await client
      .from('restaurants')
      .select('contact_email, contact_phone')
      .eq('id', restaurantId)
      .maybeSingle<Pick<Tables<'restaurants'>, 'contact_email' | 'contact_phone'>>();

    if (error) {
      console.error('[ops/bookings] restaurant contact lookup failed', error.message);
      return { email: null, phone: null };
    }

    if (!data) {
      return { email: null, phone: null };
    }

    const email =
      typeof data.contact_email === 'string' && data.contact_email.trim().length > 0
        ? data.contact_email.trim()
        : null;
    const phone =
      typeof data.contact_phone === 'string' && data.contact_phone.trim().length > 0
        ? data.contact_phone.trim()
        : null;

    return { email, phone };
  } catch (error) {
    console.error('[ops/bookings] restaurant contact lookup threw', error);
    return { email: null, phone: null };
  }
}

const OPS_BOOKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'cancelled',
  'completed',
  'no_show',
] as const;

const BOOKING_OVERRIDE_CAPABILITY = 'booking.override';

function resolveActorCapabilities(role: RestaurantRole | null | undefined): string[] {
  if (isRestaurantAdminRole(role)) {
    return [BOOKING_OVERRIDE_CAPABILITY];
  }
  return [];
}

function sanitizeSearchTerm(input: string): string {
  return input.replace(/([\\%_])/g, '\\$1');
}

const opsBookingsQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  status: z.enum(OPS_BOOKING_STATUSES).optional(),
  statuses: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return [] as (typeof OPS_BOOKING_STATUSES)[number][];
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is (typeof OPS_BOOKING_STATUSES)[number] =>
          OPS_BOOKING_STATUSES.includes(entry as (typeof OPS_BOOKING_STATUSES)[number]),
        );
    }),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
  sortBy: z.enum(['start_at', 'created_at']).default('start_at'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  query: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional(),
});

type OpsBookingRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'start_at'
  | 'end_at'
  | 'booking_date'
  | 'start_time'
  | 'end_time'
  | 'party_size'
  | 'status'
  | 'notes'
  | 'restaurant_id'
  | 'customer_name'
  | 'customer_email'
  | 'customer_phone'
  | 'created_at'
> & {
  restaurants?:
    | {
        name: string | null;
        slug?: string | null;
        timezone?: string | null;
        reservation_interval_minutes?: number | null;
      }
    | {
        name: string | null;
        slug?: string | null;
        timezone?: string | null;
        reservation_interval_minutes?: number | null;
      }[]
    | null;
  booking_table_assignments?:
    | Array<{
        table_id: string | null;
        merge_group_id: string | null;
        table_inventory: {
          table_number: string;
          capacity: number | null;
          section: string | null;
        } | null;
      }>
    | null;
};

type BookingDTO = {
  id: string;
  restaurantId: string | null;
  restaurantName: string;
  restaurantSlug: string | null;
  restaurantTimezone: string | null;
  partySize: number;
  startIso: string;
  endIso: string;
  status: OpsBookingRow['status'];
  notes?: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  reservationIntervalMinutes: number | null;
  tableAssignments?: {
    groupId: string | null;
    capacitySum: number | null;
    members: {
      tableId: string;
      tableNumber: string;
      capacity: number | null;
      section: string | null;
    }[];
  }[];
  requiresTableAssignment?: boolean;
};

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

type PageResponse = {
  items: BookingDTO[];
  pageInfo: PageInfo;
};

function toIsoString(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
}

function deriveFallbackIso(
  date: string | null | undefined,
  time: string | null | undefined,
  timezone: string | null | undefined,
): string {
  if (!date || !time) return '';

  const zone = typeof timezone === 'string' && timezone.trim().length > 0 ? timezone : 'UTC';
  const trimmedTime = time.trim();
  if (trimmedTime.length === 0) return '';

  const normalizedTime = trimmedTime.length === 5 ? `${trimmedTime}:00` : trimmedTime;
  const dt = DateTime.fromISO(`${date}T${normalizedTime}`, { zone });
  if (!dt.isValid) {
    return '';
  }

  return dt.toUTC().toISO() ?? '';
}

function mapTableAssignments(row: OpsBookingRow) {
  const rawAssignments = row.booking_table_assignments ?? [];
  const groupedAssignments = new Map<
    string,
    {
      groupId: string | null;
      members: Array<{
        tableId: string;
        tableNumber: string;
        capacity: number | null;
        section: string | null;
      }>;
    }
  >();

  for (const assignment of rawAssignments) {
    const tableId = assignment.table_id ?? '';
    const groupKey = assignment.merge_group_id ?? `single-${tableId}`;
    if (!groupedAssignments.has(groupKey)) {
      groupedAssignments.set(groupKey, {
        groupId: assignment.merge_group_id,
        members: [],
      });
    }
    const group = groupedAssignments.get(groupKey)!;
    const inventory = assignment.table_inventory;
    group.members.push({
      tableId,
      tableNumber: inventory?.table_number ?? '?',
      capacity: inventory?.capacity ?? null,
      section: inventory?.section ?? null,
    });
  }

  return Array.from(groupedAssignments.values()).map((group) => ({
    groupId: group.groupId,
    capacitySum: group.members.reduce((sum, member) => sum + (member.capacity ?? 0), 0),
    members: group.members,
  }));
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/bookings][GET] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const clientIp = extractClientIp(req);
  const listRateResult = await consumeRateLimit({
    identifier: `ops:bookings:get:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!listRateResult.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((listRateResult.resetAt - Date.now()) / 1000));
    void recordObservabilityEvent({
      source: 'api.ops',
      eventType: 'ops_bookings.rate_limited',
      severity: 'warning',
      context: {
        action: 'list',
        staff_id: user.id,
        ip_scope: anonymizeIp(clientIp),
        limit: listRateResult.limit,
        reset_at: new Date(listRateResult.resetAt).toISOString(),
        rate_source: listRateResult.source,
      },
    });

    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter: retryAfterSeconds },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfterSeconds.toString(),
        },
      },
    );
  }

  const rawParams = {
    restaurantId: req.nextUrl.searchParams.get('restaurantId') ?? undefined,
    tableId: req.nextUrl.searchParams.get('tableId') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    statuses: req.nextUrl.searchParams.get('statuses') ?? undefined,
    from: req.nextUrl.searchParams.get('from') ?? undefined,
    to: req.nextUrl.searchParams.get('to') ?? undefined,
    sort: req.nextUrl.searchParams.get('sort') ?? undefined,
    sortBy: req.nextUrl.searchParams.get('sortBy') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    query: req.nextUrl.searchParams.get('query') ?? undefined,
  };

  const parsed = opsBookingsQuerySchema.safeParse(rawParams);
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
    console.error('[ops/bookings][GET] membership lookup failed', error);
    return NextResponse.json({ error: 'Unable to verify memberships' }, { status: 500 });
  }

  if (memberships.length === 0) {
    const empty: PageResponse = {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    targetRestaurantId = membershipIds[0] ?? null;
  }

  if (!targetRestaurantId) {
    const empty: PageResponse = {
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

  const offset = (params.page - 1) * params.pageSize;
  const serviceSupabase = getServiceSupabaseClient();

  let query = serviceSupabase
    .from('bookings')
    .select(
      `id, start_at, end_at, booking_date, start_time, end_time, party_size, status, notes, restaurant_id, customer_name, customer_email, customer_phone, created_at,
      restaurants(name, slug, timezone, reservation_interval_minutes),
      booking_table_assignments(
        table_id,
        merge_group_id,
        table_inventory(
          table_number,
          capacity,
          section
        )
      )`,
      { count: 'exact' },
    )
    .eq('restaurant_id', targetRestaurantId);

  if (params.tableId) {
    query = query.eq('booking_table_assignments.table_id', params.tableId);
  }

  if (params.statuses.length > 0) {
    query = query.in('status', params.statuses);
  } else if (params.status) {
    query = query.eq('status', params.status);
  }

  if (params.from) {
    query = query.gte('start_at', params.from);
  }

  if (params.to) {
    query = query.lt('start_at', params.to);
  }

  const orderColumn = params.sortBy === 'created_at' ? 'created_at' : 'start_at';
  const isCreatedAtSort = orderColumn === 'created_at';
  const sortAscending = isCreatedAtSort ? false : params.sort === 'asc';

  query = query.order(orderColumn, {
    ascending: sortAscending,
    // For created_at DESC, keep nulls at the end instead of surfacing them first
    ...(isCreatedAtSort ? { nullsFirst: false } : {}),
  });

  if (isCreatedAtSort) {
    // Ensure deterministic ordering when creation timestamps tie
    query = query.order('id', { ascending: false });
  }

  if (params.query) {
    const escaped = sanitizeSearchTerm(params.query);
    const pattern = `%${escaped}%`;
    query = query.or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`);
  }

  const { data, error, count } = await query.range(offset, offset + params.pageSize - 1);

  if (error) {
    console.error('[ops/bookings][GET] query failed', error);
    return NextResponse.json({ error: 'Unable to fetch bookings' }, { status: 500 });
  }

  const rows: OpsBookingRow[] = (data ?? []) as OpsBookingRow[];

  const items: BookingDTO[] = rows.map((row) => {
    const restaurantRelation = Array.isArray(row.restaurants)
      ? (row.restaurants[0] ?? null)
      : (row.restaurants ?? null);
    const restaurantTimezone =
      restaurantRelation && typeof restaurantRelation.timezone === 'string'
        ? restaurantRelation.timezone
        : null;
    const startIso =
      toIsoString(row.start_at) ||
      deriveFallbackIso(row.booking_date, row.start_time, restaurantTimezone);
    const endIso =
      toIsoString(row.end_at) ||
      deriveFallbackIso(row.booking_date, row.end_time, restaurantTimezone);

    const rawPhone = typeof row.customer_phone === 'string' ? row.customer_phone.trim() : '';
    const customerPhone = rawPhone.length > 0 ? rawPhone : null;
    const interval =
      restaurantRelation && typeof restaurantRelation.reservation_interval_minutes === 'number'
        ? restaurantRelation.reservation_interval_minutes
        : null;
    const tableAssignments = mapTableAssignments(row);

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: restaurantRelation?.name ?? '',
      restaurantSlug: restaurantRelation?.slug ?? null,
      restaurantTimezone: restaurantRelation?.timezone ?? null,
      partySize: row.party_size,
      startIso,
      endIso,
      status: row.status,
      notes: row.notes ?? null,
      customerName: row.customer_name ?? null,
      customerEmail: row.customer_email ?? null,
      customerPhone,
      reservationIntervalMinutes: interval,
      tableAssignments,
      requiresTableAssignment:
        tableAssignments.length === 0 &&
        row.status !== 'cancelled' &&
        row.status !== 'no_show',
    };
  });

  const total = count ?? items.length;
  const hasNext = offset + items.length < total;

  const response: PageResponse = {
    items,
    pageInfo: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasNext,
    },
  };

  void recordObservabilityEvent({
    source: 'api.ops',
    eventType: 'ops_bookings.list',
    context: {
      staff_id: user.id,
      restaurant_id: params.restaurantId ?? null,
      result_count: items.length,
      rate_source: listRateResult.source,
    },
  });

  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/bookings] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let payload: BookingPayload;
  try {
    const parsed = opsWalkInBookingSchema.parse(await req.json());
    payload = parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const clientIp = extractClientIp(req);
  const createRateResult = await consumeRateLimit({
    identifier: `ops:bookings:create:${user.id}:${payload.restaurantId}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!createRateResult.ok) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((createRateResult.resetAt - Date.now()) / 1000),
    );
    void recordObservabilityEvent({
      source: 'api.ops',
      eventType: 'ops_bookings.rate_limited',
      severity: 'warning',
      context: {
        action: 'create',
        staff_id: user.id,
        restaurant_id: payload.restaurantId,
        ip_scope: anonymizeIp(clientIp),
        limit: createRateResult.limit,
        reset_at: new Date(createRateResult.resetAt).toISOString(),
        rate_source: createRateResult.source,
      },
    });

    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter: retryAfterSeconds },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfterSeconds.toString(),
        },
      },
    );
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: payload.restaurantId });
  } catch (error) {
    console.error('[ops/bookings] membership validation failed', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = getServiceSupabaseClient();
  const restaurantContacts = await fetchRestaurantContactDetails(service, payload.restaurantId);
  const useUnifiedValidation = env.featureFlags.bookingValidationUnified;
  const idempotencyKey = req.headers.get('Idempotency-Key');
  const normalizedIdempotencyKey =
    typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : null;
  const clientRequestId =
    normalizedIdempotencyKey && /^[0-9a-f-]{36}$/i.test(normalizedIdempotencyKey)
      ? normalizedIdempotencyKey
      : randomUUID();
  const userAgent = req.headers.get('user-agent');

  if (useUnifiedValidation) {
    return handleUnifiedWalkInCreate({
      req,
      payload,
      user,
      service,
      normalizedIdempotencyKey,
      clientRequestId,
      userAgent,
      clientIp,
      contactEmail: restaurantContacts.email,
    });
  }

  const schedule = await getRestaurantSchedule(payload.restaurantId, {
    date: payload.date,
    client: service,
  });
  const timezone = schedule.timezone;

  const startTime = payload.time;
  const startDateTime = DateTime.fromISO(`${payload.date}T${startTime}`, {
    zone: timezone ?? undefined,
  });

  if (!startDateTime.isValid) {
    return NextResponse.json({ error: 'Invalid booking time' }, { status: 400 });
  }

  const bookingType =
    payload.bookingType === 'drinks' ? 'drinks' : inferMealTypeFromTime(startTime);
  const validation = validateBookingWindow({
    startISO: startDateTime.toISO(),
    bookingDate: payload.date,
    startTime,
    partySize: payload.party,
    allowAfterHours: false,
    timezone,
  });

  if (!validation.ok) {
    return NextResponse.json(
      { error: 'Booking outside service policy', reasons: validation.reasons },
      { status: 422 },
    );
  }

  const diningEnd = validation.dining
    ? DateTime.fromISO(validation.dining.end).setZone(timezone ?? undefined)
    : null;
  const endTime = diningEnd?.isValid
    ? diningEnd.toFormat('HH:mm')
    : deriveEndTime(startTime, bookingType);

  // Validate booking is not in the past (if feature flag enabled)
  if (env.featureFlags.bookingPastTimeBlocking) {
    const allowPastParam = req.nextUrl.searchParams.get('allow_past');
    const allowOverride = allowPastParam === 'true';

    // Get user's role for the restaurant
    const memberships = await fetchUserMemberships(user.id, service);
    const membership = memberships.find((m) => m.restaurant_id === payload.restaurantId);
    const userRole = membership?.role as RestaurantRole | null;

    try {
      assertBookingNotInPast(schedule.timezone, payload.date, startTime, {
        graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
        allowOverride,
        actorRole: userRole,
      });

      // Log successful override if admin used it
      if (allowOverride && canOverridePastBooking(userRole)) {
        void recordObservabilityEvent({
          source: 'api.ops.bookings',
          eventType: 'booking.past_time.override',
          severity: 'info',
          context: {
            restaurantId: payload.restaurantId,
            endpoint: 'ops.bookings.create',
            actorId: user.id,
            actorEmail: user.email,
            actorRole: userRole,
            timezone: schedule.timezone,
            bookingDate: payload.date,
            bookingTime: startTime,
          },
        });
      }
    } catch (pastTimeError) {
      if (pastTimeError instanceof PastBookingError) {
        // Log blocked attempt
        void recordObservabilityEvent({
          source: 'api.ops.bookings',
          eventType: 'booking.past_time.blocked',
          severity: 'warning',
          context: {
            restaurantId: payload.restaurantId,
            endpoint: 'ops.bookings.create',
            actorId: user.id,
            actorEmail: user.email,
            actorRole: userRole,
            ipScope: anonymizeIp(clientIp),
            overrideAttempted: allowOverride,
            ...pastTimeError.details,
          },
        });

        return NextResponse.json(
          {
            error: pastTimeError.message,
            code: pastTimeError.code,
            details: pastTimeError.details,
          },
          { status: 422 },
        );
      }
      throw pastTimeError;
    }
  }

  const rawCustomerEmail = (payload.email ?? '').trim();
  const rawCustomerPhone = (payload.phone ?? '').trim();
  const emailProvided = rawCustomerEmail.length > 0;
  const phoneProvided = rawCustomerPhone.length > 0;

  const fallbackEmail = ensureFallbackContact(payload.email, clientRequestId, 'email');
  const fallbackPhone = ensureFallbackContact(payload.phone, clientRequestId, 'phone');
  const normalizedRestaurantEmail = restaurantContacts.email
    ? normalizeEmail(restaurantContacts.email)
    : null;
  const resolvedCustomerEmail = emailProvided ? normalizeEmail(rawCustomerEmail) : '';
  const resolvedCustomerPhone = phoneProvided ? rawCustomerPhone : '';

  const customer = await upsertCustomer(service, {
    restaurantId: payload.restaurantId,
    email: fallbackEmail,
    phone: fallbackPhone,
    name: payload.name,
    marketingOptIn: payload.marketingOptIn ?? false,
  });

  if (normalizedIdempotencyKey) {
    const { data: existing, error: existingError } = await service
      .from('bookings')
      .select('*')
      .eq('restaurant_id', payload.restaurantId)
      .eq('idempotency_key', normalizedIdempotencyKey)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('[ops/bookings] idempotency lookup failed', existingError.message);
      return NextResponse.json({ error: 'Unable to verify idempotency' }, { status: 500 });
    }

    if (existing) {
      const bookings = await fetchBookingsForContact(
        service,
        payload.restaurantId,
        fallbackEmail,
        fallbackPhone,
      );
      return NextResponse.json({
        booking: existing,
        bookings,
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId: (existing as BookingRecord).client_request_id,
        duplicate: true,
      });
    }
  }

  let booking: BookingRecord | null = null;
  let reference = '';

  for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
    reference = await generateUniqueBookingReference(service);

    try {
      const details = buildRequestDetails({
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId,
        userAgent,
        staffId: user.id,
        staffEmail: user.email ?? null,
        emailProvided,
        phoneProvided,
        emailValue: emailProvided ? rawCustomerEmail : (normalizedRestaurantEmail ?? ''),
        phoneValue: phoneProvided ? rawCustomerPhone : '',
      });

      booking = await insertBookingRecord(service, {
        restaurant_id: payload.restaurantId,
        customer_id: customer.id,
        booking_date: payload.date,
        start_time: startTime,
        end_time: endTime,
        reference,
        party_size: payload.party,
        booking_type: bookingType,
        seating_preference: payload.seating as BookingRecord['seating_preference'],
        status: 'pending',
        customer_name: payload.name,
        customer_email: resolvedCustomerEmail,
        customer_phone: resolvedCustomerPhone,
        notes: payload.notes ?? null,
        marketing_opt_in: payload.marketingOptIn ?? false,
        source: OPS_WALK_IN_SOURCE,
        client_request_id: clientRequestId,
        idempotency_key: normalizedIdempotencyKey ?? null,
        details: details as Json,
      });
    } catch (error: unknown) {
      const { code, message } = extractPostgrestError(error);
      const isUniqueViolation =
        code === '23505' || (message ? /duplicate key value/i.test(message) : false);

      if (!isUniqueViolation) {
        console.error('[ops/bookings] insert failed', error);
        return NextResponse.json({ error: 'Unable to create booking' }, { status: 500 });
      }

      const constraintMessage = message ?? '';
      const duplicateReference = /bookings_reference/i.test(constraintMessage);
      const idempotencyConflict =
        /bookings_idem_unique_per_restaurant/i.test(constraintMessage) ||
        /bookings_client_request_unique/i.test(constraintMessage);

      if (idempotencyConflict) {
        const { data: existing } = await service
          .from('bookings')
          .select('*')
          .eq('restaurant_id', payload.restaurantId)
          .eq('client_request_id', clientRequestId)
          .maybeSingle();

        if (existing) {
          booking = existing as BookingRecord;
          break;
        }

        return NextResponse.json({ error: 'Duplicate request' }, { status: 409 });
      }

      if (!duplicateReference) {
        console.error('[ops/bookings] insert conflict', error);
        return NextResponse.json({ error: 'Unable to create booking' }, { status: 500 });
      }
    }
  }

  if (!booking) {
    return NextResponse.json({ error: 'Unable to allocate booking reference' }, { status: 500 });
  }

  const bookings = await fetchBookingsForContact(
    service,
    payload.restaurantId,
    fallbackEmail,
    fallbackPhone,
  );

  const responseBody = {
    booking,
    bookings,
    idempotencyKey: normalizedIdempotencyKey,
    clientRequestId,
  };

  // Run auto-assign BEFORE sending emails so the correct email type is sent
  if (isAutoAssignOnBookingEnabled()) {
    const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
    const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;

    try {
      const updatedBooking = await runInlineAutoAssign({
        bookingId: booking.id,
        restaurantId: payload.restaurantId,
        timeoutMs: inlineTimeoutMs,
        createdBy: 'ops-walk-in',
        historyReason: 'ops_walk_in_inline_auto_assign',
        observabilitySource: 'api.ops.bookings.inline_auto_assign',
        client: service,
      });

      // Update booking in response if assignment succeeded
      if (updatedBooking) {
        responseBody.booking = updatedBooking;
      }
    } catch (error) {
      console.error('[ops/bookings] auto-assign inline attempt failed', error);
    }
  }

  // Send emails AFTER auto-assign so status reflects final state (pending vs confirmed)
  await enqueueBookingCreatedSideEffects({
    booking: safeBookingPayload(responseBody.booking),
    idempotencyKey: normalizedIdempotencyKey,
    restaurantId: payload.restaurantId,
    emailProvided,
  });

  // If inline attempt did not confirm and retries are configured, run background job
  // This matches public booking behavior for resilience
  if (isAutoAssignOnBookingEnabled() && responseBody.booking.status !== 'confirmed') {
    try {
      const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
      void autoAssignAndConfirmIfPossible(responseBody.booking.id);
    } catch (autoError) {
      console.error('[ops/bookings] background auto-assign scheduling failed', autoError);
    }
  }

  void recordObservabilityEvent({
    source: 'api.ops',
    eventType: 'ops_bookings.create',
    context: {
      staff_id: user.id,
      restaurant_id: payload.restaurantId,
      booking_id: booking.id,
      rate_source: createRateResult.source,
    },
  });

  return NextResponse.json(responseBody, { status: 201 });
}

async function handleUnifiedWalkInCreate(params: UnifiedCreateParams) {
  const { payload, user, service, normalizedIdempotencyKey, clientRequestId, userAgent, clientIp } =
    params;

  const schedule = await getRestaurantSchedule(payload.restaurantId, {
    date: payload.date,
    client: service,
  });

  const startDateTime = DateTime.fromISO(`${payload.date}T${payload.time}`, {
    zone: schedule.timezone ?? undefined,
  });

  if (!startDateTime.isValid) {
    return NextResponse.json({ error: 'Invalid booking time' }, { status: 400 });
  }

  const bookingType = (
    payload.bookingType === 'drinks' ? 'drinks' : inferMealTypeFromTime(payload.time)
  ) as BookingType;
  const durationMinutes = calculateDurationMinutes(bookingType);

  const rawCustomerEmail = (payload.email ?? '').trim();
  const rawCustomerPhone = (payload.phone ?? '').trim();
  const emailProvided = rawCustomerEmail.length > 0;
  const phoneProvided = rawCustomerPhone.length > 0;

  const fallbackEmail = ensureFallbackContact(payload.email, clientRequestId, 'email');
  const fallbackPhone = ensureFallbackContact(payload.phone, clientRequestId, 'phone');
  const customerEmailForStorage = emailProvided ? normalizeEmail(rawCustomerEmail) : '';
  const customerPhoneForStorage = phoneProvided ? rawCustomerPhone : '';

  const customer = await upsertCustomer(service, {
    restaurantId: payload.restaurantId,
    email: fallbackEmail,
    phone: fallbackPhone,
    name: payload.name,
    marketingOptIn: payload.marketingOptIn ?? false,
  });

  const memberships = await fetchUserMemberships(user.id, service);
  const membership =
    memberships.find((entry) => entry.restaurant_id === payload.restaurantId) ?? null;
  const userRole = (membership?.role as RestaurantRole | undefined) ?? null;
  const actorCapabilities = resolveActorCapabilities(userRole);
  const actorRoles = userRole ? [userRole] : ['staff'];

  const overrideReason = payload.override?.reason?.trim() ?? null;
  const overrideRequest = payload.override?.apply
    ? { apply: true, reason: overrideReason }
    : undefined;

  const validationService = createBookingValidationService({ client: service });

  const startIso = startDateTime.toISO();
  if (!startIso) {
    return NextResponse.json({ error: 'Unable to normalise booking start time' }, { status: 400 });
  }

  const bookingInput: BookingInput = {
    restaurantId: payload.restaurantId,
    serviceId: payload.bookingType,
    bookingType,
    partySize: payload.party,
    start: startIso,
    durationMinutes,
    seatingPreference: payload.seating,
    notes: payload.notes ?? null,
    customerId: customer.id,
    customerName: payload.name,
    customerEmail: customerEmailForStorage,
    customerPhone: customerPhoneForStorage,
    marketingOptIn: payload.marketingOptIn ?? false,
    source: OPS_WALK_IN_SOURCE,
    idempotencyKey: normalizedIdempotencyKey ?? null,
    override: overrideRequest,
  };

  const context: ValidationContext = {
    actorId: user.id,
    actorRoles,
    actorCapabilities,
    tz: schedule.timezone,
    flags: {
      bookingPastTimeBlocking: env.featureFlags.bookingPastTimeBlocking ?? false,
      bookingPastTimeGraceMinutes: env.featureFlags.bookingPastTimeGraceMinutes ?? 5,
      unified: true,
    },
    metadata: {
      clientRequestId,
      userAgent,
    },
  };

  try {
    const commit = await validationService.createWithEnforcement(bookingInput, context);
    let booking = commit.booking as BookingRecord;
    const reusedExisting = commit.duplicate === true;
    const validationResponse = commit.response;

    const bookings = await fetchBookingsForContact(
      service,
      payload.restaurantId,
      fallbackEmail,
      fallbackPhone,
    );

    // Run auto-assign BEFORE sending emails (if enabled and not a duplicate)
    if (!reusedExisting && isAutoAssignOnBookingEnabled()) {
      const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
      const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;

      try {
        const updatedBooking = await runInlineAutoAssign({
          bookingId: booking.id,
          restaurantId: payload.restaurantId,
          timeoutMs: inlineTimeoutMs,
          createdBy: 'ops-walk-in',
          historyReason: 'ops_walk_in_inline_auto_assign',
          observabilitySource: 'api.ops.bookings.inline_auto_assign',
          client: service,
        });

        // Update booking variable if assignment succeeded
        if (updatedBooking) {
          booking = updatedBooking;
        }
      } catch (error) {
        console.error('[ops/bookings] auto-assign inline attempt failed', error);
      }
    }

    // Send emails AFTER auto-assign so the correct email (confirmation vs request) is sent
    if (!reusedExisting) {
      await enqueueBookingCreatedSideEffects({
        booking: safeBookingPayload(booking),
        idempotencyKey: normalizedIdempotencyKey,
        restaurantId: payload.restaurantId,
        emailProvided,
      });

      // If inline attempt did not confirm and retries are configured, run background job
      // This matches public booking behavior for resilience
      if (isAutoAssignOnBookingEnabled() && booking.status !== 'confirmed') {
        try {
          const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
          void autoAssignAndConfirmIfPossible(booking.id);
        } catch (autoError) {
          console.error('[ops/bookings] background auto-assign scheduling failed', autoError);
        }
      }
    }

    if (validationResponse.overridden) {
      const overrideAuditMetadata: Json = {
        override_reason: overrideReason,
        override_codes: validationResponse.overrideCodes ?? [],
        actor_role: userRole,
        source: OPS_CHANNEL,
        client_request_id: clientRequestId,
      };

      await logAuditEvent(service, {
        action: 'booking.override.applied',
        entity: 'booking',
        entityId: booking.id,
        metadata: overrideAuditMetadata,
        actor: user.email ?? user.id,
      });

      void recordObservabilityEvent({
        source: 'api.ops.bookings',
        eventType: 'booking.override.applied',
        severity: 'info',
        context: {
          bookingId: booking.id,
          restaurantId: payload.restaurantId,
          actorId: user.id,
          actorEmail: user.email,
          actorRole: userRole,
          codes: validationResponse.overrideCodes ?? [],
          reason: overrideReason,
        },
      });
    }

    void recordObservabilityEvent({
      source: 'api.ops',
      eventType: 'ops_bookings.create',
      context: {
        staff_id: user.id,
        restaurant_id: payload.restaurantId,
        booking_id: booking.id,
        override_applied: validationResponse.overridden ?? false,
      },
    });

    return NextResponse.json(
      {
        booking,
        bookings,
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId,
        duplicate: reusedExisting,
        validation: validationResponse,
      },
      withValidationHeaders({ status: reusedExisting ? 200 : 201 }),
    );
  } catch (error) {
    if (error instanceof BookingValidationError) {
      void recordObservabilityEvent({
        source: 'api.ops.bookings',
        eventType: 'booking.validation_failed',
        severity: 'warning',
        context: {
          restaurantId: payload.restaurantId,
          actorId: user.id,
          actorEmail: user.email,
          overrideAttempted: payload.override?.apply ?? false,
          issues: error.response.issues.map((issue) => issue.code),
          ipScope: clientIp ? anonymizeIp(clientIp) : undefined,
        },
      });

      const mapped = mapValidationFailure(error.response);
      return NextResponse.json(mapped.body, withValidationHeaders({ status: mapped.status }));
    }

    console.error('[ops/bookings][POST][unified] unexpected', error);
    return NextResponse.json({ error: 'Unable to create booking' }, { status: 500 });
  }
}
