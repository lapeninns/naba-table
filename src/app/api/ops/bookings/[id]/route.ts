import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { isRestaurantAdminRole, type RestaurantRole } from '@/lib/owner/auth/roles';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from '@/server/booking';
import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import {
  buildBookingAuditSnapshot,
  inferMealTypeFromTime,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from '@/server/bookings';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import {
  buildBookingInstantFieldsFromLocalTimes,
  type BookingInstantFields,
} from '@/server/bookings/instant-fields';
import { beginBookingModificationFlow } from '@/server/bookings/modification-flow';
import {
  PastBookingError,
  assertBookingNotInPast,
  canOverridePastBooking,
} from '@/server/bookings/pastTimeValidation';
import {
  convertIsoToVenueDateTime,
  convertOptionalIsoToVenueDateTime,
} from '@/server/bookings/timezoneConversion';
import { mapDbErrorToConstraint, isRetryableConstraintError } from '@/server/db-errors';
import {
  enqueueBookingCancelledSideEffects,
  enqueueBookingUpdatedSideEffects,
  safeBookingPayload,
} from '@/server/jobs/booking-side-effects';
import { recordObservabilityEvent } from '@/server/observability';
import { invalidateOpsDashboardCaches } from '@/server/ops/bookings';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';
import {
  getBookingPastTimeGraceMinutes,
  isBookingPastTimeBlockingEnabled,
  isDbStrictConstraintMappingEnabled,
  isUnifiedBookingValidationEnabled,
} from '@/server/runtime-policy';
import {
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
  getTenantServiceSupabaseClient,
} from '@/server/supabase';
import { fetchUserMemberships } from '@/server/team/access';

import { loadBookingDetailPayload } from './_shared/dialogLoaders';
import { createOpsBookingApiTiming } from '../_shared/performance';

import type { BookingRecord } from '@/server/bookings';
import type { Json, Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const overrideSchema = z
  .object({
    apply: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(500, { message: 'Override reason must be 500 characters or fewer.' })
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.apply) {
      const reason = value.reason?.trim() ?? '';
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Override reason must be at least 3 characters when applying override.',
        });
      }
    }
  });

const dashboardUpdateSchema = z.object({
  // Accept both Z and explicit offsets (+00:00) to match guest edit payload handling.
  startIso: z.string().datetime({ offset: true }),
  endIso: z.string().datetime({ offset: true }).optional(),
  partySize: z.coerce.number().int().min(1),
  notes: z.string().max(500).optional().nullable(),
  override: overrideSchema.optional(),
});

type DashboardUpdatePayload = z.infer<typeof dashboardUpdateSchema>;

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

type UnifiedOpsUpdateParams = {
  bookingId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  instantFields: BookingInstantFields;
  durationMinutes: number;
  payload: DashboardUpdatePayload;
  existingBooking: Tables<'bookings'> & {
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
  };
  user: AuthenticatedUser;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
  memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  timezone: string;
  timing: ReturnType<typeof createOpsBookingApiTiming>;
};

const BOOKING_OVERRIDE_CAPABILITY = 'booking.override';

function resolveActorCapabilities(role: RestaurantRole | null | undefined): string[] {
  if (isRestaurantAdminRole(role)) {
    return [BOOKING_OVERRIDE_CAPABILITY];
  }
  return [];
}

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

function resolveBookingId(
  paramsPromise: Promise<{ id: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return Promise.resolve(null);

  return paramsPromise.then((params) => {
    const { id } = params;
    if (typeof id === 'string') return id;
    if (Array.isArray(id)) return id[0] ?? null;
    return null;
  });
}

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

async function loadAuthorizedRestaurantIds(
  userId: string,
  client: Awaited<ReturnType<typeof getRouteHandlerSupabaseClient>>,
) {
  const memberships = await fetchUserMemberships(userId, client);
  return memberships
    .map((membership) => membership.restaurant_id)
    .filter(
      (restaurantId): restaurantId is string =>
        typeof restaurantId === 'string' && restaurantId.length > 0,
    );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error('[ops/bookings][GET] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = user.id;

  let authorizedRestaurantIds: string[];
  try {
    authorizedRestaurantIds = await loadAuthorizedRestaurantIds(userId, tenantSupabase);
  } catch (membershipError) {
    console.error('[ops/bookings][GET] failed to load memberships', membershipError);
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
  }

  if (authorizedRestaurantIds.length === 0) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  let detailResult: Awaited<ReturnType<typeof loadBookingDetailPayload>> | null = null;
  for (const restaurantId of authorizedRestaurantIds) {
    const candidate = await loadBookingDetailPayload({
      serviceSupabase,
      bookingId,
      restaurantIdFilter: restaurantId,
    });
    if (candidate.ok || candidate.status === 500) {
      detailResult = candidate;
      break;
    }
  }

  detailResult ??= { ok: false, status: 404, error: 'Booking not found' };

  if (!detailResult.ok) {
    if (detailResult.status === 500) {
      return NextResponse.json({ error: detailResult.error }, { status: 500 });
    }
    return NextResponse.json({ error: detailResult.error }, { status: detailResult.status });
  }

  return NextResponse.json(detailResult.payload, {
    headers: {
      // Personalized data; keep CDN out but allow browser back/forward cache.
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const timing = createOpsBookingApiTiming('ops.bookings.patch');
  const bookingId = await timing.measure('params', resolveBookingId(params));

  if (!bookingId) {
    return timing.json({ error: 'Missing booking id' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await timing.measure('parse_body', req.json());
  } catch {
    return timing.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = dashboardUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return timing.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tenantSupabase = await timing.measure('route_client', getRouteHandlerSupabaseClient());
  const {
    data: { user },
    error: authError,
  } = await timing.measure('auth_get_user', tenantSupabase.auth.getUser());

  if (authError) {
    console.error('[ops/bookings][PATCH] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return timing.json({ error: mapped.message, code: mapped.code }, { status: mapped.status });
  }

  if (!user) {
    return timing.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    // Fetched once as full rows: the unified update and the legacy past-time
    // check below reuse them instead of re-querying memberships per stage.
    memberships = await timing.measure('memberships', fetchUserMemberships(user.id, tenantSupabase));
  } catch (membershipError) {
    console.error('[ops/bookings][PATCH] failed to load memberships', membershipError);
    return timing.json({ error: 'Unable to verify access' }, { status: 500 });
  }

  const authorizedRestaurantIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter(
      (restaurantId): restaurantId is string =>
        typeof restaurantId === 'string' && restaurantId.length > 0,
    );

  if (authorizedRestaurantIds.length === 0) {
    return timing.json({ error: 'Booking not found' }, { status: 404 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await timing.measure(
    'booking_lookup',
    serviceSupabase
      .from('bookings')
      .select('*, restaurants(name, slug, timezone, reservation_interval_minutes)')
      .eq('id', bookingId)
      .in('restaurant_id', authorizedRestaurantIds)
      .maybeSingle(),
  );

  if (error) {
    console.error('[ops/bookings][PATCH] failed to load booking', error);
    return timing.json({ error: 'Unable to load booking' }, { status: 500 });
  }

  const existingBooking = existing as
    | (Tables<'bookings'> & {
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
      })
    | null;

  if (!existingBooking) {
    return timing.json({ error: 'Booking not found' }, { status: 404 });
  }

  const restaurantRelation = Array.isArray(existingBooking.restaurants)
    ? (existingBooking.restaurants[0] ?? null)
    : (existingBooking.restaurants ?? null);
  const restaurantTimezone =
    typeof restaurantRelation?.timezone === 'string' &&
    restaurantRelation.timezone.trim().length > 0
      ? restaurantRelation.timezone.trim()
      : 'Europe/London';

  let startVenue;
  try {
    startVenue = convertIsoToVenueDateTime(parsed.data.startIso, restaurantTimezone);
  } catch {
    return timing.json({ error: 'Invalid date values' }, { status: 400 });
  }

  const startDate = startVenue.dateTime.toUTC().toJSDate();
  const restaurantId = existingBooking.restaurant_id ?? '';

  captureRestaurantServerEvent('booking_modify_started', {
    restaurantId: restaurantId || undefined,
    distinctId: user.id,
    props: { bookingId, source: 'ops', method: 'ops' },
  });

  const explicitEndIso = typeof parsed.data.endIso === 'string' ? parsed.data.endIso : null;
  let explicitEndVenue = convertOptionalIsoToVenueDateTime(explicitEndIso, restaurantTimezone);
  let existingStartVenue = convertOptionalIsoToVenueDateTime(
    existingBooking.start_at,
    restaurantTimezone,
  );
  let existingEndVenue = convertOptionalIsoToVenueDateTime(
    existingBooking.end_at,
    restaurantTimezone,
  );

  let bookingDate = startVenue.date;
  let startTime = startVenue.time;
  let existingDurationMinutes =
    existingStartVenue && existingEndVenue
      ? Math.max(
          1,
          Math.round(
            existingEndVenue.dateTime.diff(existingStartVenue.dateTime, 'minutes').minutes ?? 0,
          ),
        )
      : null;

  // Determine whether we need schedule data.
  // Time changes should respect restaurant-configured duration, and past-time checks may require schedule info.
  let isTimeChanged =
    bookingDate !== existingBooking.booking_date || startTime !== existingBooking.start_time;

  const needsScheduleForDuration = isTimeChanged || !explicitEndIso;
  const needsScheduleForPastCheck = isBookingPastTimeBlockingEnabled() && isTimeChanged;

  // Turn bands are independent of the schedule; start both together instead of
  // fetching them back-to-back.
  const turnBandsPromise = needsScheduleForDuration
    ? timing.measure('turn_bands', getRestaurantTurnBands(restaurantId, serviceSupabase))
    : Promise.resolve(null);
  void turnBandsPromise.catch(() => undefined);

  let schedule: Awaited<ReturnType<typeof getRestaurantSchedule>> | null = null;
  if (needsScheduleForDuration || needsScheduleForPastCheck) {
    schedule = await timing.measure(
      'schedule',
      getRestaurantSchedule(restaurantId, {
        date: bookingDate,
        client: serviceSupabase,
      }),
    );
  }

  const scheduleTimezone =
    typeof schedule?.timezone === 'string' && schedule.timezone.trim().length > 0
      ? schedule.timezone.trim()
      : restaurantTimezone;

  if (scheduleTimezone !== restaurantTimezone) {
    try {
      startVenue = convertIsoToVenueDateTime(parsed.data.startIso, scheduleTimezone);
      explicitEndVenue = convertOptionalIsoToVenueDateTime(explicitEndIso, scheduleTimezone);
      existingStartVenue = convertOptionalIsoToVenueDateTime(
        existingBooking.start_at,
        scheduleTimezone,
      );
      existingEndVenue = convertOptionalIsoToVenueDateTime(
        existingBooking.end_at,
        scheduleTimezone,
      );
    } catch {
      return timing.json({ error: 'Invalid date values' }, { status: 400 });
    }

    bookingDate = startVenue.date;
    startTime = startVenue.time;
    existingDurationMinutes =
      existingStartVenue && existingEndVenue
        ? Math.max(
            1,
            Math.round(
              existingEndVenue.dateTime.diff(existingStartVenue.dateTime, 'minutes').minutes ?? 0,
            ),
          )
        : null;
    isTimeChanged =
      bookingDate !== existingBooking.booking_date || startTime !== existingBooking.start_time;

    if (
      schedule &&
      (needsScheduleForDuration || needsScheduleForPastCheck) &&
      schedule.date !== bookingDate
    ) {
      schedule = await timing.measure(
        'schedule_rebased',
        getRestaurantSchedule(restaurantId, {
          date: bookingDate,
          client: serviceSupabase,
        }),
      );
    }
  }

  const bookingOption =
    typeof existingBooking.booking_type === 'string' &&
    existingBooking.booking_type.trim().length > 0
      ? existingBooking.booking_type
      : inferMealTypeFromTime(startTime);
  const turnBandsByOption = await turnBandsPromise;
  const computedDuration = needsScheduleForDuration
    ? (
        await timing.measure(
          'duration',
          resolveBookingDurationMinutes({
            restaurantId,
            bookingDate,
            startTime,
            partySize: parsed.data.partySize,
            bookingOption,
            timezone: schedule?.timezone ?? null,
            client: serviceSupabase,
            turnBandsByOption: turnBandsByOption ?? undefined,
          }),
        )
      ).durationMinutes
    : null;
  const fallbackDuration =
    existingDurationMinutes && existingDurationMinutes > 0
      ? existingDurationMinutes
      : computedDuration && computedDuration > 0
        ? computedDuration
        : (env.reserve.defaultDurationMinutes ?? 90);

  let durationMinutes: number;
  let endDate: Date;
  let endTime: string;

  if (isTimeChanged) {
    durationMinutes =
      computedDuration && computedDuration > 0 ? computedDuration : fallbackDuration;
    endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    endTime = startVenue.dateTime.plus({ minutes: durationMinutes }).toFormat('HH:mm');
  } else if (explicitEndVenue) {
    endDate = explicitEndVenue.dateTime.toUTC().toJSDate();
    durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    endTime = explicitEndVenue.time;
  } else if (existingEndVenue) {
    endDate = existingEndVenue.dateTime.toUTC().toJSDate();
    durationMinutes = fallbackDuration > 0 ? fallbackDuration : 90;
    endTime = existingEndVenue.time;
  } else {
    durationMinutes =
      computedDuration && computedDuration > 0 ? computedDuration : fallbackDuration;
    endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    endTime = startVenue.dateTime.plus({ minutes: durationMinutes }).toFormat('HH:mm');
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return timing.json({ error: 'End time must be after start time' }, { status: 400 });
  }

  const requiresTableRealignment =
    bookingDate !== (existingBooking.booking_date ?? '') ||
    startTime !== (existingBooking.start_time ?? '') ||
    endTime !== (existingBooking.end_time ?? '') ||
    parsed.data.partySize !== (existingBooking.party_size ?? 0);
  const normalizedNotes = parsed.data.notes ?? null;
  const instantFields = buildBookingInstantFieldsFromLocalTimes({
    bookingDate,
    startTime,
    endTime,
    timezone: scheduleTimezone,
  });

  const useUnifiedValidation = isUnifiedBookingValidationEnabled();

  if (useUnifiedValidation) {
    const userForContext: AuthenticatedUser = { id: user.id, email: user.email ?? null };
    return timing.withHeaders(
      await handleUnifiedOpsUpdate({
        bookingId,
        bookingDate,
        startTime,
        endTime,
        instantFields,
        durationMinutes,
        payload: parsed.data,
        existingBooking,
        user: userForContext,
        serviceSupabase,
        memberships,
        timezone: scheduleTimezone,
        timing,
      }),
      { path: 'unified' },
    );
  }

  // Validate past time if feature enabled and time is changing
  if (isTimeChanged && isBookingPastTimeBlockingEnabled()) {
    const allowPastParam = req.nextUrl.searchParams.get('allow_past');
    const allowOverride = allowPastParam === 'true';

    // Get user's role for the restaurant (memberships already loaded above).
    const membership = memberships.find((m) => m.restaurant_id === existingBooking.restaurant_id);
    const userRole = membership?.role as RestaurantRole | null;

    try {
      const scheduleForPast =
        schedule ??
        (await timing.measure(
          'past_check_schedule',
          getRestaurantSchedule(existingBooking.restaurant_id ?? '', {
            date: bookingDate,
            client: serviceSupabase,
          }),
        ));

      assertBookingNotInPast(scheduleForPast.timezone, bookingDate, startTime, {
        graceMinutes: getBookingPastTimeGraceMinutes(),
        allowOverride,
        actorRole: userRole,
      });

      // Log successful override if admin used it
      if (allowOverride && canOverridePastBooking(userRole)) {
        void import('@/server/observability').then(({ recordObservabilityEvent }) => {
          void recordObservabilityEvent({
            source: 'api.ops.bookings',
            eventType: 'booking.past_time.override',
            severity: 'info',
            context: {
              bookingId,
              restaurantId: existingBooking.restaurant_id,
              endpoint: 'ops.bookings.update',
              actorId: user.id,
              actorEmail: user.email,
              actorRole: userRole,
              timezone: scheduleForPast.timezone,
              bookingDate,
              bookingTime: startTime,
            },
          });
        });
      }
    } catch (pastTimeError) {
      if (pastTimeError instanceof PastBookingError) {
        // Log blocked attempt
        void import('@/server/observability').then(({ recordObservabilityEvent }) => {
          void recordObservabilityEvent({
            source: 'api.ops.bookings',
            eventType: 'booking.past_time.blocked',
            severity: 'warning',
            context: {
              bookingId,
              restaurantId: existingBooking.restaurant_id,
              endpoint: 'ops.bookings.update',
              actorId: user.id,
              actorEmail: user.email,
              actorRole: userRole,
              overrideAttempted: allowOverride,
              ...pastTimeError.details,
            },
          });
        });

        return timing.json(
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

  // Use tenant-scoped client for all booking operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);

  try {
    const updated: Tables<'bookings'> = requiresTableRealignment
      ? await timing.measure(
          'modification_flow',
          beginBookingModificationFlow({
            client: tenantClient,
            bookingId,
            existingBooking,
            source: 'ops',
            payload: {
              booking_date: bookingDate,
              start_time: startTime,
              end_time: endTime,
              ...instantFields,
              party_size: parsed.data.partySize,
              notes: normalizedNotes,
            },
          }),
        )
      : await timing.measure(
          'booking_update',
          updateBookingRecord(
            tenantClient,
            bookingId,
            {
              booking_date: bookingDate,
              start_time: startTime,
              end_time: endTime,
              ...instantFields,
              party_size: parsed.data.partySize,
              notes: normalizedNotes,
            },
            { restaurantId: existingBooking.restaurant_id },
          ),
        );

    const auditMetadata = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await timing.measure(
      'unified_audit',
      logAuditEvent(tenantClient, {
        action: 'booking.updated',
        entity: 'booking',
        entityId: bookingId,
        metadata: auditMetadata,
        actor: user.email ?? user.id ?? 'ops',
      }),
    );

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
        },
        {
          supabase: tenantClient,
          // Skip email when modification flow was used - it already sent the confirmation email
          skipEmail: requiresTableRealignment,
        },
      );
    } catch (jobError) {
      console.error('[ops/bookings][PATCH] side effects failed', jobError);
    }

    invalidateOpsDashboardCaches(updated.restaurant_id ?? existingBooking.restaurant_id, {
      summaryDates: [existingBooking.booking_date, updated.booking_date],
    });

    const restaurantRelation = Array.isArray(existingBooking.restaurants)
      ? (existingBooking.restaurants[0] ?? null)
      : (existingBooking.restaurants ?? null);

    const reservationIntervalMinutes =
      restaurantRelation && typeof restaurantRelation.reservation_interval_minutes === 'number'
        ? restaurantRelation.reservation_interval_minutes
        : null;

    const response = {
      id: updated.id,
      restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
      restaurantName: restaurantRelation?.name ?? '',
      restaurantSlug: restaurantRelation?.slug ?? null,
      restaurantTimezone: restaurantRelation?.timezone ?? null,
      reservationIntervalMinutes,
      partySize: updated.party_size,
      startIso: toIsoString(updated.start_at),
      endIso: toIsoString(updated.end_at),
      status: updated.status,
      notes: updated.notes ?? null,
      customerName:
        typeof updated.customer_name === 'string' && updated.customer_name.trim().length > 0
          ? updated.customer_name.trim()
          : null,
      customerEmail:
        typeof updated.customer_email === 'string' && updated.customer_email.trim().length > 0
          ? updated.customer_email.trim()
          : null,
      customerPhone:
        typeof updated.customer_phone === 'string' && updated.customer_phone.trim().length > 0
          ? updated.customer_phone.trim()
          : null,
    };

    return timing.json(response, undefined, {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      realigned: requiresTableRealignment,
    });
  } catch (updateError) {
    console.error('[ops/bookings][PATCH] update failed', updateError);

    captureRestaurantServerEvent('booking_modify_failed', {
      restaurantId: restaurantId || undefined,
      distinctId: user.id,
      props: { bookingId, source: 'ops', method: 'ops', reason: 'unexpected' },
    });
    captureServerException(updateError, {
      distinctId: user.id,
      groups: restaurantId ? { restaurant: restaurantId } : undefined,
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]' },
    });

    if (isDbStrictConstraintMappingEnabled()) {
      const mapped = mapDbErrorToConstraint(updateError);
      if (mapped) {
        const status =
          mapped.kind === 'overlap_conflict' || mapped.kind === 'unique_conflict' ? 409 : 422;
        return timing.json(
          {
            error: mapped.userMessage,
            code:
              mapped.kind === 'overlap_conflict'
                ? 'ALLOCATION_CONFLICT'
                : mapped.kind === 'unique_conflict'
                  ? 'UNIQUE_CONFLICT'
                  : mapped.kind === 'fk_conflict'
                    ? 'FK_CONFLICT'
                    : mapped.kind === 'check_violation'
                      ? 'CHECK_VIOLATION'
                      : 'DB_CONSTRAINT_ERROR',
            retryable: isRetryableConstraintError(updateError),
          },
          { status },
        );
      }
    }

    return timing.json({ error: 'Unable to update booking' }, { status: 500 });
  }
}

async function handleUnifiedOpsUpdate(params: UnifiedOpsUpdateParams) {
  const {
    bookingId,
    durationMinutes,
    instantFields,
    payload,
    existingBooking,
    user,
    memberships,
    timezone,
    timing,
  } = params;

  // The restaurant timezone and membership rows were already resolved by the
  // PATCH handler; re-fetching them here previously added two sequential
  // queries to every unified update.
  const membership =
    memberships.find((entry) => entry.restaurant_id === existingBooking.restaurant_id) ?? null;
  const userRole = (membership?.role as RestaurantRole | undefined) ?? null;
  const actorCapabilities = resolveActorCapabilities(userRole);
  const actorRoles = userRole ? [userRole] : ['staff'];

  const overrideReason = payload.override?.reason?.trim() ?? null;
  const overrideRequest = payload.override?.apply
    ? { apply: true, reason: overrideReason }
    : undefined;

  // Use tenant-scoped client for all validation and update operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);
  const validationService = createBookingValidationService({ client: tenantClient });

  const bookingInput: BookingInput = {
    restaurantId: existingBooking.restaurant_id,
    serviceId: existingBooking.booking_type ?? 'dinner',
    partySize: payload.partySize,
    start: payload.startIso,
    durationMinutes,
    seatingPreference: existingBooking.seating_preference ?? null,
    notes: payload.notes ?? existingBooking.notes ?? null,
    customerId: existingBooking.customer_id ?? null,
    customerName: existingBooking.customer_name ?? '',
    customerEmail: existingBooking.customer_email ?? null,
    customerPhone: existingBooking.customer_phone ?? null,
    marketingOptIn: existingBooking.marketing_opt_in ?? false,
    source: existingBooking.source ?? null,
    idempotencyKey: existingBooking.idempotency_key ?? null,
    bookingId,
    override: overrideRequest,
  };

  const context: ValidationContext = {
    actorId: user.id,
    actorRoles,
    actorCapabilities,
    tz: timezone,
    flags: {
      bookingPastTimeBlocking: isBookingPastTimeBlockingEnabled(),
      bookingPastTimeGraceMinutes: getBookingPastTimeGraceMinutes(),
      unified: true,
    },
    metadata: {
      clientRequestId: existingBooking.client_request_id ?? undefined,
    },
  };

  try {
    const commit = await timing.measure(
      'unified_validation',
      validationService.updateWithEnforcement(
        existingBooking as unknown as BookingRecord,
        bookingInput,
        context,
      ),
    );
    let updated = commit.booking as Tables<'bookings'>;
    if (updated.start_at !== instantFields.start_at || updated.end_at !== instantFields.end_at) {
      updated = await updateBookingRecord(tenantClient, bookingId, instantFields, {
        restaurantId: existingBooking.restaurant_id,
      });
    }
    const validationResponse = commit.response;

    const auditMetadata: Json = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    };

    if (validationResponse.overridden) {
      (auditMetadata as Record<string, unknown>).override_reason = overrideReason;
      (auditMetadata as Record<string, unknown>).override_codes =
        validationResponse.overrideCodes ?? [];
      (auditMetadata as Record<string, unknown>).override_applied = true;
    }

    await timing.measure(
      'unified_audit',
      logAuditEvent(tenantClient, {
        action: 'booking.updated',
        entity: 'booking',
        entityId: bookingId,
        metadata: auditMetadata,
        actor: user.email ?? user.id ?? 'ops',
      }),
    );

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated as unknown as BookingRecord),
          restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
        },
        { supabase: tenantClient },
      );
    } catch (jobError) {
      console.error('[ops/bookings][PATCH][unified] side effects failed', jobError);
    }

    if (validationResponse.overridden) {
      recordObservabilityEvent({
        source: 'api.ops.bookings',
        eventType: 'booking.override.applied',
        severity: 'info',
        context: {
          bookingId,
          restaurantId: existingBooking.restaurant_id,
          actorId: user.id,
          actorEmail: user.email,
          actorRole: userRole,
          codes: validationResponse.overrideCodes ?? [],
          reason: overrideReason,
        },
      });
    }

    invalidateOpsDashboardCaches(updated.restaurant_id ?? existingBooking.restaurant_id, {
      summaryDates: [existingBooking.booking_date, updated.booking_date],
    });

    const restaurantRelation = Array.isArray(existingBooking.restaurants)
      ? (existingBooking.restaurants[0] ?? null)
      : (existingBooking.restaurants ?? null);

    const reservationIntervalMinutes =
      restaurantRelation && typeof restaurantRelation.reservation_interval_minutes === 'number'
        ? restaurantRelation.reservation_interval_minutes
        : null;

    const responsePayload = {
      id: updated.id,
      restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
      restaurantName: restaurantRelation?.name ?? '',
      restaurantSlug: restaurantRelation?.slug ?? null,
      restaurantTimezone: restaurantRelation?.timezone ?? null,
      reservationIntervalMinutes,
      partySize: updated.party_size,
      startIso: toIsoString(updated.start_at),
      endIso: toIsoString(updated.end_at),
      status: updated.status,
      notes: updated.notes ?? null,
      customerName:
        typeof updated.customer_name === 'string' && updated.customer_name.trim().length > 0
          ? updated.customer_name.trim()
          : null,
      customerEmail:
        typeof updated.customer_email === 'string' && updated.customer_email.trim().length > 0
          ? updated.customer_email.trim()
          : null,
      customerPhone:
        typeof updated.customer_phone === 'string' && updated.customer_phone.trim().length > 0
          ? updated.customer_phone.trim()
          : null,
      validation: validationResponse,
    };

    return NextResponse.json(responsePayload, withValidationHeaders({ status: 200 }));
  } catch (error) {
    if (error instanceof BookingValidationError) {
      recordObservabilityEvent({
        source: 'api.ops.bookings',
        eventType: 'booking.validation_failed',
        severity: 'warning',
        context: {
          bookingId,
          restaurantId: existingBooking.restaurant_id,
          actorId: user.id,
          actorEmail: user.email,
          overrideAttempted: payload.override?.apply ?? false,
          issues: error.response.issues.map((issue) => issue.code),
        },
      });

      captureRestaurantServerEvent('booking_modify_failed', {
        restaurantId: existingBooking.restaurant_id ?? undefined,
        distinctId: user.id,
        props: { bookingId, source: 'ops', method: 'ops', reason: 'validation' },
      });

      const mapped = mapValidationFailure(error.response);
      return NextResponse.json(mapped.body, withValidationHeaders({ status: mapped.status }));
    }

    console.error('[ops/bookings][PATCH][unified] update failed', error);
    captureRestaurantServerEvent('booking_modify_failed', {
      restaurantId: existingBooking.restaurant_id ?? undefined,
      distinctId: user.id,
      props: { bookingId, source: 'ops', method: 'ops', reason: 'unexpected' },
    });
    captureServerException(error, {
      distinctId: user.id,
      groups: existingBooking.restaurant_id
        ? { restaurant: existingBooking.restaurant_id }
        : undefined,
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]' },
    });
    return NextResponse.json({ error: 'Unable to update booking' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error('[ops/bookings][DELETE] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let authorizedRestaurantIds: string[];
  try {
    authorizedRestaurantIds = await loadAuthorizedRestaurantIds(user.id, tenantSupabase);
  } catch (membershipError) {
    console.error('[ops/bookings][DELETE] failed to load memberships', membershipError);
    return NextResponse.json({ error: 'Unable to verify access' }, { status: 500 });
  }

  if (authorizedRestaurantIds.length === 0) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await serviceSupabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .in('restaurant_id', authorizedRestaurantIds)
    .maybeSingle();

  if (error) {
    console.error('[ops/bookings][DELETE] failed to load booking', error);
    return NextResponse.json({ error: 'Unable to load booking' }, { status: 500 });
  }

  const existingBooking = existing as Tables<'bookings'> | null;

  if (!existingBooking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (existingBooking.status === 'cancelled') {
    return NextResponse.json({ id: bookingId, status: existingBooking.status });
  }

  // Use tenant-scoped client for all cancellation operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);

  captureRestaurantServerEvent('booking_cancel_started', {
    restaurantId: existingBooking.restaurant_id ?? undefined,
    distinctId: user.id,
    props: { bookingId, source: 'ops', method: 'ops' },
  });

  try {
    const cancellation = await softCancelBooking(tenantClient, bookingId, {
      restaurantId: existingBooking.restaurant_id,
    });
    const cancelled = cancellation.booking;
    if (!cancellation.cancelled) {
      return NextResponse.json({ id: bookingId, status: cancelled.status });
    }

    const auditMetadata = {
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelled),
    } as Json;

    await logAuditEvent(tenantClient, {
      action: 'booking.cancelled',
      entity: 'booking',
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? 'ops',
    });

    try {
      await enqueueBookingCancelledSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          cancelled: safeBookingPayload(cancelled),
          restaurantId: existingBooking.restaurant_id,
          cancelledBy: 'staff',
        },
        { supabase: tenantClient },
      );
    } catch (jobError) {
      console.error('[ops/bookings][DELETE] side effects failed', jobError);
    }

    invalidateOpsDashboardCaches(existingBooking.restaurant_id, {
      summaryDates: [existingBooking.booking_date, cancelled.booking_date],
    });

    return NextResponse.json({ id: bookingId, status: cancelled.status });
  } catch (deleteError) {
    console.error('[ops/bookings][DELETE] cancellation failed', deleteError);

    if (typeof deleteError === 'object' && deleteError !== null) {
      const record = deleteError as { code?: string; message?: string };
      if (record.code === '42501') {
        captureRestaurantServerEvent('booking_cancel_failed', {
          restaurantId: existingBooking.restaurant_id ?? undefined,
          distinctId: user.id,
          props: { bookingId, source: 'ops', method: 'ops', reason: 'cutoff_passed' },
        });
        return NextResponse.json(
          {
            error: 'This booking can no longer be cancelled online.',
            code: 'CUTOFF_PASSED',
          },
          { status: 403 },
        );
      }
    }

    captureRestaurantServerEvent('booking_cancel_failed', {
      restaurantId: existingBooking.restaurant_id ?? undefined,
      distinctId: user.id,
      props: { bookingId, source: 'ops', method: 'ops', reason: 'unexpected' },
    });
    captureServerException(deleteError, {
      distinctId: user.id,
      groups: existingBooking.restaurant_id
        ? { restaurant: existingBooking.restaurant_id }
        : undefined,
      properties: { bookingId, source: 'ops', path: '/api/ops/bookings/[id]' },
    });
    return NextResponse.json({ error: 'Unable to cancel booking' }, { status: 500 });
  }
}
