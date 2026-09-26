import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, conflict, internalError, validationError } from '@/lib/api/errors';
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { isBookingType } from '@/lib/enums';
import { env } from '@/lib/env';
import { HttpError } from '@/lib/http/errors';
import { logger } from '@/lib/logger';
import { captureServerEvent, captureServerException } from '@/lib/posthog/server';
import { GuardError, listUserRestaurantMemberships } from '@/server/auth/guards';
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
  inferMealTypeFromTime,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from '@/server/bookings';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import {
  finalizeGuestAccessResponse,
  guestAccessJson,
  resolveGuestBookingAccess,
  type GuestBookingAccess,
} from '@/server/bookings/guest-booking-access';
import { toGuestAccessBookingDTO } from '@/server/bookings/guest-booking-dto';
import {
  buildBookingInstantFields,
  buildBookingInstantFieldsFromLocalTimes,
} from '@/server/bookings/instant-fields';
import {
  beginBookingModificationFlow,
  bookingModificationConflictResponse,
  isBookingModificationConflictError,
} from '@/server/bookings/modification-flow';
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
import { normalizeEmail, normalizePhone } from '@/server/customers';
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
import { validateCsrfToken } from '@/server/security/csrf';
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
  // Contact details are immutable for guests (they bind the booking's access
  // links). They may be omitted; when sent they must equal the stored values.
  email: z.string().email().optional(),
  phone: z
    .string()
    .min(CUSTOMER_PHONE_LENGTH_MIN)
    .max(CUSTOMER_PHONE_LENGTH_MAX)
    .refine((value) => isUKPhone(value), {
      message: 'Please enter a valid UK phone number.',
    })
    .optional(),
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

const BOOKING_NOT_CANCELLABLE_CODE = 'BOOKING_NOT_CANCELLABLE';
const BOOKING_NOT_CANCELLABLE_MESSAGE = 'This booking can no longer be cancelled.';

function respondWithPastBooking(error: PastBookingError) {
  return apiError(422, error.code, error.message, { details: error.details });
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
    } catch {
      logger.warn('bookings.start_resolution_failed', {});
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

function respondWithPendingLock() {
  return apiError(
    403,
    'PENDING_LOCKED',
    "This reservation is still pending review and can't be changed yet.",
  );
}

function respondWithCancelledBookingLock() {
  return apiError(
    409,
    'BOOKING_CANCELLED',
    'This reservation has already been cancelled and can no longer be changed.',
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

  return apiError(403, lock.code, lock.message);
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

type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;

/**
 * Who is changing the booking:
 * - `staff`: a member of the booking's restaurant (no guest time lock);
 * - `session`: a signed-in guest who owns the booking;
 * - `guest_link`: the holder of the booking's access cookie (no identity).
 */
type UpdateActor =
  | { kind: 'staff'; id: string; email: string | null }
  | { kind: 'session'; id: string }
  | { kind: 'guest_link' };

function actorUserId(actor: UpdateActor): string | null {
  return actor.kind === 'guest_link' ? null : actor.id;
}

function actorValidationId(actor: UpdateActor): string {
  return actor.kind === 'guest_link' ? 'guest-link' : actor.id;
}

function auditActorLabel(actor: UpdateActor): string {
  switch (actor.kind) {
    case 'staff':
      return actor.email ?? actor.id;
    case 'session':
      return actor.id;
    case 'guest_link':
      return 'guest-link';
    default: {
      const exhaustive: never = actor;
      return String(exhaustive);
    }
  }
}

function actorForAccess(access: GuestBookingAccess): UpdateActor {
  return access.kind === 'token' ? { kind: 'guest_link' } : { kind: 'session', id: access.userId };
}

async function handleDashboardUpdate(params: {
  bookingId: string;
  data: DashboardUpdateInput;
  existingBooking: Tables<'bookings'>;
  actor: UpdateActor;
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
      return apiError(400, 'INVALID_DATE', 'Invalid date values.');
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
    } catch {
      return apiError(400, 'INVALID_DATE', 'Invalid date values.');
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
        return apiError(
          400,
          mapOperatingHoursReason(validationError.reason),
          validationError.message,
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
            actorKind: actor.kind,
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
      return apiError(400, 'INVALID_TIME_RANGE', 'End time must be after start time.');
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
        actorId: actorValidationId(actor),
        actorRoles: actor.kind === 'staff' ? ['dashboard'] : ['guest'],
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
        // Checked first: a refused modification also extends BookingValidationError.
        if (isBookingModificationConflictError(error)) {
          return bookingModificationConflictResponse(error);
        }
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
      actor_user_id: actorUserId(actor),
      actor_email: actor.kind === 'staff' ? actor.email : null,
      restaurant_id: targetRestaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.updated',
      entity: 'booking',
      entityId: bookingId,
      metadata: auditMetadata,
      actor: auditActorLabel(actor),
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
      logger.warn('bookings.update.side_effects_failed', {
        bookingId,
        errorName: jobError instanceof Error ? jobError.name : typeof jobError,
      });
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
      booking: toGuestAccessBookingDTO(
        {
          ...updated,
          start_at: instantFields.start_at,
          end_at: instantFields.end_at,
        },
        { kind: actor.kind === 'guest_link' ? 'token' : 'session' },
        { timezone: resolvedScheduleTz },
      ),
    };

    const responseInit = useUnifiedValidation
      ? withValidationHeaders({ status: 200 })
      : { status: 200 };

    return NextResponse.json(bookingDTO, responseInit);
  } catch (error: unknown) {
    if (isBookingModificationConflictError(error)) {
      captureServerEvent('booking_modify_failed', {
        bookingId,
        source: 'api',
        method: 'guest',
        code: error.code,
        status: error.status,
      });
      return bookingModificationConflictResponse(error);
    }
    captureServerEvent('booking_modify_failed', {
      bookingId,
      source: 'api',
      method: 'guest',
      reason: 'unexpected',
    });
    captureServerException(error, {
      properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
    });
    if (error instanceof HttpError) {
      return apiError(error.status, error.code, error.message);
    }
    return internalError(error, { route: 'bookings.[id].PUT', bookingId });
  }
}

function respondWithGuardError(error: GuardError) {
  if (error.status >= 500) {
    return apiError(error.status, error.code, 'Something went wrong on our side. Try again.');
  }
  return apiError(error.status, error.code, error.message);
}

type StaffUpdateContext = {
  booking: Tables<'bookings'>;
  actor: Extract<UpdateActor, { kind: 'staff' }>;
};

/**
 * Staff precedence (§5.3): a signed-in member of the booking's restaurant
 * always takes the staff path, whatever guest cookies the browser carries.
 * Returns `null` for everyone else, who then goes through the guest resolver.
 */
async function resolveStaffUpdateContext(bookingId: string): Promise<StaffUpdateContext | null> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const memberships = await listUserRestaurantMemberships(supabase, user.id);
  const membershipIds = new Set(
    memberships
      .map((membership) => membership.restaurant_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  if (membershipIds.size === 0) {
    return null;
  }

  const { data, error } = await getServiceSupabaseClient()
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    throw new GuardError({
      status: 500,
      code: 'BOOKING_LOOKUP_FAILED',
      message: 'Unable to load booking',
      cause: error,
    });
  }

  const booking = (data ?? null) as Tables<'bookings'> | null;
  if (!booking?.restaurant_id || !membershipIds.has(booking.restaurant_id)) {
    return null;
  }

  return { booking, actor: { kind: 'staff', id: user.id, email: user.email ?? null } };
}

function missingBookingIdResponse() {
  return apiError(400, 'MISSING_BOOKING_ID', 'Missing booking id.');
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);
  if (!bookingId) {
    return missingBookingIdResponse();
  }

  const resolution = await resolveGuestBookingAccess(req, bookingId, { op: 'read' });
  if (!resolution.ok) {
    return resolution.response;
  }

  try {
    const { data: restaurant, error: restaurantError } = await getServiceSupabaseClient()
      .from('restaurants')
      .select('name, slug, timezone')
      .eq('id', resolution.booking.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      logger.warn('bookings.get.restaurant_lookup_failed', { bookingId });
    }

    return guestAccessJson(
      req,
      bookingId,
      resolution,
      {
        booking: toGuestAccessBookingDTO(resolution.booking, resolution.access, restaurant ?? null),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    return finalizeGuestAccessResponse(
      req,
      internalError(error, { route: 'bookings.[id].GET', bookingId }),
      { bookingId, clearCookie: resolution.clearCookie },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);
  if (!bookingId) {
    return missingBookingIdResponse();
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Invalid JSON payload.');
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  captureServerEvent('booking_modify_started', {
    bookingId,
    source: 'api',
    method: 'guest',
  });

  // Dashboard format first (minimal update from EditBookingDialog).
  const dashboardParsed = dashboardUpdateSchema.safeParse(body);

  if (dashboardParsed.success) {
    if (!validateCsrfToken(req)) {
      return apiError(403, 'CSRF_INVALID', 'Refresh the page and try again.');
    }

    try {
      const staff = await resolveStaffUpdateContext(bookingId);
      if (staff) {
        return await handleDashboardUpdate({
          bookingId,
          data: dashboardParsed.data,
          existingBooking: staff.booking,
          actor: staff.actor,
          serviceSupabase: getServiceSupabaseClient(),
        });
      }
    } catch (error) {
      if (error instanceof GuardError) {
        return respondWithGuardError(error);
      }
      return internalError(error, { route: 'bookings.[id].PUT', bookingId });
    }

    const resolution = await resolveGuestBookingAccess(req, bookingId, { op: 'update' });
    if (!resolution.ok) {
      return resolution.response;
    }

    const response = await handleDashboardUpdate({
      bookingId,
      data: dashboardParsed.data,
      existingBooking: resolution.booking,
      actor: actorForAccess(resolution.access),
      serviceSupabase: getServiceSupabaseClient(),
      enforceGuestSelfServiceLock: true,
    });
    return finalizeGuestAccessResponse(req, response, {
      bookingId,
      clearCookie: resolution.clearCookie,
    });
  }

  // Full update schema (the reservation wizard's edit mode).
  const parsed = updateSchema.safeParse({
    ...body,
    party: Number(body.party ?? 0),
    email: body.email === '' || body.email === null ? undefined : body.email,
    phone: body.phone === '' || body.phone === null ? undefined : body.phone,
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const resolution = await resolveGuestBookingAccess(req, bookingId, { op: 'update' });
  if (!resolution.ok) {
    return resolution.response;
  }

  const finalize = (response: NextResponse) =>
    finalizeGuestAccessResponse(req, response, {
      bookingId,
      clearCookie: resolution.clearCookie,
    });

  const data = parsed.data;
  const serviceSupabase = getServiceSupabaseClient();
  const existingBooking = resolution.booking;
  const actor = actorForAccess(resolution.access);

  try {
    if (
      data.restaurantId &&
      existingBooking.restaurant_id &&
      data.restaurantId !== existingBooking.restaurant_id
    ) {
      return finalize(
        apiError(
          403,
          'RESTAURANT_LOCKED',
          'You cannot move this reservation to another restaurant.',
        ),
      );
    }

    if (existingBooking.status === 'cancelled') {
      return finalize(respondWithCancelledBookingLock());
    }

    if (isPendingBookingLocked(existingBooking)) {
      return finalize(respondWithPendingLock());
    }

    const emailChanged =
      data.email !== undefined &&
      normalizeEmail(data.email) !== normalizeEmail(existingBooking.customer_email);
    const phoneChanged =
      data.phone !== undefined &&
      normalizePhone(data.phone) !== normalizePhone(existingBooking.customer_phone);
    if (emailChanged || phoneChanged) {
      return finalize(
        apiError(
          422,
          'CONTACT_CHANGE_NOT_ALLOWED',
          'Contact details can’t be changed online. Ask the venue to update them.',
          {
            fields: emailChanged
              ? { email: ['Contact the venue to change this.'] }
              : { phone: ['Contact the venue to change this.'] },
          },
        ),
      );
    }

    // The stored contact is always written back: guests cannot change it.
    const storedEmail = existingBooking.customer_email;
    const storedPhone = existingBooking.customer_phone;
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
        return finalize(lockedResponse);
      }

      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
      });

      startTime = time;
    } catch (validationFailure) {
      if (validationFailure instanceof OperatingHoursError) {
        return finalize(
          apiError(
            400,
            mapOperatingHoursReason(validationFailure.reason),
            validationFailure.message,
          ),
        );
      }
      throw validationFailure;
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
            actorKind: actor.kind,
            ...pastTimeError.details,
          },
        });

        return finalize(respondWithPastBooking(pastTimeError));
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
      phone: storedPhone ?? '',
      source: 'guest_reserve',
    });

    const updatePayload = {
      restaurant_id: restaurantId,
      booking_date: data.date,
      start_time: startTime,
      end_time: endTime,
      ...instantFields,
      party_size: data.party,
      booking_type: normalizedBookingType,
      seating_preference: existingBooking.seating_preference,
      customer_name: data.name,
      customer_email: storedEmail,
      customer_phone: storedPhone,
      ...whatsappConsentPatch,
      notes: data.notes ?? null,
      marketing_opt_in: data.marketingOptIn ?? existingBooking.marketing_opt_in,
    };

    const updated: Tables<'bookings'> = requiresTableRealignment
      ? await beginBookingModificationFlow({
          client: serviceSupabase,
          bookingId,
          existingBooking,
          source: 'guest',
          payload: updatePayload,
        })
      : await updateBookingRecord(serviceSupabase, bookingId, updatePayload, { restaurantId });

    const auditMetadata = {
      actor_user_id: actorUserId(actor),
      restaurant_id: restaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.updated',
      entity: 'booking',
      entityId: bookingId,
      metadata: auditMetadata,
      actor: auditActorLabel(actor),
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
      logger.warn('bookings.update.side_effects_failed', {
        bookingId,
        errorName: jobError instanceof Error ? jobError.name : typeof jobError,
      });
    }

    return finalize(
      NextResponse.json({ booking: toGuestAccessBookingDTO(updated, resolution.access) }),
    );
  } catch (error: unknown) {
    if (isBookingModificationConflictError(error)) {
      captureServerEvent('booking_modify_failed', {
        bookingId,
        source: 'api',
        method: 'guest',
        code: error.code,
        status: error.status,
      });
      return finalize(bookingModificationConflictResponse(error));
    }
    captureServerEvent('booking_modify_failed', {
      bookingId,
      source: 'api',
      method: 'guest',
      ...(error instanceof HttpError
        ? { code: error.code, status: error.status }
        : { reason: 'unexpected' }),
    });
    if (error instanceof HttpError) {
      return finalize(apiError(error.status, error.code, error.message));
    }

    captureServerException(error, {
      properties: { bookingId, source: 'api', path: '/api/bookings/[id]' },
    });
    return finalize(internalError(error, { route: 'bookings.[id].PUT', bookingId }));
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);
  if (!bookingId) {
    return missingBookingIdResponse();
  }

  captureServerEvent('booking_cancel_started', {
    bookingId,
    source: 'api',
    method: 'guest',
  });

  const resolution = await resolveGuestBookingAccess(req, bookingId, { op: 'cancel' });
  if (!resolution.ok) {
    return resolution.response;
  }

  const finalize = (response: NextResponse) =>
    finalizeGuestAccessResponse(req, response, {
      bookingId,
      clearCookie: resolution.clearCookie,
    });

  const serviceSupabase = getServiceSupabaseClient();
  const existingBooking = resolution.booking;
  const actor = actorForAccess(resolution.access);

  try {
    if (isPendingBookingLocked(existingBooking)) {
      return finalize(respondWithPendingLock());
    }

    const restaurantId = await requireRestaurantContext(existingBooking.restaurant_id);
    if (existingBooking.status === 'cancelled') {
      return finalize(NextResponse.json({ id: bookingId, status: 'cancelled' }));
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
      return finalize(cancellationLockedResponse);
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
              actorKind: actor.kind,
              ...pastTimeError.details,
            },
          });

          return finalize(respondWithPastBooking(pastTimeError));
        }
        throw pastTimeError;
      }
    }

    const cancellation = await softCancelBooking(serviceSupabase, bookingId, {
      restaurantId,
    });
    const cancelledRecord = cancellation.booking;
    if (!cancellation.cancelled) {
      return finalize(
        NextResponse.json({ id: bookingId, status: cancelledRecord.status ?? 'cancelled' }),
      );
    }

    const cancellationMetadata = {
      actor_user_id: actorUserId(actor),
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelledRecord),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: 'booking.cancelled',
      entity: 'booking',
      entityId: bookingId,
      metadata: cancellationMetadata,
      actor: auditActorLabel(actor),
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
      logger.warn('bookings.cancel.side_effects_failed', {
        bookingId,
        errorName: jobError instanceof Error ? jobError.name : typeof jobError,
      });
    }

    return finalize(
      NextResponse.json({ id: bookingId, status: cancelledRecord.status ?? 'cancelled' }),
    );
  } catch (error: unknown) {
    const errorCode =
      typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;

    if (errorCode === '42501') {
      captureServerEvent('booking_cancel_failed', {
        bookingId,
        source: 'api',
        method: 'guest',
        reason: 'cutoff_passed',
      });
      return finalize(
        apiError(
          403,
          'CUTOFF_PASSED',
          'This booking can no longer be cancelled online. Please contact the venue.',
        ),
      );
    }

    // softCancelBooking's DB guard: checked in, completed or no-show (BookingNotCancellableError).
    if (errorCode === BOOKING_NOT_CANCELLABLE_CODE) {
      const currentStatus = (error as { currentStatus?: unknown }).currentStatus;
      captureServerEvent('booking_cancel_failed', {
        bookingId,
        source: 'api',
        method: 'guest',
        reason: 'not_cancellable',
      });
      return finalize(
        conflict(BOOKING_NOT_CANCELLABLE_CODE, BOOKING_NOT_CANCELLABLE_MESSAGE, {
          retryable: false,
          details: { currentStatus: typeof currentStatus === 'string' ? currentStatus : null },
        }),
      );
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
    if (error instanceof HttpError) {
      return finalize(apiError(error.status, error.code, error.message));
    }
    return finalize(internalError(error, { route: 'bookings.[id].DELETE', bookingId }));
  }
}
