import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Json, Tables } from "@/types/supabase";
import type { BookingRecord } from "@/server/bookings";
import {
  BOOKING_TYPES,
  SEATING_OPTIONS,
  buildBookingAuditSnapshot,
  deriveEndTime,
  fetchBookingsForContact,
  inferMealTypeFromTime,
  logAuditEvent,
  softCancelBooking,
  updateBookingRecord,
} from "@/server/bookings";
import { getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import {
  enqueueBookingCancelledSideEffects,
  enqueueBookingUpdatedSideEffects,
  safeBookingPayload,
} from "@/server/jobs/booking-side-effects";
import { normalizeEmail } from "@/server/customers";
import { formatDateForInput } from "@reserve/shared/formatting/booking";
import { fromMinutes } from "@reserve/shared/time";

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
  endIso: z.string().datetime(),
  partySize: z.number().int().min(1),
  notes: z.string().max(500).optional().nullable(),
});



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
    },
    { status: 400 },
  );
}

async function handleDashboardUpdate(bookingId: string, data: z.infer<typeof dashboardUpdateSchema>) {
  const serviceSupabase = getServiceSupabaseClient();

  try {
    // Use service client for reading to avoid RLS issues
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
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Convert ISO strings to date and time components for database update
    const startDate = new Date(data.startIso);
    const endDate = new Date(data.endIso);

    const bookingDate = formatDateForInput(startDate);
    const startTime = fromMinutes(startDate.getHours() * 60 + startDate.getMinutes());
    const endTime = fromMinutes(endDate.getHours() * 60 + endDate.getMinutes());

    // Update the booking record
    const updated = await updateBookingRecord(serviceSupabase, bookingId, {
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      party_size: data.partySize,
      notes: data.notes ?? null,
      // Keep existing fields that weren't updated
      booking_type: existingBooking.booking_type,
      seating_preference: existingBooking.seating_preference,
      customer_name: existingBooking.customer_name,
      customer_email: existingBooking.customer_email,
      customer_phone: existingBooking.customer_phone,
      marketing_opt_in: existingBooking.marketing_opt_in,
    });

    // Log audit event
    const auditMetadata = {
      restaurant_id: updated.restaurant_id ?? existingBooking.restaurant_id,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: existingBooking.customer_email ?? "dashboard",
    });

    try {
      await enqueueBookingUpdatedSideEffects(
        {
          previous: safeBookingPayload(existingBooking as unknown as BookingRecord),
          current: safeBookingPayload(updated),
          restaurantId: updated.restaurant_id ?? existingBooking.restaurant_id ?? (await getDefaultRestaurantId()),
        },
        { supabase: serviceSupabase },
      );
    } catch (jobError: unknown) {
      console.error("[bookings][PUT:dashboard][side-effects]", stringifyError(jobError));
    }

    // Return the updated booking in the format expected by the frontend
    const bookingDTO = {
      id: updated.id,
      restaurantName: "Unknown", // Frontend should refresh to get full data
      partySize: updated.party_size,
      startIso: updated.start_at,
      endIso: updated.end_at,
      status: updated.status as "pending" | "pending_allocation" | "confirmed" | "cancelled",
      notes: updated.notes,
    };

    return NextResponse.json(bookingDTO);
  } catch (error: unknown) {
    console.error("[bookings][PUT:dashboard]", stringifyError(error));
    return NextResponse.json({ error: stringifyError(error) || "Unable to update booking" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,restaurant_id,booking_date,start_time,end_time,start_at,end_at,slot,reference,party_size,booking_type,seating_preference,status,customer_name,customer_email,customer_phone,notes,marketing_opt_in,loyalty_points_awarded,client_request_id,pending_ref,idempotency_key,details,created_at,updated_at",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ booking: data });
  } catch (error: unknown) {
    console.error("[bookings][GET:id]", stringifyError(error));
    return NextResponse.json({ error: stringifyError(error) || "Unable to load booking" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
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

  const body = (payload ?? {}) as Record<string, unknown>;

  // Try dashboard format first (minimal update from EditBookingDialog)
  const dashboardParsed = dashboardUpdateSchema.safeParse(body);
  
  if (dashboardParsed.success) {
    // Handle dashboard update format
    return handleDashboardUpdate(bookingId, dashboardParsed.data);
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
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
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
      return NextResponse.json({ error: "You can only update your own reservation" }, { status: 403 });
    }

    const restaurantId = data.restaurantId ?? existingBooking.restaurant_id ?? await getDefaultRestaurantId();
    const startTime = data.time;
    const normalizedBookingType = data.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(startTime);
    const endTime = deriveEndTime(startTime, normalizedBookingType);

    const updated = await updateBookingRecord(serviceSupabase, bookingId, {
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
    return NextResponse.json({ error: stringifyError(error) || "Unable to update booking" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  const tenantSupabase = await getRouteHandlerSupabaseClient();
  const serviceSupabase = getServiceSupabaseClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await tenantSupabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const normalizedEmail = normalizeEmail(userEmail);

    // Verify the booking belongs to the authenticated user
    if (existingBooking.customer_email !== normalizedEmail) {
      return NextResponse.json({ error: "You can only cancel your own reservation" }, { status: 403 });
    }

    const cancelledRecord = await softCancelBooking(serviceSupabase, bookingId);

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

    return NextResponse.json({ error: stringifyError(error) || "Unable to cancel booking" }, { status: 500 });
  }
}
