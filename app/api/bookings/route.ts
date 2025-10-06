import { randomUUID } from "crypto";
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
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
} from "@/server/supabase";
import { recordObservabilityEvent } from "@/server/observability";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { getActiveLoyaltyProgram, calculateLoyaltyAward, applyLoyaltyAward } from "@/server/loyalty";
import { enqueueBookingCreatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";

const baseQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
});

const contactQuerySchema = baseQuerySchema.extend({
  email: z.string().email(),
  phone: z.string().min(7).max(50),
});

const statusFilterSchema = z.union([
  z.enum(["pending", "pending_allocation", "confirmed", "cancelled"]),
  z.literal("active"),
]);

const myBookingsQuerySchema = baseQuerySchema.extend({
  me: z.literal("1"),
  status: statusFilterSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

const bookingTypeEnum = z.enum(BOOKING_TYPES);

const bookingSchema = z.object({
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

function buildBookingDetails(params: {
  idempotencyKey: string | null;
  clientRequestId: string;
  allocationPending: boolean;
  userAgent: string | null;
}): Json {
  return {
    channel: "api.bookings",
    allocation_pending: params.allocationPending,
    request: {
      idempotency_key: params.idempotencyKey,
      client_request_id: params.clientRequestId,
      user_agent: params.userAgent ?? null,
    },
  } as Json;
}

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

type BookingDTO = {
  id: string;
  restaurantName: string;
  partySize: number;
  startIso: string;
  endIso: string;
  status: "pending" | "pending_allocation" | "confirmed" | "cancelled";
  notes?: string | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

type PageResponse<T> = {
  items: T[];
  pageInfo: PageInfo;
};

function toIsoStringOrThrow(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date.toISOString();
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

export async function GET(req: NextRequest) {
  try {
    const meParam = req.nextUrl.searchParams.get("me");

    if (meParam === "1") {
      return await handleMyBookings(req);
    }

    const parsedQuery = contactQuerySchema.safeParse({
      email: req.nextUrl.searchParams.get("email"),
      phone: req.nextUrl.searchParams.get("phone"),
      restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
    });

    if (!parsedQuery.success) {
      return handleZodError(parsedQuery.error);
    }

    const { email, phone, restaurantId } = parsedQuery.data;
    const supabase = await getRouteHandlerSupabaseClient();
    const targetRestaurantId = restaurantId ?? (await getDefaultRestaurantId());

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
  const restaurantId = data.restaurantId ?? await getDefaultRestaurantId();
  const idempotencyKey = normalizeIdempotencyKey(req.headers.get("Idempotency-Key"));
  const clientRequestId = coerceUuid(idempotencyKey) ?? randomUUID();
  const userAgent = req.headers.get("user-agent");

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

    if (idempotencyKey) {
      const { data: existing, error: existingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingError && existingError.code !== "PGRST116") {
        throw existingError;
      }

      if (existing) {
        const existingBooking = existing as BookingRecord;
        const bookings = await fetchBookingsForContact(supabase, restaurantId, data.email, data.phone);

        return NextResponse.json({
          booking: existingBooking,
          bookings,
          waitlisted: existingBooking.status === "pending_allocation",
          allocationPending: existingBooking.status === "pending_allocation",
          idempotencyKey,
          clientRequestId: existingBooking.client_request_id,
          duplicate: true,
        });
      }
    }

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

    const bookingDetails = buildBookingDetails({
      idempotencyKey,
      clientRequestId,
      allocationPending,
      userAgent,
    });

    let booking: BookingRecord | null = null;
    let reference = "";
    let reusedExisting = false;

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
          client_request_id: clientRequestId,
          idempotency_key: idempotencyKey ?? null,
          details: bookingDetails,
        });
      } catch (error: unknown) {
        const { code, message } = extractPostgrestError(error);
        const isUniqueViolation = code === "23505" || (message ? /duplicate key value/i.test(message) : false);

        if (!isUniqueViolation) {
          throw error;
        }

        const constraintMessage = message ?? "";
        const duplicateReference = /bookings_reference/i.test(constraintMessage);
        const idempotencyConflict =
          /bookings_idem_unique_per_restaurant/i.test(constraintMessage) ||
          /bookings_client_request_unique/i.test(constraintMessage);

        if (idempotencyConflict) {
          let existing: BookingRecord | null = null;

          if (idempotencyKey) {
            const { data: byKey } = await supabase
              .from("bookings")
              .select("*")
              .eq("restaurant_id", restaurantId)
              .eq("idempotency_key", idempotencyKey)
              .maybeSingle();
            existing = (byKey as BookingRecord | null) ?? null;
          }

          if (!existing) {
            const { data: byRequest } = await supabase
              .from("bookings")
              .select("*")
              .eq("restaurant_id", restaurantId)
              .eq("client_request_id", clientRequestId)
              .maybeSingle();
            existing = (byRequest as BookingRecord | null) ?? null;
          }

          if (existing) {
            booking = existing;
            reusedExisting = true;
            break;
          }

          throw error;
        }

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

    if (!reusedExisting && allocationPending) {
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
    } else if (!reusedExisting && loyaltyProgram) {
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

    const waitlisted = Boolean(waitlistEntry) || finalBooking.status === "pending_allocation";

    if (!reusedExisting) {
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
        actor: data.email,
      });
    }

    const bookings = await fetchBookingsForContact(supabase, restaurantId, data.email, data.phone);

    const responseAllocationPending = finalBooking.status === "pending_allocation";

    if (!reusedExisting) {
      try {
        await enqueueBookingCreatedSideEffects(
          {
            booking: safeBookingPayload(finalBooking),
            waitlisted,
            allocationPending: responseAllocationPending,
            waitlistEntry,
            idempotencyKey,
            restaurantId,
          },
          { supabase },
        );
      } catch (jobError: unknown) {
        console.error("[bookings][POST][side-effects]", stringifyError(jobError));
      }
    }

    return NextResponse.json(
      {
        booking: finalBooking,
        table: table ?? null,
        loyaltyPointsAwarded: loyaltyAward,
        bookings,
        waitlisted,
        allocationPending: responseAllocationPending,
        clientRequestId: finalBooking.client_request_id,
        idempotencyKey,
        duplicate: reusedExisting,
      },
      { status: reusedExisting ? 200 : 201 },
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
async function handleMyBookings(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawParams = {
    me: req.nextUrl.searchParams.get("me"),
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
    sort: req.nextUrl.searchParams.get("sort") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
  };

  const parsed = myBookingsQuerySchema.safeParse(rawParams);

  if (!parsed.success) {
    return handleZodError(parsed.error);
  }

  const params = parsed.data;
  const page = params.page;
  const pageSize = params.pageSize;
  const offset = (page - 1) * pageSize;
  const email = user.email.toLowerCase();
  let fromIso: string | undefined;
  let toIso: string | undefined;

  try {
    fromIso = params.from ? toIsoStringOrThrow(params.from) : undefined;
    toIso = params.to ? toIsoStringOrThrow(params.to) : undefined;
  } catch (error) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const client = getServiceSupabaseClient();
  const relation: "bookings" | "current_bookings" =
    params.status === "active" ? "current_bookings" : "bookings";

  let query = client
    .from(relation)
    .select("id, start_at, end_at, party_size, status, notes, restaurants(name)", { count: "exact" })
    .eq("customer_email", email);

  if (params.restaurantId) {
    query = query.eq("restaurant_id", params.restaurantId);
  }

  if (params.status && params.status !== "active") {
    query = query.eq("status", params.status);
  }

  if (fromIso) {
    query = query.gte("start_at", fromIso);
  }

  if (toIso) {
    query = query.lt("start_at", toIso);
  }

  query = query.order("start_at", { ascending: params.sort === "asc" });

  type BookingRow = {
    id: string;
    start_at: string | Date | null;
    end_at: string | Date | null;
    party_size: number;
    status: BookingDTO['status'];
    notes: string | null;
    restaurants: { name: string } | { name: string }[] | null;
  };

  const { data, error, count } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    console.error("[bookings][GET][me]", error);
    return NextResponse.json({ error: "Unable to fetch bookings" }, { status: 500 });
  }

  const rows: BookingRow[] = (data ?? []) as BookingRow[];

  const items: BookingDTO[] = rows.map((booking) => {
    const restaurant = Array.isArray(booking.restaurants)
      ? booking.restaurants[0] ?? null
      : booking.restaurants;

    return {
      id: booking.id,
      restaurantName: restaurant?.name ?? "",
      partySize: booking.party_size,
      startIso: toIsoString(booking.start_at),
      endIso: toIsoString(booking.end_at),
      status: booking.status,
      notes: booking.notes,
    };
  });

  const total = count ?? items.length;
  const hasNext = offset + items.length < total;

  const response: PageResponse<BookingDTO> = {
    items,
    pageInfo: {
      page,
      pageSize,
      total,
      hasNext,
    },
  };

  return NextResponse.json(response);
}
