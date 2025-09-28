import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Json, Tables } from "@/types/supabase";
import {
  BOOKING_TYPES,
  SEATING_OPTIONS,
  buildBookingAuditSnapshot,
  deriveEndTime,
  fetchBookingsForContact,
  findAvailableTable,
  inferMealTypeFromTime,
  logAuditEvent,
  rangesOverlap,
  softCancelBooking,
  updateBookingRecord,
} from "@/server/bookings";
import { BOOKING_BLOCKING_STATUSES, getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { sendBookingCancellationEmail, sendBookingUpdateEmail } from "@/server/emails/bookings";
import { normalizeEmail } from "@/server/customers";
import { recordBookingCancelledEvent, recordBookingAllocatedEvent } from "@/server/analytics";

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

const contactQuerySchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  restaurantId: z.string().uuid().optional(),
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

export async function GET(req: NextRequest, { params }: RouteParams) {
  const bookingId = await resolveBookingId(params);

  if (!bookingId) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }

  try {
    const supabase = getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,restaurant_id,table_id,booking_date,start_time,end_time,start_at,end_at,slot,reference,party_size,booking_type,seating_preference,status,customer_name,customer_email,customer_phone,notes,marketing_opt_in,loyalty_points_awarded,client_request_id,pending_ref,idempotency_key,details,created_at,updated_at",
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

  const parsed = updateSchema.safeParse({
    ...body,
    party: Number(body.party ?? 0),
  });

  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const data = parsed.data;
  const tenantSupabase = getRouteHandlerSupabaseClient();
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

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = data.phone.trim();

    if (existingBooking.customer_email !== normalizedEmail || existingBooking.customer_phone !== normalizedPhone) {
      return NextResponse.json({ error: "You can only update your own reservation" }, { status: 403 });
    }

    const restaurantId = data.restaurantId ?? existingBooking.restaurant_id ?? getDefaultRestaurantId();
    const startTime = data.time;
    const normalizedBookingType = data.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(startTime);
    const endTime = deriveEndTime(startTime, normalizedBookingType);

    // Attempt to reuse the current table when possible
    let nextTableId: string | null = existingBooking.table_id ?? null;

    if (existingBooking.table_id) {
      const { data: currentTable, error: tableError } = await tenantSupabase
        .from("restaurant_tables")
        .select("id,capacity,seating_type")
        .eq("id", existingBooking.table_id)
        .maybeSingle();

      if (tableError) {
        throw tableError;
      }

      const typedCurrentTable = currentTable as Tables<"restaurant_tables"> | null;

      const tableSupportsParty = typedCurrentTable && typedCurrentTable.capacity >= data.party;
      const tableMatchesSeating = typedCurrentTable && (data.seating === "any" || typedCurrentTable.seating_type === data.seating);

      if (tableSupportsParty && tableMatchesSeating) {
        const { data: overlaps, error: overlapsError } = await tenantSupabase
          .from("bookings")
          .select("id,start_time,end_time,status")
          .eq("table_id", existingBooking.table_id)
          .eq("booking_date", data.date)
          .in("status", BOOKING_BLOCKING_STATUSES)
          .order("start_time", { ascending: true });

        if (overlapsError) {
          throw overlapsError;
        }

        const overlappingBookings = (overlaps ?? []) as Array<{
          id: string;
          start_time: string;
          end_time: string;
        }>;

        const hasConflict = overlappingBookings.some((entry) => {
          if (entry.id === existingBooking.id) return false;
          return rangesOverlap(entry.start_time, entry.end_time, startTime, endTime);
        });

        if (hasConflict) {
          nextTableId = null;
        }
      } else {
        nextTableId = null;
      }
    }

    if (!nextTableId) {
      const tableRecord = await findAvailableTable(
        tenantSupabase,
        restaurantId,
        data.date,
        startTime,
        endTime,
        data.party,
        data.seating,
        existingBooking.id,
      );

      if (!tableRecord) {
        return NextResponse.json(
          { error: "No availability for the requested slot" },
          { status: 409 },
        );
      }

      nextTableId = tableRecord.id;
    }

    const updated = await updateBookingRecord(serviceSupabase, bookingId, {
      restaurant_id: restaurantId,
      table_id: nextTableId,
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

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
    });

    if (updated.table_id) {
      const allocationStatus = existingBooking.table_id && existingBooking.table_id !== updated.table_id
        ? "reallocated"
        : "allocated";
      try {
        await recordBookingAllocatedEvent(serviceSupabase, {
          bookingId,
          restaurantId,
          customerId: updated.customer_id,
          tableId: updated.table_id,
          allocationStatus,
          occurredAt: updated.updated_at,
        });
      } catch (analyticsError) {
        console.error("[bookings][PUT][analytics]", stringifyError(analyticsError));
      }
    }

    const bookings = await fetchBookingsForContact(tenantSupabase, restaurantId, data.email, data.phone);

    try {
      await sendBookingUpdateEmail(updated);
    } catch (error: unknown) {
      console.error("[bookings][PUT][email]", stringifyError(error));
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
  const parsed = contactQuerySchema.safeParse({
    email: req.nextUrl.searchParams.get("email"),
    phone: req.nextUrl.searchParams.get("phone"),
    restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
  });

  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const { email, phone, restaurantId } = parsed.data;
  const tenantSupabase = getRouteHandlerSupabaseClient();
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

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = phone.trim();

    if (existingBooking.customer_email !== normalizedEmail || existingBooking.customer_phone !== normalizedPhone) {
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
    });

    try {
      await recordBookingCancelledEvent(serviceSupabase, {
        bookingId: cancelledRecord.id,
        restaurantId: cancelledRecord.restaurant_id,
        customerId: cancelledRecord.customer_id,
        previousStatus: existingBooking.status,
        cancelledBy: "customer",
        occurredAt: cancelledRecord.updated_at,
      });
    } catch (analyticsError) {
      console.error("[bookings][DELETE][analytics]", stringifyError(analyticsError));
    }

    const targetRestaurantId = restaurantId ?? existingBooking.restaurant_id ?? getDefaultRestaurantId();
    const bookings = await fetchBookingsForContact(tenantSupabase, targetRestaurantId, email, phone);

    try {
      await sendBookingCancellationEmail(cancelledRecord);
    } catch (error: unknown) {
      console.error("[bookings][DELETE][email]", stringifyError(error));
    }

    return NextResponse.json({ success: true, bookings });
  } catch (error: unknown) {
    console.error("[bookings][DELETE:id]", stringifyError(error));
    return NextResponse.json({ error: stringifyError(error) || "Unable to cancel booking" }, { status: 500 });
  }
}
