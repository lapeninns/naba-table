import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  BOOKING_TYPES,
  SEATING_OPTIONS,
  deriveEndTime,
  fetchBookingsForContact,
  findAvailableTable,
  insertBookingRecord,
  buildBookingAuditSnapshot,
  updateBookingRecord,
  inferMealTypeFromTime,
  logAuditEvent,
  generateUniqueBookingReference,
  addToWaitingList,
} from "@/server/bookings";
import type { BookingRecord } from "@/server/bookings";
import type { Json } from "@/types/supabase";
import { getDefaultRestaurantId, getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import { recordObservabilityEvent } from "@/server/observability";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { getActiveLoyaltyProgram, calculateLoyaltyAward, applyLoyaltyAward } from "@/server/loyalty";
import {
  recordBookingAllocatedEvent,
  recordBookingCreatedEvent,
  recordBookingWaitlistedEvent,
} from "@/server/analytics";

const querySchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  restaurantId: z.string().uuid().optional(),
});

const bookingTypeEnum = z.enum(BOOKING_TYPES);

const bookingSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1).max(20),
  bookingType: bookingTypeEnum,
  seating: z.enum(SEATING_OPTIONS),
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(50),
  marketingOptIn: z.coerce.boolean().optional().default(false),
});

type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

function extractPostgrestError(error: unknown): PostgrestErrorLike {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
    };
  }
  return {};
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

export async function GET(req: NextRequest) {
  try {
    const parsedQuery = querySchema.safeParse({
      email: req.nextUrl.searchParams.get("email"),
      phone: req.nextUrl.searchParams.get("phone"),
      restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
    });

    if (!parsedQuery.success) {
      return handleZodError(parsedQuery.error);
    }

    const { email, phone, restaurantId } = parsedQuery.data;
    const supabase = getRouteHandlerSupabaseClient();
    const targetRestaurantId = restaurantId ?? getDefaultRestaurantId();

    const bookings = await fetchBookingsForContact(supabase, targetRestaurantId, email, phone);

    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    console.error("[bookings][GET]", stringifyError(error));
    return NextResponse.json(
      { error: "Unable to fetch bookings" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  const parsed = bookingSchema.safeParse({
    ...body,
    party: Number(body.party ?? 0),
  });

  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const data = parsed.data;
  const restaurantId = data.restaurantId ?? getDefaultRestaurantId();

  try {
    const supabase = getServiceSupabaseClient();
    const startTime = data.time;
    const normalizedBookingType = data.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(startTime);
    const endTime = deriveEndTime(startTime, normalizedBookingType);

    const customer = await upsertCustomer(supabase, {
      restaurantId,
      email: data.email,
      phone: data.phone,
      name: data.name,
      marketingOptIn: data.marketingOptIn ?? false,
    });

    const loyaltyProgram = await getActiveLoyaltyProgram(supabase, restaurantId);

    const table = await findAvailableTable(
      supabase,
      restaurantId,
      data.date,
      startTime,
      endTime,
      data.party,
      data.seating,
    );

    const allocationPending = !table;
    const bookingStatus = allocationPending ? "pending_allocation" : "confirmed";
    let waitlistEntry: { id: string; position: number; existing: boolean } | null = null;

    let booking: BookingRecord | null = null;
    let reference = "";

    for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
      reference = await generateUniqueBookingReference(supabase);

      try {
        booking = await insertBookingRecord(supabase, {
          restaurant_id: restaurantId,
          table_id: table?.id ?? null,
          customer_id: customer.id,
          booking_date: data.date,
          start_time: startTime,
          end_time: endTime,
          reference,
          party_size: data.party,
          booking_type: normalizedBookingType,
          seating_preference: data.seating,
          status: bookingStatus,
          customer_name: data.name,
          customer_email: normalizeEmail(data.email),
          customer_phone: data.phone.trim(),
          notes: data.notes ?? null,
          marketing_opt_in: data.marketingOptIn ?? false,
          source: "api",
        });
      } catch (error: unknown) {
        const { code, message } = extractPostgrestError(error);
        const duplicateReference = code === "23505" || (message ? /duplicate key value/i.test(message) : false);
        if (!duplicateReference) {
          throw error;
        }
        booking = null;
      }
    }

    if (!booking) {
      throw new Error("Unable to allocate a booking reference. Please try again.");
    }

    let finalBooking = booking;
    let loyaltyAward = 0;

    if (allocationPending) {
      try {
        waitlistEntry = await addToWaitingList(supabase, {
          restaurant_id: restaurantId,
          booking_date: data.date,
          desired_time: startTime,
          party_size: data.party,
          seating_preference: data.seating,
          customer_name: data.name,
          customer_email: data.email,
          customer_phone: data.phone,
          notes: data.notes ?? null,
        });
      } catch (error) {
        console.error("[bookings][POST][waitlist] Failed to add to waitlist", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      if (loyaltyProgram) {
        loyaltyAward = calculateLoyaltyAward(loyaltyProgram, { partySize: data.party });

        if (loyaltyAward > 0) {
          try {
            await applyLoyaltyAward(supabase, {
              program: loyaltyProgram,
              customerId: customer.id,
              bookingId: booking.id,
              points: loyaltyAward,
              metadata: {
                reference: booking.reference,
                source: "api",
              },
              occurredAt: booking.created_at,
            });
          } catch (error) {
            console.error("[bookings][POST][loyalty] Failed to record loyalty award", {
              bookingId: booking.id,
              error: stringifyError(error),
            });
            loyaltyAward = 0;
          }
        }
      }

      if (loyaltyAward > 0) {
        finalBooking = await updateBookingRecord(supabase, booking.id, {
          loyalty_points_awarded: loyaltyAward,
        });
      }
    }

    const waitlisted = Boolean(waitlistEntry);

    const auditMetadata = {
      restaurant_id: restaurantId,
      customer_id: customer.id,
      table_id: table?.id ?? null,
      reference: finalBooking.reference,
      waitlisted,
      allocation_pending: allocationPending,
      ...buildBookingAuditSnapshot(null, finalBooking),
    } as Json;

    await logAuditEvent(supabase, {
      action: "booking.created",
      entity: "booking",
      entityId: booking.id,
      metadata: auditMetadata,
    });

    const bookings = await fetchBookingsForContact(supabase, restaurantId, data.email, data.phone);

    try {
      await recordBookingCreatedEvent(supabase, {
        bookingId: finalBooking.id,
        restaurantId,
        customerId: finalBooking.customer_id,
        status: finalBooking.status,
        partySize: finalBooking.party_size,
        bookingType: finalBooking.booking_type,
        seatingPreference: finalBooking.seating_preference,
        source: finalBooking.source ?? "api",
        waitlisted,
        loyaltyPointsAwarded: finalBooking.loyalty_points_awarded ?? 0,
        occurredAt: finalBooking.created_at,
      });

      if (waitlistEntry) {
        await recordBookingWaitlistedEvent(supabase, {
          bookingId: finalBooking.id,
          restaurantId,
          customerId: finalBooking.customer_id,
          waitlistId: waitlistEntry.id,
          position: waitlistEntry.position,
          occurredAt: finalBooking.created_at,
        });
      } else if (!allocationPending && finalBooking.table_id) {
        await recordBookingAllocatedEvent(supabase, {
          bookingId: finalBooking.id,
          restaurantId,
          customerId: finalBooking.customer_id,
          tableId: finalBooking.table_id,
          allocationStatus: "allocated",
          occurredAt: finalBooking.updated_at,
        });
      }
    } catch (analyticsError) {
      console.error("[bookings][POST][analytics] Failed to record analytics", stringifyError(analyticsError));
      void recordObservabilityEvent({
        source: "api.bookings",
        eventType: "analytics.emit.failed",
        severity: "warning",
        context: {
          bookingId: finalBooking.id,
          event: "booking.created",
          error: stringifyError(analyticsError),
        },
      });
    }

    if (!allocationPending) {
      try {
        console.log(`[bookings][POST][email] Sending confirmation email to: ${finalBooking.customer_email} for booking: ${finalBooking.reference}`);
        await sendBookingConfirmationEmail(finalBooking);
        console.log(`[bookings][POST][email] Successfully sent confirmation email for booking: ${finalBooking.reference}`);
      } catch (error: unknown) {
        console.error("[bookings][POST][email] Failed to send confirmation email:", {
          bookingId: finalBooking.id,
          reference: finalBooking.reference,
          customerEmail: finalBooking.customer_email,
          error: stringifyError(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    return NextResponse.json(
      {
        booking: finalBooking,
        table: table ?? null,
        loyaltyPointsAwarded: loyaltyAward,
        bookings,
        waitlisted,
        allocationPending,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = stringifyError(error);
    console.error("[bookings][POST]", message);

    const emailDomain = data.email.includes("@") ? data.email.split("@")[1] : null;
    const phoneSuffix = data.phone ? data.phone.slice(-4) : null;

    void recordObservabilityEvent({
      source: "api.bookings",
      eventType: "booking.create.failure",
      severity: "error",
      context: {
        message,
        restaurantId,
        bookingDate: data.date,
        emailDomain,
        phoneSuffix,
      } as Json,
    });

    return NextResponse.json(
      { error: message || "Unable to create booking" },
      { status: 500 },
    );
  }
}
