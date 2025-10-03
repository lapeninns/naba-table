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
import { formatDateForInput } from "@reserve/shared/formatting/booking";
import { fromMinutes, normalizeTime } from "@reserve/shared/time";

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

    const restaurantId = existingBooking.restaurant_id ?? await getDefaultRestaurantId();

    // Attempt to reuse the current table when possible
    let nextTableId: string | null = existingBooking.table_id ?? null;

    const existingStartTime = normalizeTime(existingBooking.start_time);
    const existingEndTime = normalizeTime(existingBooking.end_time);
    const slotMatchesExisting = existingBooking.booking_date === bookingDate
      && existingStartTime === startTime
      && existingEndTime === endTime;
    const partyMatchesExisting = existingBooking.party_size === data.partySize;
    const slotUnchanged = slotMatchesExisting && partyMatchesExisting;

    if (!slotUnchanged) {
      if (existingBooking.table_id) {
        const { data: currentTable, error: tableError } = await serviceSupabase
          .from("restaurant_tables")
          .select("id,capacity,seating_type")
          .eq("id", existingBooking.table_id)
          .maybeSingle();

        if (tableError) {
          throw tableError;
        }

        const typedCurrentTable = currentTable as Tables<"restaurant_tables"> | null;

        const tableSupportsParty = typedCurrentTable && typedCurrentTable.capacity >= data.partySize;

        if (tableSupportsParty) {
          const { data: overlaps, error: overlapsError } = await serviceSupabase
            .from("bookings")
            .select("id,start_time,end_time,status")
            .eq("table_id", existingBooking.table_id)
            .eq("booking_date", bookingDate)
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
      } else {
        nextTableId = null;
      }

      // If we can't reuse the current table, find a new one
      if (!nextTableId) {
        const tableRecord = await findAvailableTable(
          serviceSupabase,
          restaurantId,
          bookingDate,
          startTime,
          endTime,
          data.partySize,
          existingBooking.seating_preference, // Keep existing seating preference
          existingBooking.id,
        );

        if (!tableRecord) {
          return NextResponse.json(
            {
              message: "No availability for the requested slot.",
              code: "OVERLAP_DETECTED",
            },
            { status: 409 },
          );
        }

        nextTableId = tableRecord.id;
      }
    }

    // Update the booking record
    const updated = await updateBookingRecord(serviceSupabase, bookingId, {
      restaurant_id: restaurantId,
      table_id: nextTableId,
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
      restaurant_id: restaurantId,
      ...buildBookingAuditSnapshot(existingBooking, updated),
    } as Json;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: existingBooking.customer_email ?? "dashboard",
    });

    // Record analytics event
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

    // Send update email
    try {
      await sendBookingUpdateEmail(updated);
    } catch (error: unknown) {
      console.error("[bookings][PUT][email]", stringifyError(error));
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

    // Attempt to reuse the current table when possible
    let nextTableId: string | null = existingBooking.table_id ?? null;

    const existingStartTime = normalizeTime(existingBooking.start_time);
    const existingEndTime = normalizeTime(existingBooking.end_time);
    const slotMatchesExisting = existingBooking.booking_date === data.date
      && existingStartTime === startTime
      && existingEndTime === endTime;
    const partyMatchesExisting = existingBooking.party_size === data.party;
    const seatingMatchesExisting = existingBooking.seating_preference === data.seating;
    const slotUnchanged = slotMatchesExisting && partyMatchesExisting && seatingMatchesExisting;

    if (!slotUnchanged) {
      if (existingBooking.table_id) {
        const { data: currentTable, error: tableError } = await serviceSupabase
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
          const { data: overlaps, error: overlapsError } = await serviceSupabase
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
      } else {
        nextTableId = null;
      }

      if (!nextTableId) {
        const tableRecord = await findAvailableTable(
          serviceSupabase,
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
            {
              message: "No availability for the requested slot.",
              code: "OVERLAP_DETECTED",
            },
            { status: 409 },
          );
        }

        nextTableId = tableRecord.id;
      }
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

    const actorIdentity = user?.email ?? user?.id ?? data.email ?? existingBooking.customer_email ?? null;

    await logAuditEvent(serviceSupabase, {
      action: "booking.updated",
      entity: "booking",
      entityId: bookingId,
      metadata: auditMetadata,
      actor: actorIdentity,
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

    const targetRestaurantId = existingBooking.restaurant_id ?? await getDefaultRestaurantId();
    const bookings = await fetchBookingsForContact(tenantSupabase, targetRestaurantId, userEmail, existingBooking.customer_phone);

    try {
      await sendBookingCancellationEmail(cancelledRecord);
    } catch (error: unknown) {
      console.error("[bookings][DELETE][email]", stringifyError(error));
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
