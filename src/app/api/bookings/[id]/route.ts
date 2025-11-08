import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { HttpError } from "@/lib/http/errors";
import { MAX_ONLINE_PARTY_SIZE, MIN_ONLINE_PARTY_SIZE } from "@/lib/bookings/partySize";
import { GuardError, listUserRestaurantMemberships, requireSession } from "@/server/auth/guards";
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from "@/server/booking";
import { mapValidationFailure, withValidationHeaders } from "@/server/booking/http";
import {
  BOOKING_TYPES,
  SEATING_OPTIONS,
  buildBookingAuditSnapshot,
  clearBookingTableAssignments,
  deriveEndTime,
  fetchBookingsForContact,
  inferMealTypeFromTime,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from "@/server/bookings";
import { beginBookingModificationFlow } from "@/server/bookings/modification-flow";
import { PastBookingError, assertBookingNotInPast } from "@/server/bookings/pastTimeValidation";
import {
  OperatingHoursError,
  type OperatingHoursErrorReason,
  assertBookingWithinOperatingWindow,
} from "@/server/bookings/timeValidation";
import {
  convertIsoToVenueDateTime,
  convertOptionalIsoToVenueDateTime,
} from "@/server/bookings/timezoneConversion";
import { normalizeEmail } from "@/server/customers";
import {
  enqueueBookingCancelledSideEffects,
  enqueueBookingUpdatedSideEffects,
  safeBookingPayload,
} from "@/server/jobs/booking-side-effects";
import { recordObservabilityEvent } from "@/server/observability";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { formatDateForInput } from "@reserve/shared/formatting/booking";

import type { BookingType } from "@/lib/enums";
import type { BookingRecord } from "@/server/bookings";
import type { Json, Tables } from "@/types/supabase";
import type { NextRequest} from "next/server";

const bookingTypeEnum = z.enum(BOOKING_TYPES);

const updateSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1),
  bookingType: bookingTypeEnum,
  seating: z.enum(SEATING_OPTIONS),
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  marketingOptIn: z.coerce.boolean().optional().default(false),
});

// Dashboard update schema for minimal booking updates (used by EditBookingDialog)
const dashboardUpdateSchema = z.object({
  startIso: z.string().datetime(),
  endIso: z.string().datetime().optional(),
  partySize: z.number().int().min(MIN_ONLINE_PARTY_SIZE).max(MAX_ONLINE_PARTY_SIZE),
  notes: z.string().max(500).optional().nullable(),
});


const OPERATING_HOURS_REASON_TO_CODE: Record<OperatingHoursErrorReason, string> = {
  CLOSED: "CLOSED_DATE",
  OUTSIDE_WINDOW: "OUTSIDE_HOURS",
  AFTER_CLOSE: "OUTSIDE_HOURS",
  INVALID_TIME: "INVALID_TIME",
};

function mapOperatingHoursReason(reason: OperatingHoursErrorReason): string {
  return OPERATING_HOURS_REASON_TO_CODE[reason] ?? "OUTSIDE_HOURS";
}

const pendingSelfServeGraceMinutes = env.featureFlags.pendingSelfServeGraceMinutes ?? 10;
const pendingSelfServeGraceWindowMs = Math.max(0, pendingSelfServeGraceMinutes) * 60_000;

function isPendingBookingLocked(booking: Pick<Tables<"bookings">, "status" | "created_at"> | null | undefined): boolean {
  if (!booking || booking.status !== "pending") {
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
  return NextResponse.json(
    {
      error: "This reservation is still pending review and can't be changed yet.",
      code: "PENDING_LOCKED",
    },
    { status: 403 },
  );
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

  if (typeof id === "string") {
    return id;
  }

  if (Array.isArray(id)) {
    return id[0] ?? null;
  }

  return null;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function handleZodError(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Invalid payload",
      details: error.flatten(),
      code: "INVALID_PAYLOAD",
    },
    { status: 400 },
  );
}

type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;

type DashboardActor = {
  id: string;
  email: string | null;
};

async function handleDashboardUpdate(params: {
  bookingId: string;
  data: DashboardUpdateInput;
  existingBooking: Tables<"bookings">;
  actor: DashboardActor;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
}) {
  const { bookingId, data, existingBooking, actor, serviceSupabase } = params;

  if (isPendingBookingLocked(existingBooking)) {
    return respondWithPendingLock();
  }

  try {
    const startInstant = new Date(data.startIso);
    if (Number.isNaN(startInstant.getTime())) {
      return NextResponse.json({ error: "Invalid date values", code: "INVALID_DATE" }, { status: 400 });
    }

    const restaurantId = existingBooking.restaurant_id ?? (await getDefaultRestaurantId());
    const initialSchedule = await getRestaurantSchedule(restaurantId, {
      date: formatDateForInput(startInstant),
      client: serviceSupabase,
    });
    const initialScheduleTimezone = initialSchedule.timezone ?? "Europe/London";

    let startVenue;
    try {
      startVenue = convertIsoToVenueDateTime(data.startIso, initialScheduleTimezone);
    } catch (conversionError) {
      const message = conversionError instanceof Error ? conversionError.message : "Invalid date values";
      return NextResponse.json({ error: message, code: "INVALID_DATE" }, { status: 400 });
    }

    let schedule = startVenue.date === initialSchedule.date
      ? initialSchedule
      : await getRestaurantSchedule(restaurantId, {
          date: startVenue.date,
          client: serviceSupabase,
        });
    const scheduleTimezone = schedule.timezone ?? initialScheduleTimezone;

    const explicitEndVenue = convertOptionalIsoToVenueDateTime(data.endIso, scheduleTimezone);
    const existingStartVenue = convertOptionalIsoToVenueDateTime(existingBooking.start_at, scheduleTimezone);
    const existingEndVenue = convertOptionalIsoToVenueDateTime(existingBooking.end_at, scheduleTimezone);

    const existingDurationMinutes =
      existingStartVenue && existingEndVenue
        ? Math.max(1, Math.round(existingEndVenue.dateTime.diff(existingStartVenue.dateTime, "minutes").minutes ?? 0))
        : null;

    let bookingDate = startVenue.date;
    let startTime = startVenue.time;

    const previousBookingDate = existingBooking.booking_date ?? null;
    const previousStartTime = existingBooking.start_time ?? null;
    const isTimeChanged = bookingDate !== previousBookingDate || startTime !== previousStartTime;

    const needsScheduleForDuration = isTimeChanged || !explicitEndVenue;
    const needsScheduleForPastCheck = env.featureFlags.bookingPastTimeBlocking && isTimeChanged;

    let normalizedStartDateTime = startVenue.dateTime.set({ second: 0, millisecond: 0 });

    try {
      const bookingType = (existingBooking.booking_type ?? "dinner") as BookingType;
      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: startTime,
        bookingType,
      });
      startTime = time;
      normalizedStartDateTime = normalizedStartDateTime.set({
        hour: Number.parseInt(time.slice(0, 2), 10),
        minute: Number.parseInt(time.slice(3, 5), 10),
      });
      bookingDate = normalizedStartDateTime.toISODate() ?? bookingDate;
    } catch (validationError) {
      if (validationError instanceof OperatingHoursError) {
        return NextResponse.json(
          { error: validationError.message, code: mapOperatingHoursReason(validationError.reason) },
          { status: 400 },
        );
      }
      throw validationError;
    }

    if ((needsScheduleForDuration || needsScheduleForPastCheck) && schedule.date !== bookingDate) {
      schedule = await getRestaurantSchedule(restaurantId, {
        date: bookingDate,
        client: serviceSupabase,
      });
    }

    if (needsScheduleForPastCheck) {
      try {
        assertBookingNotInPast(
          schedule.timezone ?? scheduleTimezone,
          bookingDate,
          startTime,
          {
            graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
          },
        );
      } catch (pastTimeError) {
        if (pastTimeError instanceof PastBookingError) {
          void recordObservabilityEvent({
            source: "api.bookings",
            eventType: "booking.past_time.blocked",
            severity: "warning",
            context: {
              bookingId,
              restaurantId: existingBooking.restaurant_id,
              endpoint: "bookings.update.dashboard",
              actorId: actor.id,
              actorEmail: actor.email,
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

    const scheduleDuration =
      typeof schedule.defaultDurationMinutes === "number" && schedule.defaultDurationMinutes > 0
        ? schedule.defaultDurationMinutes
        : null;
    const configuredDuration = scheduleDuration ?? null;
    const fallbackDuration =
      existingDurationMinutes && existingDurationMinutes > 0
        ? existingDurationMinutes
        : env.reserve.defaultDurationMinutes ?? 90;

    let durationMinutes: number;
    let endDateTime = normalizedStartDateTime;

    if (isTimeChanged) {
      const enforcedDuration = configuredDuration ?? fallbackDuration;
      durationMinutes = enforcedDuration > 0 ? enforcedDuration : 90;
      endDateTime = normalizedStartDateTime.plus({ minutes: durationMinutes });
    } else if (explicitEndVenue) {
      endDateTime = explicitEndVenue.dateTime;
      durationMinutes = Math.max(
        1,
        Math.round(explicitEndVenue.dateTime.diff(normalizedStartDateTime, "minutes").minutes ?? 0),
      );
    } else if (existingEndVenue) {
      endDateTime = existingEndVenue.dateTime;
      durationMinutes = fallbackDuration > 0 ? fallbackDuration : 90;
    } else {
      const inferredDuration = configuredDuration ?? fallbackDuration;
      durationMinutes = inferredDuration > 0 ? inferredDuration : 90;
      endDateTime = normalizedStartDateTime.plus({ minutes: durationMinutes });
    }

    if (endDateTime.toMillis() <= normalizedStartDateTime.toMillis()) {
    return NextResponse.json({ error: "End time must be after start time", code: "INVALID_TIME_RANGE" }, { status: 400 });
    }

    const endTime = endDateTime.set({ second: 0, millisecond: 0 }).toFormat("HH:mm");
    const resolvedScheduleTz = schedule.timezone ?? scheduleTimezone;
    const requiresTableRealignment =
      bookingDate !== (existingBooking.booking_date ?? "") ||
      startTime !== (existingBooking.start_time ?? "") ||
      endTime !== (existingBooking.end_time ?? "") ||
      data.partySize !== (existingBooking.party_size ?? 0);
    const normalizedNotes = data.notes ?? null;

    const useUnifiedValidation = env.featureFlags.bookingValidationUnified;
    let updated: Tables<"bookings">;

    if (useUnifiedValidation) {
      const validationService = createBookingValidationService({ client: serviceSupabase });

      const loyaltyPointsAwarded =
        (existingBooking as { loyalty_points_awarded?: number | null }).loyalty_points_awarded ?? null;

      const bookingInput: BookingInput = {
        restaurantId,
        serviceId: existingBooking.booking_type ?? "dinner",
        bookingType: existingBooking.booking_type ?? undefined,
        bookingId,
        partySize: data.partySize,
        start: `${bookingDate}T${startTime}:00`,
        durationMinutes,
        seatingPreference: existingBooking.seating_preference ?? null,
        notes: data.notes ?? existingBooking.notes ?? null,
        customerId: existingBooking.customer_id ?? null,
        customerName: existingBooking.customer_name ?? "",
        customerEmail: existingBooking.customer_email ?? null,
        customerPhone: existingBooking.customer_phone ?? null,
        marketingOptIn: existingBooking.marketing_opt_in ?? false,
        source: existingBooking.source ?? null,
        idempotencyKey: existingBooking.idempotency_key ?? null,
        loyaltyPointsAwarded,
      };

      const context = {
        actorId: actor.id,
        actorRoles: ["dashboard"],
        actorCapabilities: [],
        tz: resolvedScheduleTz ?? "Europe/London",
        flags: {
          bookingPastTimeBlocking: env.featureFlags.bookingPastTimeBlocking ?? false,
          bookingPastTimeGraceMinutes: env.featureFlags.bookingPastTimeGraceMinutes ?? 5,
          unified: true,
        },
        metadata: {
          clientRequestId: existingBooking.client_request_id ?? undefined,
        },
      } satisfies ValidationContext;

      try {
        const commit = await validationService.updateWithEnforcement(
          existingBooking as unknown as BookingRecord,
          bookingInput,
          context,
        );
        updated = commit.booking as unknown as Tables<"bookings">;
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
        source: "guest",
        payload: {
          restaurant_id: restaurantId,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          party_size: data.partySize,
          notes: normalizedNotes,
        },
      });
    } else {
      updated = await updateBookingRecord(serviceSupabase, bookingId, {
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        party_size: data.partySize,
        notes: normalizedNotes,
        booking_type: existingBooking.booking_type,
        seating_preference: existingBooking.seating_preference,
        customer_name: existingBooking.customer_name,
        customer_email: existingBooking.customer_email,
        customer_phone: existingBooking.customer_phone,
        marketing_opt_in: existingBooking.marketing_opt_in,
      });
    }

    const targetRestaurantId =
      updated.restaurant_id ?? existingBooking.restaurant_id ?? (await getDefaultRestaurantId());

    const auditMetadata = {
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      restaurant_id: targetRestaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: actor.email ?? actor.id ?? existingBooking.customer_email ?? "dashboard",
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: targetRestaurantId,
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError: unknown) {
      console.error("[bookings][PUT:dashboard][side-effects]", stringifyError(jobError));
    }

    const responseIntervalMinutes =
      schedule && typeof schedule.intervalMinutes === "number"
        ? schedule.intervalMinutes
        : null;

    const bookingDTO = {
      id: updated.id,
      restaurantName: "Unknown",
      partySize: updated.party_size,
      startIso: updated.start_at,
      endIso: updated.end_at,
      status: updated.status as "pending" | "pending_allocation" | "confirmed" | "cancelled",
      notes: updated.notes,
      reservationIntervalMinutes: responseIntervalMinutes,
    };

    const responseInit = useUnifiedValidation ? withValidationHeaders({ status: 200 }) : { status: 200 };

    return NextResponse.json(bookingDTO, responseInit);
  } catch (error: unknown) {
    console.error("[bookings][PUT:dashboard]", stringifyError(error));
    return NextResponse.json({ error: stringifyError(error) || "Unable to update booking", code: "UNKNOWN" }, { status: 500 });
  }
}

function respondWithGuardError(error: GuardError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      details: error.details ?? null,
    },
    { status: error.status },
  );
}

async function processDashboardUpdate(bookingId: string, data: DashboardUpdateInput) {
  const { supabase, user } = await requireSession();
  const actor: DashboardActor = { id: user.id, email: user.email ?? null };

  const { data: tenantBooking, error: tenantError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (tenantError) {
    throw new GuardError({
      status: 500,
      code: "BOOKING_LOOKUP_FAILED",
      message: "Unable to load booking",
      details: tenantError,
      cause: tenantError,
    });
  }

  if (tenantBooking) {
    return handleDashboardUpdate({
      bookingId,
      data,
      existingBooking: tenantBooking as Tables<"bookings">,
      actor,
      serviceSupabase: getServiceSupabaseClient(),
    });
  }

  const memberships = await listUserRestaurantMemberships(supabase, user.id);

  if (memberships.length === 0) {
    throw new GuardError({
      status: 403,
      code: "FORBIDDEN",
      message: "You do not have permission to modify bookings",
    });
  }

  const membershipIds = new Set(
    memberships
      .map((membership) => membership.restaurant_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const serviceSupabase = getServiceSupabaseClient();
  const { data: serviceBooking, error: serviceError } = await serviceSupabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (serviceError) {
    throw new GuardError({
      status: 500,
      code: "BOOKING_LOOKUP_FAILED",
      message: "Unable to load booking",
      details: serviceError,
      cause: serviceError,
    });
  }

  if (!serviceBooking) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  const bookingRecord = serviceBooking as Tables<"bookings">;
  const restaurantId = bookingRecord.restaurant_id;

  if (!restaurantId || !membershipIds.has(restaurantId)) {
    throw new GuardError({
      status: 403,
      code: "FORBIDDEN",
      message: "You do not have permission to modify this booking",
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
    return NextResponse.json({ error: "Missing booking id", code: "MISSING_BOOKING_ID" }, { status: 400 });
  }

  // Require authentication to view booking details
  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const { data: { user }, error: authError } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const normalizedUserEmail = normalizeEmail(user.email);

  try {
    // Use service client to bypass RLS and check ownership manually
    const serviceSupabase = getServiceSupabaseClient();
    const { data, error } = await serviceSupabase
      .from("bookings")
      .select(
        "id,restaurant_id,booking_date,start_time,end_time,start_at,end_at,reference,party_size,booking_type,seating_preference,status,customer_name,customer_email,customer_phone,notes,marketing_opt_in,loyalty_points_awarded,client_request_id,pending_ref,idempotency_key,details,created_at,updated_at",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
    return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
    }

    // Verify ownership: user email must match booking email
    if (data.customer_email !== normalizedUserEmail) {
      // Log unauthorized access attempt
      void recordObservabilityEvent({
        source: "api.bookings",
        eventType: "booking_details.access_denied",
        severity: "warning",
        context: {
          booking_id: bookingId,
          user_email: normalizedUserEmail,
          booking_email: data.customer_email,
        },
      });

      return NextResponse.json(
        { error: "You can only view your own bookings", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json({ booking: data });
  } catch (error: unknown) {
    console.error("[bookings][GET:id]", stringifyError(error));
    return NextResponse.json({ error: stringifyError(error) || "Unable to load booking", code: "UNKNOWN" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id", code: "MISSING_BOOKING_ID" }, { status: 400 });
  }
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload", code: "INVALID_JSON" }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  // Try dashboard format first (minimal update from EditBookingDialog)
  const dashboardParsed = dashboardUpdateSchema.safeParse(body);
  
  if (dashboardParsed.success) {
    try {
      return await processDashboardUpdate(bookingId, dashboardParsed.data);
    } catch (error) {
      if (error instanceof GuardError) {
        return respondWithGuardError(error);
      }
      console.error("[bookings][PUT:dashboard] unexpected failure", stringifyError(error));
      return NextResponse.json({ error: "Unable to update booking", code: "UNKNOWN" }, { status: 500 });
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

  try {
    const { data: existing, error } = await tenantSupabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const existingBooking = existing as Tables<"bookings"> | null;

    if (!existingBooking) {
      return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
    }

    if (isPendingBookingLocked(existingBooking)) {
      return respondWithPendingLock();
    }

    const {
      data: { user },
      error: authError,
    } = await tenantSupabase.auth.getUser();

    if (authError) {
      console.error('[bookings][PUT:id] auth resolution failed', authError.message);
    }

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = data.phone.trim();

    if (existingBooking.customer_email !== normalizedEmail || existingBooking.customer_phone !== normalizedPhone) {
      return NextResponse.json({ error: "You can only update your own reservation", code: "FORBIDDEN" }, { status: 403 });
    }

    const restaurantId = data.restaurantId ?? existingBooking.restaurant_id ?? await getDefaultRestaurantId();
    const normalizedBookingType = data.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(data.time);

    let startTime = data.time;

    try {
      const schedule = await getRestaurantSchedule(restaurantId, {
        date: data.date,
        client: serviceSupabase,
      });

      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
        bookingType: normalizedBookingType,
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

    const endTime = deriveEndTime(startTime, normalizedBookingType);

    const requiresTableRealignment =
      existingBooking.booking_date !== data.date ||
      existingBooking.start_time !== startTime ||
      existingBooking.end_time !== endTime ||
      existingBooking.party_size !== data.party ||
      existingBooking.seating_preference !== data.seating;

    const updated: Tables<"bookings"> = requiresTableRealignment
      ? await beginBookingModificationFlow({
          client: serviceSupabase,
          bookingId,
          existingBooking,
          source: "guest",
          payload: {
            restaurant_id: restaurantId,
            booking_date: data.date,
            start_time: startTime,
            end_time: endTime,
            party_size: data.party,
            booking_type: normalizedBookingType,
            seating_preference: data.seating,
            customer_name: data.name,
            customer_email: normalizedEmail,
            customer_phone: normalizedPhone,
            notes: data.notes ?? null,
            marketing_opt_in: data.marketingOptIn ?? existingBooking.marketing_opt_in,
          },
        })
      : await updateBookingRecord(serviceSupabase, bookingId, {
          restaurant_id: restaurantId,
          booking_date: data.date,
          start_time: startTime,
          end_time: endTime,
          party_size: data.party,
          booking_type: normalizedBookingType,
          seating_preference: data.seating,
          customer_name: data.name,
          customer_email: normalizedEmail,
          customer_phone: normalizedPhone,
          notes: data.notes ?? null,
          marketing_opt_in: data.marketingOptIn ?? existingBooking.marketing_opt_in,
        });

    const auditMetadata = {
      restaurant_id: restaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    const actorIdentity = user?.email ?? user?.id ?? data.email ?? existingBooking.customer_email ?? null;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: actorIdentity,
    });

    const bookings = await fetchBookingsForContact(tenantSupabase, restaurantId, data.email, data.phone);
    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId,
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError: unknown) {
      console.error("[bookings][PUT:id][side-effects]", stringifyError(jobError));
    }

    return NextResponse.json({ booking: updated, bookings });
  } catch (error: unknown) {
    console.error("[bookings][PUT:id]", stringifyError(error));
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: stringifyError(error) || "Unable to update booking", code: "UNKNOWN" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id", code: "MISSING_BOOKING_ID" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const serviceSupabase = getServiceSupabaseClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const userEmail = user.email.toLowerCase();

  try {
    // Use service client to avoid RLS issues, similar to the GET /api/bookings?me=1 endpoint
    const { data: existing, error } = await serviceSupabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const existingBooking = existing as Tables<"bookings"> | null;

    if (!existingBooking) {
      return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
    }

    const normalizedEmail = normalizeEmail(userEmail);

    // Verify the booking belongs to the authenticated user
    if (existingBooking.customer_email !== normalizedEmail) {
      return NextResponse.json({ error: "You can only cancel your own reservation", code: "FORBIDDEN" }, { status: 403 });
    }

    if (isPendingBookingLocked(existingBooking)) {
      return respondWithPendingLock();
    }

    const cancelledRecord = await softCancelBooking(serviceSupabase, bookingId);
    await clearBookingTableAssignments(serviceSupabase, bookingId);

    const cancellationMetadata = {
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelledRecord),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.cancelled",
      entity: "booking",
      entityId: bookingId,
      metadata: cancellationMetadata,
      actor: user.email ?? user.id ?? null,
    });

    const targetRestaurantId = existingBooking.restaurant_id ?? await getDefaultRestaurantId();
    const bookings = await fetchBookingsForContact(tenantSupabase, targetRestaurantId, userEmail, existingBooking.customer_phone);
    try {
      await enqueueBookingCancelledSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          cancelled: safeBookingPayload(cancelledRecord),
          restaurantId: targetRestaurantId,
          cancelledBy: "customer",
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError: unknown) {
      console.error("[bookings][DELETE][side-effects]", stringifyError(jobError));
    }

    return NextResponse.json({ success: true, bookings });
  } catch (error: unknown) {
    console.error("[bookings][DELETE:id]", stringifyError(error));

    if (typeof error === "object" && error !== null) {
      const record = error as { code?: string; message?: string };

      if (record.code === "42501") {
        return NextResponse.json(
          {
            error: "This booking can no longer be cancelled online. Please contact the venue.",
            code: "CUTOFF_PASSED",
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ error: stringifyError(error) || "Unable to cancel booking", code: "UNKNOWN" }, { status: 500 });
  }
}
