import { NextResponse } from "next/server";
import { z } from "zod";


import { env } from "@/lib/env";
import { isRestaurantAdminRole, type RestaurantRole } from "@/lib/owner/auth/roles";
import {
  createBookingValidationService,
  BookingValidationError,
  type BookingInput,
  type ValidationContext,
} from "@/server/booking";
import { mapValidationFailure, withValidationHeaders } from "@/server/booking/http";
import { buildBookingAuditSnapshot, logAuditEvent, softCancelBooking, updateBookingRecord } from "@/server/bookings";
import { beginBookingModificationFlow } from "@/server/bookings/modification-flow";
import { PastBookingError, assertBookingNotInPast, canOverridePastBooking } from "@/server/bookings/pastTimeValidation";
import { enqueueBookingCancelledSideEffects, enqueueBookingUpdatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { recordObservabilityEvent } from "@/server/observability";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient, getTenantServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant, fetchUserMemberships } from "@/server/team/access";
import { formatDateForInput } from "@reserve/shared/formatting/booking";
import { fromMinutes } from "@reserve/shared/time";
import { mapDbErrorToConstraint, isRetryableConstraintError } from "@/server/db-errors";

import type { BookingRecord } from "@/server/bookings";
import type { Json, Tables } from "@/types/supabase";
import type { NextRequest} from "next/server";

const overrideSchema = z
  .object({
    apply: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(500, { message: "Override reason must be 500 characters or fewer." })
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.apply) {
      const reason = value.reason?.trim() ?? "";
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Override reason must be at least 3 characters when applying override.",
        });
      }
    }
  });

const dashboardUpdateSchema = z.object({
  startIso: z.string().datetime(),
  endIso: z.string().datetime().optional(),
  partySize: z.number().int().min(1),
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
  durationMinutes: number;
  payload: DashboardUpdatePayload;
  existingBooking: Tables<"bookings"> & { restaurants?: { name: string | null } | { name: string | null }[] | null };
  user: AuthenticatedUser;
  serviceSupabase: ReturnType<typeof getServiceSupabaseClient>;
};

const BOOKING_OVERRIDE_CAPABILITY = "booking.override";

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

function resolveBookingId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return Promise.resolve(null);

  return paramsPromise.then((params) => {
    const { id } = params;
    if (typeof id === "string") return id;
    if (Array.isArray(id)) return id[0] ?? null;
    return null;
  });
}

function toIsoString(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = dashboardUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings][PATCH] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await serviceSupabase
    .from("bookings")
    .select("*, restaurants(name)")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[ops/bookings][PATCH] failed to load booking", error);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const existingBooking = existing as (Tables<"bookings"> & { restaurants?: { name: string | null } | { name: string | null }[] | null }) | null;

  if (!existingBooking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: existingBooking.restaurant_id,
      client: tenantSupabase,
    });
  } catch (membershipError) {
    console.warn("[ops/bookings][PATCH] membership denied", {
      bookingId,
      reason: membershipError instanceof Error ? membershipError.message : membershipError,
    });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const startDate = new Date(parsed.data.startIso);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid date values" }, { status: 400 });
  }

  const restaurantId = existingBooking.restaurant_id ?? "";
  const bookingType = existingBooking.booking_type ?? "dinner";
  const existingStartAt = existingBooking.start_at ? new Date(existingBooking.start_at) : null;
  const existingEndAt = existingBooking.end_at ? new Date(existingBooking.end_at) : null;
  const existingDurationMinutes =
    existingStartAt && existingEndAt
      ? Math.max(1, Math.round((existingEndAt.getTime() - existingStartAt.getTime()) / 60000))
      : null;
  const bookingDate = formatDateForInput(startDate);
  const startTime = fromMinutes(startDate.getHours() * 60 + startDate.getMinutes());
  const explicitEndIso = typeof parsed.data.endIso === "string" ? parsed.data.endIso : null;

  // Determine whether we need schedule data.
  // Time changes should respect restaurant-configured duration, and past-time checks may require schedule info.
  const isTimeChanged =
    bookingDate !== existingBooking.booking_date ||
    startTime !== existingBooking.start_time;

  const needsScheduleForDuration = isTimeChanged || !explicitEndIso;
  const needsScheduleForPastCheck = env.featureFlags.bookingPastTimeBlocking && isTimeChanged;

  let schedule: Awaited<ReturnType<typeof getRestaurantSchedule>> | null = null;
  if (needsScheduleForDuration || needsScheduleForPastCheck) {
    schedule = await getRestaurantSchedule(restaurantId, {
      date: bookingDate,
      client: serviceSupabase,
    });
  }

  let scheduleDuration: number | null = null;
  if (schedule) {
    const maybeDuration = (schedule as { defaultDurationMinutes?: unknown }).defaultDurationMinutes;
    if (typeof maybeDuration === "number") {
      scheduleDuration = maybeDuration;
    }
  }
  const configuredDuration = scheduleDuration && scheduleDuration > 0 ? scheduleDuration : null;
  const fallbackDuration =
    existingDurationMinutes && existingDurationMinutes > 0
      ? existingDurationMinutes
      : env.reserve.defaultDurationMinutes ?? 90;

  let durationMinutes: number;
  let endDate: Date;

  if (isTimeChanged) {
    const enforcedDuration = configuredDuration ?? fallbackDuration;
    durationMinutes = enforcedDuration > 0 ? enforcedDuration : 90;
    endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  } else if (explicitEndIso) {
    const parsedEnd = new Date(explicitEndIso);
    if (Number.isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: "Invalid date values" }, { status: 400 });
    }
    endDate = parsedEnd;
    durationMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  } else if (existingEndAt) {
    endDate = existingEndAt;
    durationMinutes = fallbackDuration > 0 ? fallbackDuration : 90;
  } else {
    const inferredDuration = configuredDuration ?? fallbackDuration;
    durationMinutes = inferredDuration > 0 ? inferredDuration : 90;
    endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const endTime = fromMinutes(endDate.getHours() * 60 + endDate.getMinutes());
  const requiresTableRealignment =
    bookingDate !== (existingBooking.booking_date ?? "") ||
    startTime !== (existingBooking.start_time ?? "") ||
    endTime !== (existingBooking.end_time ?? "") ||
    parsed.data.partySize !== (existingBooking.party_size ?? 0);
  const normalizedNotes = parsed.data.notes ?? null;

  const useUnifiedValidation = env.featureFlags.bookingValidationUnified;

  if (useUnifiedValidation) {
    const userForContext: AuthenticatedUser = { id: user.id, email: user.email ?? null };
    return handleUnifiedOpsUpdate({
      bookingId,
      bookingDate,
      startTime,
      endTime,
      durationMinutes,
      payload: parsed.data,
      existingBooking,
      user: userForContext,
      serviceSupabase,
    });
  }

  // Validate past time if feature enabled and time is changing
  if (isTimeChanged && env.featureFlags.bookingPastTimeBlocking) {
    const allowPastParam = req.nextUrl.searchParams.get("allow_past");
    const allowOverride = allowPastParam === "true";

    // Get user's role for the restaurant
    const memberships = await fetchUserMemberships(user.id, serviceSupabase);
    const membership = memberships.find(m => m.restaurant_id === existingBooking.restaurant_id);
    const userRole = membership?.role as RestaurantRole | null;

    try {
      const scheduleForPast = schedule ?? await getRestaurantSchedule(existingBooking.restaurant_id ?? "", {
        date: bookingDate,
        client: serviceSupabase,
      });

      assertBookingNotInPast(
        scheduleForPast.timezone,
        bookingDate,
        startTime,
        {
          graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
          allowOverride,
          actorRole: userRole,
        }
      );

      // Log successful override if admin used it
      if (allowOverride && canOverridePastBooking(userRole)) {
        void import("@/server/observability").then(({ recordObservabilityEvent }) => {
          void recordObservabilityEvent({
            source: "api.ops.bookings",
            eventType: "booking.past_time.override",
            severity: "info",
            context: {
              bookingId,
              restaurantId: existingBooking.restaurant_id,
              endpoint: "ops.bookings.update",
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
        void import("@/server/observability").then(({ recordObservabilityEvent }) => {
          void recordObservabilityEvent({
            source: "api.ops.bookings",
            eventType: "booking.past_time.blocked",
            severity: "warning",
            context: {
              bookingId,
              restaurantId: existingBooking.restaurant_id,
              endpoint: "ops.bookings.update",
              actorId: user.id,
              actorEmail: user.email,
              actorRole: userRole,
              overrideAttempted: allowOverride,
              ...pastTimeError.details,
            },
          });
        });

        return NextResponse.json(
          {
            error: pastTimeError.message,
            code: pastTimeError.code,
            details: pastTimeError.details,
          },
          { status: 422 }
        );
      }
      throw pastTimeError;
    }
  }

  // Use tenant-scoped client for all booking operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);

  try {
    const updated: Tables<"bookings"> = requiresTableRealignment
      ? await beginBookingModificationFlow({
          client: tenantClient,
          bookingId,
          existingBooking,
          source: "ops",
          payload: {
            booking_date: bookingDate,
            start_time: startTime,
            end_time: endTime,
            party_size: parsed.data.partySize,
            notes: normalizedNotes,
          },
        })
      : await updateBookingRecord(tenantClient, bookingId, {
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          party_size: parsed.data.partySize,
          notes: normalizedNotes,
        });

    const auditMetadata = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(tenantClient, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? "ops",
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id,
        },
        { supabase: tenantClient },
      );
    } catch (jobError) {
      console.error("[ops/bookings][PATCH] side effects failed", jobError);
    }

    const restaurantRelation = Array.isArray(existingBooking.restaurants)
      ? existingBooking.restaurants[0] ?? null
      : existingBooking.restaurants ?? null;

    const response = {
      id: updated.id,
      restaurantName: restaurantRelation?.name ?? "",
      partySize: updated.party_size,
      startIso: toIsoString(updated.start_at),
      endIso: toIsoString(updated.end_at),
      status: updated.status,
      notes: updated.notes ?? null,
      customerName: typeof updated.customer_name === "string" && updated.customer_name.trim().length > 0 ? updated.customer_name.trim() : null,
      customerEmail: typeof updated.customer_email === "string" && updated.customer_email.trim().length > 0 ? updated.customer_email.trim() : null,
      customerPhone: typeof updated.customer_phone === "string" && updated.customer_phone.trim().length > 0 ? updated.customer_phone.trim() : null,
    };

    return NextResponse.json(response);
  } catch (updateError) {
    console.error("[ops/bookings][PATCH] update failed", updateError);

    if (env.featureFlags.dbStrictConstraints) {
      const mapped = mapDbErrorToConstraint(updateError);
      if (mapped) {
        const status = mapped.kind === "overlap_conflict" || mapped.kind === "unique_conflict" ? 409 : 422;
        return NextResponse.json(
          {
            error: mapped.userMessage,
            code:
              mapped.kind === "overlap_conflict"
                ? "ALLOCATION_CONFLICT"
                : mapped.kind === "unique_conflict"
                  ? "UNIQUE_CONFLICT"
                  : mapped.kind === "fk_conflict"
                    ? "FK_CONFLICT"
                    : mapped.kind === "check_violation"
                      ? "CHECK_VIOLATION"
                      : "DB_CONSTRAINT_ERROR",
            retryable: isRetryableConstraintError(updateError),
          },
          { status },
        );
      }
    }

    return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
  }
}

async function handleUnifiedOpsUpdate(params: UnifiedOpsUpdateParams) {
  const { bookingId, bookingDate, startTime, endTime, durationMinutes, payload, existingBooking, user, serviceSupabase } = params;

  const schedule = await getRestaurantSchedule(existingBooking.restaurant_id ?? "", {
    date: bookingDate,
    client: serviceSupabase,
  });

  const memberships = await fetchUserMemberships(user.id, serviceSupabase);
  const membership = memberships.find((entry) => entry.restaurant_id === existingBooking.restaurant_id) ?? null;
  const userRole = (membership?.role as RestaurantRole | undefined) ?? null;
  const actorCapabilities = resolveActorCapabilities(userRole);
  const actorRoles = userRole ? [userRole] : ["staff"];

  const overrideReason = payload.override?.reason?.trim() ?? null;
  const overrideRequest = payload.override?.apply ? { apply: true, reason: overrideReason } : undefined;

  // Use tenant-scoped client for all validation and update operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);
  const validationService = createBookingValidationService({ client: tenantClient });

  const bookingInput: BookingInput = {
    restaurantId: existingBooking.restaurant_id,
    serviceId: existingBooking.booking_type ?? "dinner",
    partySize: payload.partySize,
    start: payload.startIso,
    durationMinutes,
    seatingPreference: existingBooking.seating_preference ?? null,
    notes: payload.notes ?? existingBooking.notes ?? null,
    customerId: existingBooking.customer_id ?? null,
    customerName: existingBooking.customer_name ?? "",
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
    tz: schedule.timezone,
    flags: {
      bookingPastTimeBlocking: env.featureFlags.bookingPastTimeBlocking ?? false,
      bookingPastTimeGraceMinutes: env.featureFlags.bookingPastTimeGraceMinutes ?? 5,
      unified: true,
    },
    metadata: {
      clientRequestId: existingBooking.client_request_id ?? undefined,
    },
  };

  try {
    const commit = await validationService.updateWithEnforcement(existingBooking as unknown as BookingRecord, bookingInput, context);
    const updated = commit.booking as Tables<"bookings">;
    const validationResponse = commit.response;

    const auditMetadata: Json = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    };

    if (validationResponse.overridden) {
      (auditMetadata as Record<string, unknown>).override_reason = overrideReason;
      (auditMetadata as Record<string, unknown>).override_codes = validationResponse.overrideCodes ?? [];
      (auditMetadata as Record<string, unknown>).override_applied = true;
    }

    await logAuditEvent(tenantClient, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? "ops",
    });

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
      console.error("[ops/bookings][PATCH][unified] side effects failed", jobError);
    }

    if (validationResponse.overridden) {
      recordObservabilityEvent({
        source: "api.ops.bookings",
        eventType: "booking.override.applied",
        severity: "info",
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

    const restaurantRelation = Array.isArray(existingBooking.restaurants)
      ? existingBooking.restaurants[0] ?? null
      : existingBooking.restaurants ?? null;

    const responsePayload = {
      id: updated.id,
      restaurantName: restaurantRelation?.name ?? "",
      partySize: updated.party_size,
      startIso: toIsoString(updated.start_at),
      endIso: toIsoString(updated.end_at),
      status: updated.status,
      notes: updated.notes ?? null,
      customerName:
        typeof updated.customer_name === "string" && updated.customer_name.trim().length > 0
          ? updated.customer_name.trim()
          : null,
      customerEmail:
        typeof updated.customer_email === "string" && updated.customer_email.trim().length > 0
          ? updated.customer_email.trim()
          : null,
      customerPhone:
        typeof updated.customer_phone === "string" && updated.customer_phone.trim().length > 0
          ? updated.customer_phone.trim()
          : null,
      validation: validationResponse,
    };

    return NextResponse.json(responsePayload, withValidationHeaders({ status: 200 }));
  } catch (error) {
    if (error instanceof BookingValidationError) {
      recordObservabilityEvent({
        source: "api.ops.bookings",
        eventType: "booking.validation_failed",
        severity: "warning",
        context: {
          bookingId,
          restaurantId: existingBooking.restaurant_id,
          actorId: user.id,
          actorEmail: user.email,
          overrideAttempted: payload.override?.apply ?? false,
          issues: error.response.issues.map((issue) => issue.code),
        },
      });

      const mapped = mapValidationFailure(error.response);
      return NextResponse.json(mapped.body, withValidationHeaders({ status: mapped.status }));
    }

    console.error("[ops/bookings][PATCH][unified] update failed", error);
    return NextResponse.json({ error: "Unable to update booking" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings][DELETE] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();
  const { data: existing, error } = await serviceSupabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[ops/bookings][DELETE] failed to load booking", error);
    return NextResponse.json({ error: "Unable to load booking" }, { status: 500 });
  }

  const existingBooking = existing as Tables<"bookings"> | null;

  if (!existingBooking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  try {
    await requireMembershipForRestaurant({
      userId: user.id,
      restaurantId: existingBooking.restaurant_id,
      client: tenantSupabase,
    });
  } catch (membershipError) {
    console.warn("[ops/bookings][DELETE] membership denied", {
      bookingId,
      reason: membershipError instanceof Error ? membershipError.message : membershipError,
    });
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Use tenant-scoped client for all cancellation operations
  const tenantClient = getTenantServiceSupabaseClient(existingBooking.restaurant_id);

  try {
    const cancelled = await softCancelBooking(tenantClient, bookingId);

    const auditMetadata = {
      restaurant_id: existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, cancelled),
    } as Json;

    await logAuditEvent(tenantClient, {
      action: "booking.cancelled",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: user.email ?? user.id ?? "ops",
    });

    try {
      await enqueueBookingCancelledSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          cancelled: safeBookingPayload(cancelled),
          restaurantId: existingBooking.restaurant_id,
          cancelledBy: "staff",
        },
        { supabase: tenantClient },
      );
    } catch (jobError) {
      console.error("[ops/bookings][DELETE] side effects failed", jobError);
    }

    return NextResponse.json({ id: bookingId, status: cancelled.status });
  } catch (deleteError) {
    console.error("[ops/bookings][DELETE] cancellation failed", deleteError);

    if (typeof deleteError === "object" && deleteError !== null) {
      const record = deleteError as { code?: string; message?: string };
      if (record.code === "42501") {
        return NextResponse.json(
          {
            error: "This booking can no longer be cancelled online.",
            code: "CUTOFF_PASSED",
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ error: "Unable to cancel booking" }, { status: 500 });
  }
}
