import { createHash, randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';
import { z } from 'zod';


import { isRestaurantAdminRole, type RestaurantRole } from '@/lib/owner/auth/roles';
import { captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from '@/server/booking';
import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import { persistBookingWhatsAppConsent } from '@/server/booking/whatsapp-consent';
import {
  deriveEndTimeFromDuration,
  fetchBookingsForContact,
  inferMealTypeFromTime,
  logAuditEvent,
} from '@/server/bookings';
import { scheduleBookingCreateAutoAssignRetry } from '@/server/bookings/auto-assign-domain';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import { normalizeEmail, upsertCustomer } from '@/server/customers';
import {
  enqueueBookingCreatedSideEffects,
  safeBookingPayload,
} from '@/server/jobs/booking-side-effects';
import { recordObservabilityEvent } from '@/server/observability';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';
import {
  getBookingPastTimeGraceMinutes,
  getInlineAutoAssignTimeoutMs,
  isAutoAssignOnBookingEnabled,
  isBookingPastTimeBlockingEnabled,
} from '@/server/runtime-policy';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp, extractClientIp } from '@/server/security/request';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { fetchUserMemberships, requireMembershipForRestaurant } from '@/server/team/access';
import { CUSTOMER_PHONE_LENGTH_MAX, CUSTOMER_PHONE_LENGTH_MIN } from '@reserve/shared/validation';

import { createOpsBookingApiTiming } from './_shared/performance';
import { opsWalkInBookingSchema, type OpsWalkInBookingPayload } from './schema';

import type { BookingType } from '@/lib/enums';
import type { BookingRecord } from '@/server/bookings';
import type { Json, Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const OPS_CHANNEL = 'ops.walkin';
const OPS_WALK_IN_SOURCE = 'walk-in';
const FALLBACK_PHONE_PREFIX = '000';
const FALLBACK_PHONE_DIGIT_COUNT = CUSTOMER_PHONE_LENGTH_MAX - FALLBACK_PHONE_PREFIX.length;

type BookingPayload = OpsWalkInBookingPayload;

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

type UnifiedCreateParams = {
  payload: BookingPayload;
  user: AuthenticatedUser;
  service: ReturnType<typeof getServiceSupabaseClient>;
  normalizedIdempotencyKey: string | null;
  clientRequestId: string;
  userAgent: string | null;
  clientIp: string | null;
};

async function recoverOpsBookingRecord(
  client: ReturnType<typeof getServiceSupabaseClient>,
  args: {
    restaurantId: string;
    idempotencyKey: string | null;
    customerId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
  },
): Promise<BookingRecord | null> {
  if (args.idempotencyKey) {
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('restaurant_id', args.restaurantId)
      .eq('idempotency_key', args.idempotencyKey)
      .maybeSingle();

    if (!error && data) {
      return data as BookingRecord;
    }
  }

  const { data, error } = await client
    .from('bookings')
    .select('*')
    .eq('restaurant_id', args.restaurantId)
    .eq('customer_id', args.customerId)
    .eq('booking_date', args.bookingDate)
    .eq('start_time', args.startTime)
    .eq('end_time', args.endTime)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return data as BookingRecord;
  }

  return null;
}

function digitizeHash(seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex');
  return digest.replace(/[a-f]/g, (char) => String((char.charCodeAt(0) - 87) % 10));
}

function assertCustomerPhoneLength(phone: string): void {
  const length = phone.length;
  if (length < CUSTOMER_PHONE_LENGTH_MIN || length > CUSTOMER_PHONE_LENGTH_MAX) {
    throw new Error(
      `[ops/bookings] Phone must be between ${CUSTOMER_PHONE_LENGTH_MIN} and ${CUSTOMER_PHONE_LENGTH_MAX} characters.`,
    );
  }
}

function buildConstraintSafeFallbackPhone(clientRequestId: string): string {
  const seed = clientRequestId.trim() || randomUUID();
  const requestDigits = seed.replace(/\D/g, '');
  const hashDigits = digitizeHash(seed);
  const combinedDigits = `${requestDigits}${hashDigits}`;
  const fallbackDigits = combinedDigits
    .slice(0, FALLBACK_PHONE_DIGIT_COUNT)
    .padEnd(FALLBACK_PHONE_DIGIT_COUNT, '0');
  const fallbackPhone = `${FALLBACK_PHONE_PREFIX}${fallbackDigits}`;
  assertCustomerPhoneLength(fallbackPhone);
  return fallbackPhone;
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
  return buildConstraintSafeFallbackPhone(clientRequestId);
}

const OPS_BOOKING_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'PRIORITY_WAITLIST',
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
  countStrategy: z.enum(['exact', 'window']).default('exact'),
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
  booking_table_assignments?: Array<{
    table_id: string | null;
    merge_group_id: string | null;
    table_inventory: {
      table_number: string;
      capacity: number | null;
      section: string | null;
    } | null;
  }> | null;
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
  const timing = createOpsBookingApiTiming('ops.bookings.list');
  const supabase = await timing.measure('route_client', getRouteHandlerSupabaseClient());
  const {
    data: { user },
    error: authError,
  } = await timing.measure('auth_get_user', supabase.auth.getUser());

  if (authError) {
    console.error('[ops/bookings][GET] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return timing.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  if (!user) {
    return timing.json({ error: 'Authentication required' }, { status: 401 });
  }

  const clientIp = extractClientIp(req);
  // The rate-limit check and the membership lookup both key on user.id only and
  // are independent; running them concurrently removes a full sequential round
  // trip (rate_limit alone was p50 ~415ms in production timing marks). The 429
  // path returns before the membership result is ever used.
  const membershipsPromise = timing.measure('memberships', fetchUserMemberships(user.id, supabase));
  void membershipsPromise.catch(() => undefined);
  const listRateResult = await timing.measure(
    'rate_limit',
    consumeRateLimit({
      identifier: `ops:bookings:get:${user.id}`,
      limit: 120,
      windowMs: 60_000,
    }),
  );

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

    return timing.json(
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
    countStrategy: req.nextUrl.searchParams.get('countStrategy') ?? undefined,
    page: req.nextUrl.searchParams.get('page') ?? undefined,
    pageSize: req.nextUrl.searchParams.get('pageSize') ?? undefined,
    query: req.nextUrl.searchParams.get('query') ?? undefined,
  };

  const parsed = opsBookingsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return timing.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    memberships = await membershipsPromise;
  } catch (error) {
    console.error('[ops/bookings][GET] membership lookup failed', error);
    captureServerException(error, {
      distinctId: user.id,
      properties: { source: 'ops', kind: 'ops-bookings' },
    });
    return timing.json({ error: 'Unable to verify memberships' }, { status: 500 });
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
    return timing.json(empty, undefined, { result_count: 0, membership_count: 0 });
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let targetRestaurantId = params.restaurantId;

  if (targetRestaurantId) {
    const allowed = membershipIds.includes(targetRestaurantId);
    if (!allowed) {
      return timing.json({ error: 'Forbidden' }, { status: 403 });
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
    return timing.json(empty, undefined, {
      result_count: 0,
      membership_count: memberships.length,
    });
  }

  const offset = (params.page - 1) * params.pageSize;
  const isWindowCount = params.countStrategy === 'window';
  const rangeEnd = isWindowCount ? offset + params.pageSize : offset + params.pageSize - 1;
  const serviceSupabase = getServiceSupabaseClient();
  const assignmentsRelation = params.tableId
    ? 'booking_table_assignments!inner'
    : 'booking_table_assignments';

  let query = serviceSupabase
    .from('bookings')
    .select(
      `id, start_at, end_at, booking_date, start_time, end_time, party_size, status, notes, restaurant_id, customer_name, customer_email, customer_phone, created_at,
      restaurants(name, slug, timezone, reservation_interval_minutes),
      ${assignmentsRelation}(
        table_id,
        merge_group_id,
        table_inventory(
          table_number,
          capacity,
          section
        )
      )`,
      { count: isWindowCount ? undefined : 'exact' },
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

  const { data, error, count } = await timing.measure(
    'bookings_query',
    query.range(offset, rangeEnd),
  );

  if (error) {
    console.error('[ops/bookings][GET] query failed', error);
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: targetRestaurantId },
      properties: { restaurantId: targetRestaurantId, source: 'ops', kind: 'ops-bookings' },
    });
    return timing.json({ error: 'Unable to fetch bookings' }, { status: 500 });
  }

  const fetchedRows: OpsBookingRow[] = (data ?? []) as OpsBookingRow[];
  const hasWindowNext = isWindowCount && fetchedRows.length > params.pageSize;
  const rows = isWindowCount ? fetchedRows.slice(0, params.pageSize) : fetchedRows;

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
        tableAssignments.length === 0 && row.status !== 'cancelled' && row.status !== 'no_show',
    };
  });

  const total = isWindowCount
    ? offset + items.length + (hasWindowNext ? 1 : 0)
    : (count ?? items.length);
  const hasNext = isWindowCount ? hasWindowNext : offset + items.length < total;

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

  return timing.json(response, undefined, {
    restaurant_id: targetRestaurantId,
    result_count: items.length,
    total,
    has_next: hasNext,
    count_strategy: params.countStrategy,
    membership_count: memberships.length,
  });
}

export async function POST(req: NextRequest) {
  return withCsrfProtectedMutation(req, () => postOpsBooking(req));
}

async function postOpsBooking(req: NextRequest) {
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

  return handleUnifiedWalkInCreate({
    payload,
    user,
    service,
    normalizedIdempotencyKey,
    clientRequestId,
    userAgent,
    clientIp,
  });
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

  const bookingType = (payload.bookingType ?? inferMealTypeFromTime(payload.time)) as BookingType;
  const turnBandsByOption = await getRestaurantTurnBands(payload.restaurantId, service);
  const { durationMinutes } = await resolveBookingDurationMinutes({
    restaurantId: payload.restaurantId,
    bookingDate: payload.date,
    startTime: payload.time,
    partySize: payload.party,
    bookingOption: bookingType,
    timezone: schedule.timezone ?? null,
    client: service,
    turnBandsByOption,
  });

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
    identityMatchMode: 'partial',
    allowExistingUpdates: true,
  });

  const recoveredExisting = await recoverOpsBookingRecord(service, {
    restaurantId: payload.restaurantId,
    idempotencyKey: normalizedIdempotencyKey,
    customerId: customer.id,
    bookingDate: payload.date,
    startTime: payload.time,
    endTime: deriveEndTimeFromDuration(payload.time, durationMinutes),
  });

  if (recoveredExisting) {
    const recoveredBooking =
      payload.whatsappOptIn && !recoveredExisting.whatsapp_opt_in
        ? await persistBookingWhatsAppConsent({
            actorId: user.id,
            booking: recoveredExisting,
            client: service,
            optedIn: true,
            restaurantId: payload.restaurantId,
            source: 'ops_staff',
          })
        : recoveredExisting;
    const bookings = await fetchBookingsForContact(
      service,
      payload.restaurantId,
      fallbackEmail,
      fallbackPhone,
    );
    return NextResponse.json(
      {
        booking: recoveredBooking,
        bookings,
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId: recoveredBooking.client_request_id,
        duplicate: true,
      },
      withValidationHeaders({ status: 200 }),
    );
  }

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
      bookingPastTimeBlocking: isBookingPastTimeBlockingEnabled(),
      bookingPastTimeGraceMinutes: getBookingPastTimeGraceMinutes(),
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

    if (payload.whatsappOptIn && !booking.whatsapp_opt_in) {
      booking = await persistBookingWhatsAppConsent({
        actorId: user.id,
        booking,
        client: service,
        optedIn: payload.whatsappOptIn,
        restaurantId: payload.restaurantId,
        source: 'ops_staff',
      });
    }

    const bookings = await fetchBookingsForContact(
      service,
      payload.restaurantId,
      fallbackEmail,
      fallbackPhone,
    );

    // Run auto-assign BEFORE sending emails (if enabled and not a duplicate)
    if (!reusedExisting && isAutoAssignOnBookingEnabled()) {
      const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
      const inlineTimeoutMs = getInlineAutoAssignTimeoutMs();

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

      try {
        await scheduleBookingCreateAutoAssignRetry({
          autoAssignEnabled: isAutoAssignOnBookingEnabled(),
          bookingId: booking.id,
          bookingStatus: booking.status,
        });
      } catch (autoError) {
        console.error('[ops/bookings] background auto-assign scheduling failed', autoError);
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
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: payload.restaurantId },
      properties: { restaurantId: payload.restaurantId, source: 'ops', kind: 'ops-bookings' },
    });
    return NextResponse.json({ error: 'Unable to create booking' }, { status: 500 });
  }
}
