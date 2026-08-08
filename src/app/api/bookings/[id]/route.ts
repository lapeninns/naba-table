import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { isBookingType } from '@/lib/enums';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http/errors';
import { captureServerEvent, captureServerException } from '@/lib/posthog/server';
import { GuardError, listUserRestaurantMemberships, requireSession } from '@/server/auth/guards';
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from '@/server/booking';
import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import { buildBookingWhatsAppConsentPatch } from '@/server/booking/whatsapp-consent';
import {
  BOOKING_TYPES,
  buildBookingAuditSnapshot,
  deriveEndTimeFromDuration,
  fetchBookingsForContact,
  inferMealTypeFromTime,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from '@/server/bookings';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import {
  buildBookingInstantFields,
  buildBookingInstantFieldsFromLocalTimes,
} from '@/server/bookings/instant-fields';
import { beginBookingModificationFlow } from '@/server/bookings/modification-flow';
import { PastBookingError, assertBookingNotInPast } from '@/server/bookings/pastTimeValidation';
import {
  OperatingHoursError,
  type OperatingHoursErrorReason,
  assertBookingWithinOperatingWindow,
} from '@/server/bookings/timeValidation';
import {
  convertIsoToVenueDateTime,
  convertOptionalIsoToVenueDateTime,
  type VenueDateTime,
} from '@/server/bookings/timezoneConversion';
import { normalizeEmail } from '@/server/customers';
import {
  enqueueBookingCancelledSideEffects,
  enqueueBookingUpdatedSideEffects,
  safeBookingPayload,
} from '@/server/jobs/booking-side-effects';
import { recordObservabilityEvent } from '@/server/observability';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import {
  getBookingPastTimeGraceMinutes,
  getPendingSelfServeGraceMinutes,
  isUnifiedBookingValidationEnabled,
} from '@/server/runtime-policy';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import {
  sessionRecoveryTokenMatchesBookingContact,
  validateSessionRecoveryAccessToken,
} from '@/server/security/session-recovery-access-token';
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
  MissingRestaurantContextError,
} from '@/server/supabase';
import { formatDateForInput } from '@reserve/shared/formatting/booking';
import {
  CUSTOMER_PHONE_LENGTH_MAX,
  CUSTOMER_PHONE_LENGTH_MIN,
  isUKPhone,
} from '@reserve/shared/validation';

import type { BookingRecord } from '@/server/bookings';
import type { Json, Tables } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const bookingTypeEnum = z.enum(BOOKING_TYPES);
const explicitBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

const updateSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(MIN_ONLINE_PARTY_SIZE).max(MAX_ONLINE_PARTY_SIZE),
  bookingType: bookingTypeEnum,
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z
    .string()
    .min(CUSTOMER_PHONE_LENGTH_MIN)
    .max(CUSTOMER_PHONE_LENGTH_MAX)
    .refine((value) => isUKPhone(value), {
      message: 'Please enter a valid UK phone number.',
    }),
  marketingOptIn: explicitBooleanSchema.optional().default(false),
  whatsappOptIn: explicitBooleanSchema.optional(),
});

// Dashboard update schema for minimal booking updates (used by EditBookingDialog)
// Note: offset: true allows both "Z" suffix and "+00:00" style offsets in ISO datetime strings
const dashboardUpdateSchema = z.object({
  startIso: z.string().datetime({ offset: true }),
  endIso: z.string().datetime({ offset: true }).optional(),
  partySize: z.coerce.number().int().min(MIN_ONLINE_PARTY_SIZE).max(MAX_ONLINE_PARTY_SIZE),
  notes: z.string().max(500).optional().nullable(),
});

const OPERATING_HOURS_REASON_TO_CODE: Record<OperatingHoursErrorReason, string> = {
  CLOSED: 'CLOSED_DATE',
  OUTSIDE_WINDOW: 'OUTSIDE_HOURS',
  AFTER_CLOSE: 'OUTSIDE_HOURS',
  INVALID_TIME: 'INVALID_TIME',
};

function mapOperatingHoursReason(reason: OperatingHoursErrorReason): string {
  return OPERATING_HOURS_REASON_TO_CODE[reason] ?? 'OUTSIDE_HOURS';
}

const pendingSelfServeGraceMinutes = getPendingSelfServeGraceMinutes();
const pendingSelfServeGraceWindowMs = Math.max(0, pendingSelfServeGraceMinutes) * 60_000;
const pastTimeGraceMinutes = getBookingPastTimeGraceMinutes();
const guestSelfServeCutoffMinutes = 15;
const bookingIdParamSchema = z.string().uuid();

function respondWithPastBooking(error: PastBookingError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      details: error.details,
    },
    { status: 422 },
  );
}

function resolveBookingStart(
  booking: Pick<Tables<'bookings'>, 'booking_date' | 'start_time' | 'start_at'>,
  timezone: string,
): { bookingDate: string; startTime: string } | null {
  if (booking.booking_date && booking.start_time) {
    return { bookingDate: booking.booking_date, startTime: booking.start_time };
  }

  if (booking.start_at) {
    try {
      const venueStart = convertIsoToVenueDateTime(booking.start_at, timezone);
      return { bookingDate: venueStart.date, startTime: venueStart.time };
    } catch (error) {
      console.error('[bookings][start-resolution] failed to convert start_at', error);
    }
  }

  return null;
}

function isPendingBookingLocked(
  booking: Pick<Tables<'bookings'>, 'status' | 'created_at'> | null | undefined,
): boolean {
  if (!booking || booking.status !== 'pending') {
    return false;
  }

  if (pendingSelfServeGraceWindowMs <= 0) {
    return true;
  }

  const createdAt = booking.created_at;
  if (!createdAt) {
    return true;
  }

  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return true;
  }

  return Date.now() - createdAtMs >= pendingSelfServeGraceWindowMs;
}

function isBookingOwnedByUser(
  booking: Pick<Tables<'bookings'>, 'customer_email' | 'auth_user_id'>,
  userId: string,
  normalizedUserEmail: string | null,
): boolean {
  const bookingEmail = booking.customer_email ? normalizeEmail(booking.customer_email) : null;
  const emailMatches =
    Boolean(normalizedUserEmail) && Boolean(bookingEmail) && normalizedUserEmail === bookingEmail;
  const authMatches = booking.auth_user_id ? booking.auth_user_id === userId : false;
  return emailMatches || authMatches;
}

function isBookingBoundToAuthenticatedUser(
  booking: Pick<Tables<'bookings'>, 'auth_user_id'>,
  userId: string,
): boolean {
  return Boolean(booking.auth_user_id) && booking.auth_user_id === userId;
}

function respondWithPendingLock() {
  return NextResponse.json(
    {
      error: "This reservation is still pending review and can't be changed yet.",
      code: 'PENDING_LOCKED',
    },
    { status: 403 },
  );
}

function respondWithCancelledBookingLock() {
  return NextResponse.json(
    {
      error: 'This reservation has already been cancelled and can no longer be changed.',
      code: 'BOOKING_CANCELLED',
    },
    { status: 409 },
  );
}

function evaluateGuestModificationLock(params: {
  booking: Pick<
    Tables<'bookings'>,
    'booking_date' | 'start_time' | 'start_at' | 'status' | 'checked_in_at'
  >;
  timezone: string;
  cutoffMinutes?: number;
}) {
  const { booking, timezone, cutoffMinutes = guestSelfServeCutoffMinutes } = params;

  if (booking.status === 'checked_in' || booking.checked_in_at) {
    return {
      locked: true,
      code: 'CHECKED_IN_LOCKED' as const,
      message: "This reservation has already been checked in and can't be changed online.",
    } as const;
  }

  const startParts = resolveBookingStart(booking, timezone);
  if (!startParts) {
    return { locked: false } as const;
  }

  const startDateTime = DateTime.fromISO(startParts.bookingDate + 'T' + startParts.startTime, {
    zone: timezone,
  });

  if (!startDateTime.isValid) {
    return { locked: false } as const;
  }

  const now = DateTime.now().setZone(timezone);
  const minutesUntilStart = startDateTime.diff(now, 'minutes').minutes;

  if (minutesUntilStart <= 0) {
    return {
      locked: true,
      code: 'SERVICE_STARTED' as const,
      message:
        'Service has already started for this reservation. Please contact the venue to make changes.',
    } as const;
  }

  if (minutesUntilStart <= cutoffMinutes) {
    return {
      locked: true,
      code: 'STARTING_SOON' as const,
      message: "This reservation starts in under 15 minutes and can't be changed online.",
    } as const;
  }

  return { locked: false } as const;
}

function respondWithGuestModificationLock(lock: ReturnType<typeof evaluateGuestModificationLock>) {
  if (!lock.locked) {
    return null;
  }

  return NextResponse.json(
    {
      error: lock.message,
      code: lock.code,
    },
    { status: 403 },
  );
}

async function requireRestaurantContext(restaurantId?: string | null): Promise<string> {
  if (restaurantId) {
    return restaurantId;
  }
  try {
    return await getDefaultRestaurantId();
  } catch (error) {
    if (error instanceof MissingRestaurantContextError) {
      throw new HttpError({
        message: 'restaurantId is required',
        status: 400,
        code: 'RESTAURANT_REQUIRED',
      });
    }
    throw error;
  }
}

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

async function resolveBookingId(
  paramsPromise: Promise<{ id: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) {
    return null;
  }

  const result = await paramsPromise;
  const { id } = result;

  if (typeof id === 'string') {
    const parsed = bookingIdParamSchema.safeParse(id);
    return parsed.success ? parsed.data : null;
  }

  if (Array.isArray(id)) {
    const first = id[0];
    if (!first) {
      return null;
    }

    const parsed = bookingIdParamSchema.safeParse(first);
    return parsed.success ? parsed.data : null;
  }

  return null;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractSessionRecoveryAccessToken(req: NextRequest): string | null {
  return (
    req.headers.get('x-session-recovery-token') ??
    req.nextUrl.searchParams.get('access_token') ??
    req.nextUrl.searchParams.get('accessToken') ??
    req.cookies.get('sr_access')?.value ??
    null
  );
}

function handleZodError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Invalid payload',
      details: error.flatten(),
      code: 'INVALID_PAYLOAD',
    },
    { status: 400 },
  );
}

type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;

type DashboardActor = {
  id: string;
  email: string | null;
};

function toGuestBookingDTO(
  booking: Tables<'bookings'>,
  restaurant?: {
    name?: string | null;
    slug?: string | null;
    timezone?: string | null;
  } | null,
) {
  return {
    id: booking.id,
    restaurant_id: booking.restaurant_id,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    start_at: booking.start_at,
    end_at: booking.end_at,
    reference: booking.reference,
    party_size: booking.party_size,
    booking_type: booking.booking_type,
    seating_preference: booking.seating_preference,
    status: booking.status,
    customer_name: booking.customer_name,
    customer_email: booking.customer_email,
    customer_phone: booking.customer_phone,
    notes: booking.notes,
    marketing_opt_in: booking.marketing_opt_in,
    client_request_id: booking.client_request_id,
    idempotency_key: booking.idempotency_key,
    pending_ref: booking.pending_ref,
    details: booking.details,
    created_at: booking.created_at,
    updated_at: booking.updated_at,
    restaurants: {
      name: restaurant?.name ?? null,
      slug: restaurant?.slug ?? null,
      timezone: restaurant?.timezone ?? null,
    },
  };
}

function toPublicRecoveryBookingDTO(
  booking: Tables<'bookings'>,
  restaurant?: {
    name?: string | null;
    slug?: string | null;
    timezone?: string | null;
  } | null,
) {
  return {
    ...toGuestBookingDTO(booking, restaurant),
    customer_name: 'Guest',
    customer_email: '',
    customer_phone: '',
    marketing_opt_in: false,
    client_request_id: null,
    idempotency_key: null,
    pending_ref: null,
    details: null,
  };
}

async function handleDashboardUpdate(params: {
  bookingId: string;
  data: DashboardUpdateInput;
  existingBooking: Tables<'bookings'>;
  actor: DashboardActor;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
  enforceGuestSelfServiceLock?: boolean;
}) {
  const {
    bookingId,
    data,
    existingBooking,
    actor,
    serviceSupabase,
    enforceGuestSelfServiceLock = false,
  } = params;

  if (isPendingBookingLocked(existingBooking)) {
    return respondWithPendingLock();
  }

  if (existingBooking.status === 'cancelled') {
    return respondWithCancelledBookingLock();
  }

  try {
    const startInstant = new Date(data.startIso);
    if (Number.isNaN(startInstant.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date values', code: 'INVALID_DATE' },
        { status: 400 },
      );
    }

    const restaurantId = await requireRestaurantContext(existingBooking.restaurant_id);
    const initialSchedule = await getRestaurantSchedule(restaurantId, {
      date: formatDateForInput(startInstant),
      client: serviceSupabase,
    });
    const initialScheduleTimezone = initialSchedule.timezone ?? 'Europe/London';

    if (enforceGuestSelfServiceLock) {
      const guestLock = evaluateGuestModificationLock({
        booking: existingBooking,
        timezone: initialScheduleTimezone,
      });
      const lockedResponse = respondWithGuestModificationLock(guestLock);
      if (lockedResponse) {
        return lockedResponse;
      }
    }

    let startVenue: VenueDateTime;
    try {
      startVenue = convertIsoToVenueDateTime(data.startIso, initialScheduleTimezone);
    } catch (conversionError) {
      const message =
        conversionError instanceof Error ? conversionError.message : 'Invalid date values';
      return NextResponse.json({ error: message, code: 'INVALID_DATE' }, { status: 400 });
    }

    let schedule =
      startVenue.date === initialSchedule.date
        ? initialSchedule
        : await getRestaurantSchedule(restaurantId, {
            date: startVenue.date,
            client: serviceSupabase,
          });
    const scheduleTimezone = schedule.timezone ?? initialScheduleTimezone;

    const explicitEndVenue = convertOptionalIsoToVenueDateTime(data.endIso, scheduleTimezone);
    const existingStartVenue = convertOptionalIsoToVenueDateTime(
      existingBooking.start_at,
      scheduleTimezone,
    );
    const existingEndVenue = convertOptionalIsoToVenueDateTime(
      existingBooking.end_at,
      scheduleTimezone,
    );

    const existingDurationMinutes =
      existingStartVenue && existingEndVenue
        ? Math.max(
            1,
            Math.round(
              existingEndVenue.dateTime.diff(existingStartVenue.dateTime, 'minutes').minutes ?? 0,
            ),
          )
        : null;

    let bookingDate = startVenue.date;
    let startTime = startVenue.time;

    const previousBookingDate = existingBooking.booking_date ?? null;
    const previousStartTime = existingBooking.start_time ?? null;
    const isTimeChanged = bookingDate !== previousBookingDate || startTime !== previousStartTime;

    const needsScheduleForDuration = isTimeChanged || !explicitEndVenue;

    let normalizedStartDateTime = startVenue.dateTime.set({ second: 0, millisecond: 0 });
    const existingBookingTypeRaw = existingBooking.booking_type ?? '';
    let bookingType = isBookingType(existingBookingTypeRaw)
      ? existingBookingTypeRaw
      : inferMealTypeFromTime(startTime);

    try {
      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: startTime,
      });
      startTime = time;
      normalizedStartDateTime = normalizedStartDateTime.set({
        hour: Number.parseInt(time.slice(0, 2), 10),
        minute: Number.parseInt(time.slice(3, 5), 10),
      });
      bookingDate = normalizedStartDateTime.toISODate() ?? bookingDate;
      bookingType = isBookingType(existingBookingTypeRaw)
        ? existingBookingTypeRaw
        : inferMealTypeFromTime(startTime);
    } catch (validationError) {
      if (validationError instanceof OperatingHoursError) {
        return NextResponse.json(
          { error: validationError.message, code: mapOperatingHoursReason(validationError.reason) },
          { status: 400 },
        );
      }
      throw validationError;
    }

    if (
      (needsScheduleForDuration || schedule.date !== bookingDate) &&
      schedule.date !== bookingDate
    ) {
      schedule = await getRestaurantSchedule(restaurantId, {
        date: bookingDate,
        client: serviceSupabase,
      });
    }

    try {
      assertBookingNotInPast(schedule.timezone ?? scheduleTimezone, bookingDate, startTime, {
        graceMinutes: pastTimeGraceMinutes,
      });
    } catch (pastTimeError) {
      if (pastTimeError instanceof PastBookingError) {
        void recordObservabilityEvent({
          source: 'api.bookings',
          eventType: 'booking.past_time.blocked',
          severity: 'warning',
          context: {
            bookingId,
            restaurantId: existingBooking.restaurant_id,
            endpoint: 'bookings.update.dashboard',
            actorId: actor.id,
            actorEmail: actor.email,
            ...pastTimeError.details,
          },
        });

        return respondWithPastBooking(pastTimeError);
      }
      throw pastTimeError;
    }

    const { durationMinutes: computedDuration } = await resolveBookingDurationMinutes({
      restaurantId,
      bookingDate,
      startTime,
      partySize: data.partySize,
      bookingOption: bookingType,
      timezone: schedule.timezone ?? scheduleTimezone,
      client: serviceSupabase,
    });
    const fallbackDuration =
      existingDurationMinutes && existingDurationMinutes > 0
        ? existingDurationMinutes
        : computedDuration > 0
          ? computedDuration
          : (env.reserve.defaultDurationMinutes ?? 90);

    let durationMinutes: number;
    let endDateTime = normalizedStartDateTime;

    if (isTimeChanged) {
      durationMinutes = computedDuration > 0 ? computedDuration : fallbackDuration;
      endDateTime = normalizedStartDateTime.plus({ minutes: durationMinutes });
    } else if (explicitEndVenue) {
      endDateTime = explicitEndVenue.dateTime;
      durationMinutes = Math.max(
        1,
        Math.round(explicitEndVenue.dateTime.diff(normalizedStartDateTime, 'minutes').minutes ?? 0),
      );
    } else if (existingEndVenue) {
      endDateTime = existingEndVenue.dateTime;
      durationMinutes = fallbackDuration > 0 ? fallbackDuration : 90;
    } else {
      durationMinutes = computedDuration > 0 ? computedDuration : fallbackDuration;
      endDateTime = normalizedStartDateTime.plus({ minutes: durationMinutes });
    }

    if (endDateTime.toMillis() <= normalizedStartDateTime.toMillis()) {
      return NextResponse.json(
        { error: 'End time must be after start time', code: 'INVALID_TIME_RANGE' },
        { status: 400 },
      );
    }

    const endTime = endDateTime.set({ second: 0, millisecond: 0 }).toFormat('HH:mm');
    const resolvedScheduleTz = schedule.timezone ?? scheduleTimezone;
    const instantFields = buildBookingInstantFields({
      startDateTime: normalizedStartDateTime,
      endDateTime: endDateTime.set({ second: 0, millisecond: 0 }),
    });
    const requiresTableRealignment =
      bookingDate !== (existingBooking.booking_date ?? '') ||
      startTime !== (existingBooking.start_time ?? '') ||
      endTime !== (existingBooking.end_time ?? '') ||
      data.partySize !== (existingBooking.party_size ?? 0);
    const normalizedNotes = data.notes ?? null;
    const normalizedBookingType = isBookingType(existingBookingTypeRaw)
      ? existingBookingTypeRaw
      : undefined;

    const useUnifiedValidation = isUnifiedBookingValidationEnabled();
    let updated: Tables<'bookings'>;

    if (useUnifiedValidation) {
      const validationService = createBookingValidationService({ client: serviceSupabase });

      const loyaltyPointsAwarded =
        (existingBooking as { loyalty_points_awarded?: number | null }).loyalty_points_awarded ??
        null;

      const bookingInput: BookingInput = {
        restaurantId,
        serviceId: existingBooking.booking_type ?? 'dinner',
        bookingType: normalizedBookingType,
        bookingId,
        partySize: data.partySize,
        start: `${bookingDate}T${startTime}:00`,
        durationMinutes,
        seatingPreference: existingBooking.seating_preference ?? null,
        notes: data.notes ?? existingBooking.notes ?? null,
        customerId: existingBooking.customer_id ?? null,
        customerName: existingBooking.customer_name ?? '',
        customerEmail: existingBooking.customer_email ?? null,
        customerPhone: existingBooking.customer_phone ?? null,
        marketingOptIn: existingBooking.marketing_opt_in ?? false,
        source: existingBooking.source ?? null,
        idempotencyKey: existingBooking.idempotency_key ?? null,
        loyaltyPointsAwarded,
      };

      const context = {
        actorId: actor.id,
        actorRoles: ['dashboard'],
        actorCapabilities: [],
        tz: resolvedScheduleTz ?? 'Europe/London',
        flags: {
          bookingPastTimeBlocking: true,
          bookingPastTimeGraceMinutes: pastTimeGraceMinutes,
          unified: true,
        },
        metadata: {
          clientRequestId: existingBooking.client_request_id ?? undefined,
        },
      } satisfies ValidationContext;

      try {
        if (requiresTableRealignment) {
          const validation = await validationService.validateUpdate(
            existingBooking as unknown as BookingRecord,
            bookingInput,
            context,
          );
          if (!validation.response.ok) {
            throw new BookingValidationError({ ...validation.response, ok: false });
          }

          updated = await beginBookingModificationFlow({
            client: serviceSupabase,
            bookingId,
            existingBooking,
            source: 'guest',
            payload: {
              restaurant_id: restaurantId,
              booking_date: bookingDate,
              start_time: startTime,
              end_time: endTime,
              ...instantFields,
              party_size: data.partySize,
              notes: normalizedNotes,
            },
          });
        } else {
          const commit = await validationService.updateWithEnforcement(
            existingBooking as unknown as BookingRecord,
            bookingInput,
            context,
          );
          updated = commit.booking as unknown as Tables<'bookings'>;
        }
      } catch (error) {
        if (error instanceof BookingValidationError) {
          const mapped = mapValidationFailure(error.response);
          return NextResponse.json(mapped.body, withValidationHeaders({ status: mapped.status }));
        }
        throw error;
      }
    } else if (requiresTableRealignment) {
      updated = await beginBookingModificationFlow({
        client: serviceSupabase,
        bookingId,
        existingBooking,
        source: 'guest',
        payload: {
          restaurant_id: restaurantId,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          ...instantFields,
          party_size: data.partySize,
          notes: normalizedNotes,
        },
      });
    } else {
      updated = await updateBookingRecord(
        serviceSupabase,
        bookingId,
        {
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          ...instantFields,
          party_size: data.partySize,
          notes: normalizedNotes,
          booking_type: normalizedBookingType,
          seating_preference: existingBooking.seating_preference,
          customer_name: existingBooking.customer_name,
          customer_email: existingBooking.customer_email,
          customer_phone: existingBooking.customer_phone,
          marketing_opt_in: existingBooking.marketing_opt_in,
        },
        { restaurantId },
      );
    }

    if (
      useUnifiedValidation &&
      (updated.start_at !== instantFields.start_at || updated.end_at !== instantFields.end_at)
    ) {
      updated = await updateBookingRecord(serviceSupabase, bookingId, instantFields, {
        restaurantId,
      });
    }

    const targetRestaurantId = await requireRestaurantContext(
      updated.restaurant_id ?? existingBooking.restaurant_id,
    );

    const auditMetadata = {
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      restaurant_id: targetRestaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.updated',
      entity: 'booking',
      entityId: bookingId,
      metadata: auditMetadata,
      actor: actor.email ?? actor.id ?? existingBooking.customer_email ?? 'dashboard',
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: targetRestaurantId,
        },
        {
          supabase: serviceSupabase,
          // The modification flow already sends the appropriate confirmed/pending email.
          skipEmail: requiresTableRealignment,
        },
      );
    } catch (jobError: unknown) {
      console.error('[bookings][PUT:dashboard][side-effects]', stringifyError(jobError));
    }

    const responseIntervalMinutes =
      schedule && typeof schedule.intervalMinutes === 'number' ? schedule.intervalMinutes : null;

    const bookingDTO = {
      id: updated.id,
      restaurantName: 'Unknown',
      partySize: updated.party_size,
      startIso: instantFields.start_at,
      endIso: instantFields.end_at,
      status: updated.status as 'pending' | 'pending_allocation' | 'confirmed' | 'cancelled',
      notes: updated.notes,
      reservationIntervalMinutes: responseIntervalMinutes,
      booking: toGuestBookingDTO(
        {
          ...updated,
          start_at: instantFields.start_at,
          end_at: instantFields.end_at,
        },
        {
          timezone: resolvedScheduleTz,
        },
      ),
    };

    const responseInit = useUnifiedValidation
      ? withValidationHeaders({ status: 200 })
      : { status: 200 };

    return NextResponse.json(bookingDTO, responseInit);
  } catch (error: unknown) {
    console.error('[bookings][PUT:dashboard]', stringifyError(error));
    captureServerEvent('booking_modify_failed', {
      bookingId,
      source: 'api',
      method: 'guest',
      reason: 'unexpected',
    });
    captureServerException(error, {
      properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
    });
    return NextResponse.json(
      { error: 'Unable to update booking', code: 'UNKNOWN' },
      { status: 500 },
    );
  }
}

function respondWithGuardError(error: GuardError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: error.status },
  );
}

async function processDashboardUpdate(bookingId: string, data: DashboardUpdateInput) {
  const { supabase, user } = await requireSession();
  const actor: DashboardActor = { id: user.id, email: user.email ?? null };
  const normalizedUserEmail = user.email ? normalizeEmail(user.email) : null;

  const { data: tenantBooking, error: tenantError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (tenantError) {
    throw new GuardError({
      status: 500,
      code: 'BOOKING_LOOKUP_FAILED',
      message: 'Unable to load booking',
      details: tenantError,
      cause: tenantError,
    });
  }

  if (tenantBooking) {
    const bookingRecord = tenantBooking as Tables<'bookings'>;
    if (isBookingOwnedByUser(bookingRecord, user.id, normalizedUserEmail)) {
      return handleDashboardUpdate({
        bookingId,
        data,
        existingBooking: bookingRecord,
        actor,
        serviceSupabase: getServiceSupabaseClient(),
        enforceGuestSelfServiceLock: true,
      });
    }
  }

  const memberships = await listUserRestaurantMemberships(supabase, user.id);

  const serviceSupabase = getServiceSupabaseClient();
  const { data: serviceBooking, error: serviceError } = await serviceSupabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (serviceError) {
    throw new GuardError({
      status: 500,
      code: 'BOOKING_LOOKUP_FAILED',
      message: 'Unable to load booking',
      details: serviceError,
      cause: serviceError,
    });
  }

  if (!serviceBooking) {
    return NextResponse.json(
      { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
      { status: 404 },
    );
  }

  const bookingRecord = serviceBooking as Tables<'bookings'>;

  if (memberships.length === 0) {
    if (!isBookingOwnedByUser(bookingRecord, user.id, normalizedUserEmail)) {
      throw new GuardError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this booking',
      });
    }

    return handleDashboardUpdate({
      bookingId,
      data,
      existingBooking: bookingRecord,
      actor,
      serviceSupabase,
      enforceGuestSelfServiceLock: true,
    });
  }

  const membershipIds = new Set(
    memberships
      .map((membership) => membership.restaurant_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const restaurantId = bookingRecord.restaurant_id;

  if (!restaurantId || !membershipIds.has(restaurantId)) {
    throw new GuardError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to modify this booking',
      details: { restaurantId },
    });
  }

  return handleDashboardUpdate({
    bookingId,
    data,
    existingBooking: bookingRecord,
    actor,
    serviceSupabase,
  });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json(
      { error: 'Missing booking id', code: 'MISSING_BOOKING_ID' },
      { status: 400 },
    );
  }

  const legacyToken = req.nextUrl.searchParams.get('token');
  if (legacyToken) {
    return NextResponse.json(
      {
        error: 'Legacy booking tokens are no longer supported. Request a new link.',
        code: 'LEGACY_TOKEN_DEPRECATED',
      },
      { status: 410 },
    );
  }

  const recoveryToken = extractSessionRecoveryAccessToken(req);
  if (recoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (!secret) {
      return NextResponse.json(
        { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const result = validateSessionRecoveryAccessToken(recoveryToken, { secret });
    if (!result.ok) {
      const code = result.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
      const status = result.reason === 'expired' ? 410 : 401;
      return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
    }

    const rateLimit = await requireApiRateLimit({
      request: req,
      scope: 'bookings:recovery-lookup',
      tenantId: result.payload.restaurantId,
      limit: 20,
      windowMs: 60_000,
      message: 'Too many booking lookup requests. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    const serviceSupabase = getServiceSupabaseClient();
    const { data: existing, error } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('restaurant_id', result.payload.restaurantId)
      .maybeSingle();

    if (error) {
      console.error(
        '[bookings][GET:id][session-recovery] booking lookup failed',
        stringifyError(error),
      );
      return NextResponse.json(
        { error: 'Unable to load booking', code: 'BOOKING_LOOKUP_FAILED' },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 },
      );
    }

    const bookingRecord = existing as Tables<'bookings'>;

    if (
      !sessionRecoveryTokenMatchesBookingContact({
        payload: result.payload,
        booking: {
          restaurantId: bookingRecord.restaurant_id,
          email: bookingRecord.customer_email,
          phone: bookingRecord.customer_phone,
        },
      })
    ) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 },
      );
    }

    const { data: restaurant, error: restaurantError } = await serviceSupabase
      .from('restaurants')
      .select('name, slug, timezone')
      .eq('id', bookingRecord.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error(
        '[bookings][GET:id][session-recovery] restaurant lookup failed',
        stringifyError(restaurantError),
      );
    }

    return NextResponse.json({ booking: toPublicRecoveryBookingDTO(bookingRecord, restaurant) });
  }

  // Require authentication to view booking details (default path)
  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }

  const normalizedUserEmail = normalizeEmail(user.email);

  const authenticatedRateLimit = await requireApiRateLimit({
    request: req,
    scope: 'bookings:authenticated-lookup',
    userId: user.id,
    limit: 60,
    windowMs: 60_000,
    message: 'Too many booking lookup requests. Please try again later.',
  });
  if (authenticatedRateLimit) {
    return authenticatedRateLimit;
  }

  try {
    // Use service client to bypass RLS and check ownership manually
    const serviceSupabase = getServiceSupabaseClient();
    const { data, error } = await serviceSupabase
      .from('bookings')
      .select(
        'id,restaurant_id,booking_date,start_time,end_time,start_at,end_at,reference,party_size,booking_type,seating_preference,status,customer_name,customer_email,customer_phone,notes,marketing_opt_in,whatsapp_opt_in,whatsapp_opt_in_at,whatsapp_consent_phone,whatsapp_consent_source,whatsapp_consent_version,whatsapp_consent_actor_id,loyalty_points_awarded,client_request_id,pending_ref,idempotency_key,details,created_at,updated_at',
      )
      .eq('id', bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 },
      );
    }

    // Verify ownership: user email must match booking email (except for seeded test bookings)
    if (normalizeEmail(data.customer_email) !== normalizedUserEmail) {
      // Log unauthorized access attempt
      void recordObservabilityEvent({
        source: 'api.bookings',
        eventType: 'booking_details.access_denied',
        severity: 'warning',
        context: {
          booking_id: bookingId,
          user_email: normalizedUserEmail,
          booking_email: data.customer_email,
        },
      });

      return NextResponse.json(
        { error: 'You can only view your own bookings', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    if (!data.restaurant_id) {
      console.error('[bookings][GET:id] Booking has no restaurant_id', { bookingId: data.id });
      return NextResponse.json(
        {
          error: 'This booking is missing restaurant information. Please contact support.',
          code: 'MISSING_RESTAURANT_DATA',
        },
        { status: 500 },
      );
    }

    const { data: restaurant, error: restaurantError } = await serviceSupabase
      .from('restaurants')
      .select('name, slug, timezone')
      .eq('id', data.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      console.error('[bookings][GET:id] Error fetching restaurant', {
        restaurantId: data.restaurant_id,
        error: restaurantError,
      });
    }

    if (!restaurant) {
      console.error('[bookings][GET:id] Restaurant not found', {
        restaurantId: data.restaurant_id,
        bookingId: data.id,
      });
      return NextResponse.json(
        {
          error: 'Restaurant information not found. Please contact support.',
          code: 'RESTAURANT_NOT_FOUND',
        },
        { status: 500 },
      );
    }

    if (!restaurant.slug) {
      console.error('[bookings][GET:id] Restaurant has no slug', {
        restaurantId: data.restaurant_id,
        restaurantName: restaurant.name,
      });
    }

    return NextResponse.json({
      booking: toGuestBookingDTO(data as Tables<'bookings'>, restaurant),
    });
  } catch (error: unknown) {
    console.error('[bookings][GET:id]', stringifyError(error));
    return NextResponse.json({ error: 'Unable to load booking', code: 'UNKNOWN' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json(
      { error: 'Missing booking id', code: 'MISSING_BOOKING_ID' },
      { status: 400 },
    );
  }
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  captureServerEvent('booking_modify_started', {
    bookingId,
    source: 'api',
    method: 'guest',
  });

  // Try dashboard format first (minimal update from EditBookingDialog)
  const dashboardParsed = dashboardUpdateSchema.safeParse(body);
  const recoveryToken = extractSessionRecoveryAccessToken(req);

  if (dashboardParsed.success) {
    if (recoveryToken) {
      const secret = env.security.sessionRecoveryAccessTokenSecret;
      if (!secret) {
        return NextResponse.json(
          { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
          { status: 503 },
        );
      }

      const result = validateSessionRecoveryAccessToken(recoveryToken, { secret });
      if (!result.ok) {
        const code = result.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
        const status = result.reason === 'expired' ? 410 : 401;
        return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
      }

      const serviceSupabase = getServiceSupabaseClient();
      const { data: existing, error } = await serviceSupabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .eq('restaurant_id', result.payload.restaurantId)
        .maybeSingle();

      if (error) {
        console.error(
          '[bookings][PUT:id][session-recovery] booking lookup failed',
          stringifyError(error),
        );
        return NextResponse.json(
          { error: 'Unable to load booking', code: 'BOOKING_LOOKUP_FAILED' },
          { status: 500 },
        );
      }

      if (!existing) {
        return NextResponse.json(
          { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
          { status: 404 },
        );
      }

      const bookingRecord = existing as Tables<'bookings'>;

      if (
        !sessionRecoveryTokenMatchesBookingContact({
          payload: result.payload,
          booking: {
            restaurantId: bookingRecord.restaurant_id,
            email: bookingRecord.customer_email,
            phone: bookingRecord.customer_phone,
          },
        })
      ) {
        return NextResponse.json(
          { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
          { status: 404 },
        );
      }

      const tokenEmail = normalizeEmail(result.payload.email);

      return handleDashboardUpdate({
        bookingId,
        data: dashboardParsed.data,
        existingBooking: bookingRecord,
        actor: {
          id: bookingRecord.customer_id ?? 'session-recovery',
          email: bookingRecord.customer_email ?? (tokenEmail || null),
        },
        serviceSupabase,
        enforceGuestSelfServiceLock: true,
      });
    }

    try {
      return await processDashboardUpdate(bookingId, dashboardParsed.data);
    } catch (error) {
      if (error instanceof GuardError) {
        return respondWithGuardError(error);
      }
      console.error('[bookings][PUT:dashboard] unexpected failure', stringifyError(error));
      return NextResponse.json(
        { error: 'Unable to update booking', code: 'UNKNOWN' },
        { status: 500 },
      );
    }
  }

  // Fall back to full update schema (legacy/complete booking updates)
  const parsed = updateSchema.safeParse({
    ...body,
    party: Number(body.party ?? 0),
  });

  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const data = parsed.data;
  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const serviceSupabase = getServiceSupabaseClient();
  const secret = recoveryToken ? env.security.sessionRecoveryAccessTokenSecret : null;
  const recoveryResult =
    recoveryToken && secret ? validateSessionRecoveryAccessToken(recoveryToken, { secret }) : null;

  if (recoveryToken && !secret) {
    return NextResponse.json(
      { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  if (recoveryToken && recoveryResult && !recoveryResult.ok) {
    const code =
      recoveryResult.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
    const status = recoveryResult.reason === 'expired' ? 410 : 401;
    return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
  }

  const {
    data: { user },
    error: authError,
  } = recoveryResult?.ok
    ? { data: { user: null }, error: null }
    : await tenantSupabase.auth.getUser();

  if (authError) {
    console.error('[bookings][PUT:id] auth resolution failed', authError.message);
  }

  if (!recoveryResult?.ok && !user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }

  try {
    let lookup = serviceSupabase.from('bookings').select('*').eq('id', bookingId);

    if (recoveryResult?.ok) {
      lookup = lookup.eq('restaurant_id', recoveryResult.payload.restaurantId);
    }

    const { data: existing, error } = await lookup.maybeSingle();

    if (error) {
      throw error;
    }

    const existingBooking = existing as Tables<'bookings'> | null;

    if (!existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 },
      );
    }

    if (
      data.restaurantId &&
      existingBooking.restaurant_id &&
      data.restaurantId !== existingBooking.restaurant_id
    ) {
      return NextResponse.json(
        {
          error: 'You cannot move this reservation to another restaurant',
          code: 'RESTAURANT_LOCKED',
        },
        { status: 403 },
      );
    }

    if (recoveryResult?.ok) {
      if (
        !sessionRecoveryTokenMatchesBookingContact({
          payload: recoveryResult.payload,
          booking: {
            restaurantId: existingBooking.restaurant_id,
            email: existingBooking.customer_email,
            phone: existingBooking.customer_phone,
          },
        })
      ) {
        return NextResponse.json(
          { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
          { status: 404 },
        );
      }
    } else if (user) {
      const normalizedUserEmail = user.email ? normalizeEmail(user.email) : null;
      if (!isBookingOwnedByUser(existingBooking, user.id, normalizedUserEmail)) {
        return NextResponse.json(
          { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
          { status: 404 },
        );
      }
    }

    if (existingBooking.status === 'cancelled') {
      return respondWithCancelledBookingLock();
    }

    if (isPendingBookingLocked(existingBooking)) {
      return respondWithPendingLock();
    }

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = data.phone.trim();
    const restaurantId = await requireRestaurantContext(existingBooking.restaurant_id);
    const normalizedBookingType = data.bookingType ?? inferMealTypeFromTime(data.time);

    let startTime = data.time;

    let schedule: Awaited<ReturnType<typeof getRestaurantSchedule>>;

    try {
      schedule = await getRestaurantSchedule(restaurantId, {
        date: data.date,
        client: serviceSupabase,
      });

      const modificationLock = evaluateGuestModificationLock({
        booking: existingBooking,
        timezone: schedule.timezone ?? 'Europe/London',
      });

      const lockedResponse = respondWithGuestModificationLock(modificationLock);
      if (lockedResponse) {
        return lockedResponse;
      }

      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
      });

      startTime = time;
    } catch (validationError) {
      if (validationError instanceof OperatingHoursError) {
        return NextResponse.json(
          { error: validationError.message, code: mapOperatingHoursReason(validationError.reason) },
          { status: 400 },
        );
      }
      throw validationError;
    }

    const { durationMinutes } = await resolveBookingDurationMinutes({
      restaurantId,
      bookingDate: data.date,
      startTime,
      partySize: data.party,
      bookingOption: normalizedBookingType,
      timezone: schedule.timezone ?? 'Europe/London',
      client: serviceSupabase,
    });
    const endTime = deriveEndTimeFromDuration(startTime, durationMinutes);
    const instantFields = buildBookingInstantFieldsFromLocalTimes({
      bookingDate: data.date,
      startTime,
      endTime,
      timezone: schedule.timezone ?? 'Europe/London',
    });

    try {
      assertBookingNotInPast(schedule.timezone ?? 'Europe/London', data.date, startTime, {
        graceMinutes: pastTimeGraceMinutes,
      });
    } catch (pastTimeError) {
      if (pastTimeError instanceof PastBookingError) {
        void recordObservabilityEvent({
          source: 'api.bookings',
          eventType: 'booking.past_time.blocked',
          severity: 'warning',
          context: {
            bookingId,
            restaurantId,
            endpoint: 'bookings.update.selfserve',
            actorEmail: normalizedEmail,
            ...pastTimeError.details,
          },
        });

        return respondWithPastBooking(pastTimeError);
      }
      throw pastTimeError;
    }

    const requiresTableRealignment =
      existingBooking.booking_date !== data.date ||
      existingBooking.start_time !== startTime ||
      existingBooking.end_time !== endTime ||
      existingBooking.party_size !== data.party;
    const whatsappConsentPatch = buildBookingWhatsAppConsentPatch({
      actorId: null,
      existingBooking,
      optedIn: data.whatsappOptIn,
      phone: normalizedPhone,
      source: 'guest_reserve',
    });

    const updated: Tables<'bookings'> = requiresTableRealignment
      ? await beginBookingModificationFlow({
          client: serviceSupabase,
          bookingId,
          existingBooking,
          source: 'guest',
          payload: {
            restaurant_id: restaurantId,
            booking_date: data.date,
            start_time: startTime,
            end_time: endTime,
            ...instantFields,
            party_size: data.party,
            booking_type: normalizedBookingType,
            seating_preference: existingBooking.seating_preference,
            customer_name: data.name,
            customer_email: normalizedEmail,
            customer_phone: normalizedPhone,
            ...whatsappConsentPatch,
            notes: data.notes ?? null,
            marketing_opt_in: data.marketingOptIn ?? existingBooking.marketing_opt_in,
          },
        })
      : await updateBookingRecord(
          serviceSupabase,
          bookingId,
          {
            restaurant_id: restaurantId,
            booking_date: data.date,
            start_time: startTime,
            end_time: endTime,
            ...instantFields,
            party_size: data.party,
            booking_type: normalizedBookingType,
            seating_preference: existingBooking.seating_preference,
            customer_name: data.name,
            customer_email: normalizedEmail,
            customer_phone: normalizedPhone,
            ...whatsappConsentPatch,
            notes: data.notes ?? null,
            marketing_opt_in: data.marketingOptIn ?? existingBooking.marketing_opt_in,
          },
          { restaurantId },
        );

    const auditMetadata = {
      restaurant_id: restaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    const actorIdentity =
      user?.email ??
      user?.id ??
      (recoveryResult?.ok ? 'session-recovery' : null) ??
      existingBooking.customer_email ??
      null;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.updated',
      entity: 'booking',
      entityId: bookingId,
      metadata: auditMetadata,
      actor: actorIdentity,
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId,
        },
        {
          supabase: serviceSupabase,
          // Skip email when modification flow was used - it already sent the confirmation email
          skipEmail: requiresTableRealignment,
        },
      );
    } catch (jobError: unknown) {
      console.error('[bookings][PUT:id][side-effects]', stringifyError(jobError));
    }

    return NextResponse.json({ booking: toGuestBookingDTO(updated) });
  } catch (error: unknown) {
    console.error('[bookings][PUT:id]', stringifyError(error));
    captureServerEvent('booking_modify_failed', {
      bookingId,
      source: 'api',
      method: 'guest',
      ...(error instanceof HttpError
        ? { code: error.code, status: error.status }
        : { reason: 'unexpected' }),
    });
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: error.status },
      );
    }

    captureServerException(error, {
      properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
    });
    return NextResponse.json(
      { error: 'Unable to update booking', code: 'UNKNOWN' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json(
      { error: 'Missing booking id', code: 'MISSING_BOOKING_ID' },
      { status: 400 },
    );
  }

  captureServerEvent('booking_cancel_started', {
    bookingId,
    source: 'api',
    method: 'guest',
  });

  const recoveryToken = extractSessionRecoveryAccessToken(req);
  if (recoveryToken) {
    const secret = env.security.sessionRecoveryAccessTokenSecret;
    if (!secret) {
      return NextResponse.json(
        { error: 'Session recovery token not configured', code: 'ACCESS_TOKEN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const result = validateSessionRecoveryAccessToken(recoveryToken, { secret });
    if (!result.ok) {
      const code = result.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'INVALID_ACCESS_TOKEN';
      const status = result.reason === 'expired' ? 410 : 401;
      return NextResponse.json({ error: 'Invalid session recovery token', code }, { status });
    }

    const tokenEmail = normalizeEmail(result.payload.email);
    const serviceSupabase = getServiceSupabaseClient();

    try {
      const { data: existing, error } = await serviceSupabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .eq('restaurant_id', result.payload.restaurantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const existingBooking = existing as Tables<'bookings'> | null;

      if (!existingBooking) {
        return NextResponse.json(
          { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
          { status: 404 },
        );
      }

      if (
        !sessionRecoveryTokenMatchesBookingContact({
          payload: result.payload,
          booking: {
            restaurantId: existingBooking.restaurant_id,
            email: existingBooking.customer_email,
            phone: existingBooking.customer_phone,
          },
        })
      ) {
        return NextResponse.json(
          { error: 'You can only cancel your own reservation', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }

      if (isPendingBookingLocked(existingBooking)) {
        return respondWithPendingLock();
      }

      const restaurantId = await requireRestaurantContext(existingBooking.restaurant_id);
      if (existingBooking.status === 'cancelled') {
        return NextResponse.json({ id: bookingId, status: 'cancelled' });
      }

      const schedule = await getRestaurantSchedule(restaurantId, {
        date: existingBooking.booking_date ?? undefined,
        client: serviceSupabase,
      });

      const cancellationLock = evaluateGuestModificationLock({
        booking: existingBooking,
        timezone: schedule.timezone ?? 'Europe/London',
      });

      const cancellationLockedResponse = respondWithGuestModificationLock(cancellationLock);
      if (cancellationLockedResponse) {
        return cancellationLockedResponse;
      }

      const startParts = resolveBookingStart(existingBooking, schedule.timezone ?? 'Europe/London');
      if (startParts) {
        try {
          assertBookingNotInPast(
            schedule.timezone ?? 'Europe/London',
            startParts.bookingDate,
            startParts.startTime,
            {
              graceMinutes: pastTimeGraceMinutes,
            },
          );
        } catch (pastTimeError) {
          if (pastTimeError instanceof PastBookingError) {
            void recordObservabilityEvent({
              source: 'api.bookings',
              eventType: 'booking.past_time.blocked',
              severity: 'warning',
              context: {
                bookingId,
                restaurantId,
                endpoint: 'bookings.delete.session_recovery',
                actorEmail: tokenEmail,
                ...pastTimeError.details,
              },
            });

            return respondWithPastBooking(pastTimeError);
          }
          throw pastTimeError;
        }
      }

      const cancellation = await softCancelBooking(serviceSupabase, bookingId, {
        restaurantId,
      });
      const cancelledRecord = cancellation.booking;
      if (!cancellation.cancelled) {
        return NextResponse.json({ id: bookingId, status: cancelledRecord.status ?? 'cancelled' });
      }
      const cancellationMetadata = {
        restaurant_id: existingBooking.restaurant_id,
        ...buildBookingAuditSnapshot(existingBooking, cancelledRecord),
      } as Json;

      await logAuditEvent(serviceSupabase, {
        action: 'booking.cancelled',
        entity: 'booking',
        entityId: bookingId,
        metadata: cancellationMetadata,
        actor: tokenEmail,
      });

      try {
        await enqueueBookingCancelledSideEffects(
          {
            previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
            cancelled: safeBookingPayload(cancelledRecord),
            restaurantId,
            cancelledBy: 'customer',
          },
          { supabase: serviceSupabase },
        );
      } catch (jobError: unknown) {
        console.error(
          '[bookings][DELETE:id][session-recovery][side-effects]',
          stringifyError(jobError),
        );
      }

      return NextResponse.json({ id: bookingId, status: cancelledRecord.status ?? 'cancelled' });
    } catch (error: unknown) {
      console.error('[bookings][DELETE:id][session-recovery]', stringifyError(error));

      if (typeof error === 'object' && error !== null) {
        const record = error as { code?: string; message?: string };

        if (record.code === '42501') {
          captureServerEvent('booking_cancel_failed', {
            bookingId,
            source: 'api',
            method: 'guest',
            reason: 'cutoff_passed',
          });
          return NextResponse.json(
            {
              error: 'This booking can no longer be cancelled online. Please contact the venue.',
              code: 'CUTOFF_PASSED',
            },
            { status: 403 },
          );
        }
      }

      captureServerEvent('booking_cancel_failed', {
        bookingId,
        source: 'api',
        method: 'guest',
        reason: 'unexpected',
      });
      captureServerException(error, {
        properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
      });
      return NextResponse.json(
        { error: 'Unable to cancel booking', code: 'UNKNOWN' },
        { status: 500 },
      );
    }
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const serviceSupabase = getServiceSupabaseClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const userEmail = user.email.toLowerCase();

  try {
    // Use service client to avoid RLS issues, similar to the GET /api/bookings?me=1 endpoint
    const { data: existing, error } = await serviceSupabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const existingBooking = existing as Tables<'bookings'> | null;

    if (!existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 },
      );
    }

    const normalizedEmail = normalizeEmail(userEmail);

    // Authenticated cancellation requires a booking-bound user id. Guest bookings use sr_access.
    if (!isBookingBoundToAuthenticatedUser(existingBooking, user.id)) {
      return NextResponse.json(
        { error: 'You can only cancel your own reservation', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    if (isPendingBookingLocked(existingBooking)) {
      return respondWithPendingLock();
    }

    const restaurantId = await requireRestaurantContext(existingBooking.restaurant_id);
    if (existingBooking.status === 'cancelled') {
      return NextResponse.json({ id: bookingId, status: 'cancelled', bookings: [] });
    }

    const schedule = await getRestaurantSchedule(restaurantId, {
      date: existingBooking.booking_date ?? undefined,
      client: serviceSupabase,
    });

    const cancellationLock = evaluateGuestModificationLock({
      booking: existingBooking,
      timezone: schedule.timezone ?? 'Europe/London',
    });

    const cancellationLockedResponse = respondWithGuestModificationLock(cancellationLock);
    if (cancellationLockedResponse) {
      return cancellationLockedResponse;
    }

    const startParts = resolveBookingStart(existingBooking, schedule.timezone ?? 'Europe/London');
    if (startParts) {
      try {
        assertBookingNotInPast(
          schedule.timezone ?? 'Europe/London',
          startParts.bookingDate,
          startParts.startTime,
          {
            graceMinutes: pastTimeGraceMinutes,
          },
        );
      } catch (pastTimeError) {
        if (pastTimeError instanceof PastBookingError) {
          void recordObservabilityEvent({
            source: 'api.bookings',
            eventType: 'booking.past_time.blocked',
            severity: 'warning',
            context: {
              bookingId,
              restaurantId,
              endpoint: 'bookings.delete.selfserve',
              actorEmail: normalizedEmail,
              ...pastTimeError.details,
            },
          });

          return respondWithPastBooking(pastTimeError);
        }
        throw pastTimeError;
      }
    }

    const cancellation = await softCancelBooking(serviceSupabase, bookingId, {
      restaurantId,
    });
    const cancelledRecord = cancellation.booking;
    if (!cancellation.cancelled) {
      const bookings = await fetchBookingsForContact(
        tenantSupabase,
        restaurantId,
        userEmail,
        existingBooking.customer_phone,
      );
      return NextResponse.json({
        id: bookingId,
        status: cancelledRecord.status ?? 'cancelled',
        bookings: bookings.map((booking) =>
          toPublicRecoveryBookingDTO(booking as Tables<'bookings'>),
        ),
      });
    }
    const cancellationMetadata = {
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelledRecord),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.cancelled',
      entity: 'booking',
      entityId: bookingId,
      metadata: cancellationMetadata,
      actor: user.email ?? user.id ?? null,
    });

    const targetRestaurantId = restaurantId;
    const bookings = await fetchBookingsForContact(
      tenantSupabase,
      targetRestaurantId,
      userEmail,
      existingBooking.customer_phone,
    );
    const safeBookings = bookings.map((booking) =>
      toPublicRecoveryBookingDTO(booking as Tables<'bookings'>),
    );
    try {
      await enqueueBookingCancelledSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          cancelled: safeBookingPayload(cancelledRecord),
          restaurantId: targetRestaurantId,
          cancelledBy: 'customer',
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError: unknown) {
      console.error('[bookings][DELETE][side-effects]', stringifyError(jobError));
    }

    return NextResponse.json({
      id: bookingId,
      status: cancelledRecord.status ?? 'cancelled',
      bookings: safeBookings,
    });
  } catch (error: unknown) {
    console.error('[bookings][DELETE:id]', stringifyError(error));

    if (typeof error === 'object' && error !== null) {
      const record = error as { code?: string; message?: string };

      if (record.code === '42501') {
        captureServerEvent('booking_cancel_failed', {
          bookingId,
          source: 'api',
          method: 'guest',
          reason: 'cutoff_passed',
        });
        return NextResponse.json(
          {
            error: 'This booking can no longer be cancelled online. Please contact the venue.',
            code: 'CUTOFF_PASSED',
          },
          { status: 403 },
        );
      }
    }

    captureServerEvent('booking_cancel_failed', {
      bookingId,
      source: 'api',
      method: 'guest',
      reason: 'unexpected',
    });
    captureServerException(error, {
      distinctId: user.id,
      properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
    });
    return NextResponse.json(
      { error: 'Unable to cancel booking', code: 'UNKNOWN' },
      { status: 500 },
    );
  }
}
