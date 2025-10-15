import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  BOOKING_TYPES,
  SEATING_OPTIONS,
  deriveEndTime,
  fetchBookingsForContact,
  insertBookingRecord,
  buildBookingAuditSnapshot,
  updateBookingRecord,
  inferMealTypeFromTime,
  logAuditEvent,
  generateUniqueBookingReference,
} from "@/server/bookings";
import {
  generateConfirmationToken,
  computeTokenExpiry,
  attachTokenToBooking,
} from "@/server/bookings/confirmation-token";
import type { BookingRecord } from "@/server/bookings";
import type { Json } from "@/types/supabase";
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
} from "@/server/supabase";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { getActiveLoyaltyProgram, calculateLoyaltyAward, applyLoyaltyAward } from "@/server/loyalty";
import { enqueueBookingCreatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { recordObservabilityEvent } from "@/server/observability";
import { computeGuestLookupHash } from "@/server/security/guest-lookup";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { anonymizeIp, extractClientIp } from "@/server/security/request";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { OperatingHoursError, assertBookingWithinOperatingWindow } from "@/server/bookings/timeValidation";

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
  userAgent: string | null;
}): Json {
  return {
    channel: "api.bookings",
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
  customerName?: string | null;
  customerEmail?: string | null;
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
    const clientIp = extractClientIp(req);

    const rateResult = await consumeRateLimit({
      identifier: `bookings:lookup:${targetRestaurantId}:${clientIp}`,
      limit: 20,
      windowMs: 60_000,
    });

    if (!rateResult.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));
      void recordObservabilityEvent({
        source: "api.bookings",
        eventType: "guest_lookup.rate_limited",
        severity: "warning",
        context: {
          restaurant_id: targetRestaurantId,
          ip_scope: anonymizeIp(clientIp),
          reset_at: new Date(rateResult.resetAt).toISOString(),
          limit: rateResult.limit,
          window_ms: 60_000,
          rate_source: rateResult.source,
        },
      });

      return NextResponse.json(
        {
          error: "Too many requests",
          code: "RATE_LIMITED",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        },
      );
    }

    const shouldUseGuestLookupPolicy =
      env.featureFlags.guestLookupPolicy && !!env.security.guestLookupPepper;

    if (shouldUseGuestLookupPolicy) {
      const contactHash = computeGuestLookupHash({
        restaurantId: targetRestaurantId,
        email,
        phone,
      });

      if (contactHash) {
        try {
          const { data: guestRows, error: guestError } = await supabase.rpc("get_guest_bookings", {
            p_restaurant_id: targetRestaurantId,
            p_hash: contactHash,
          });

          if (!guestError && Array.isArray(guestRows)) {
            void recordObservabilityEvent({
              source: "api.bookings",
              eventType: "guest_lookup.allowed",
              context: {
                restaurant_id: targetRestaurantId,
                ip_scope: anonymizeIp(clientIp),
                matched: guestRows.length > 0,
                count: guestRows.length,
                policy_enabled: true,
                lookup_strategy: "policy",
                rate_source: rateResult.source,
              },
            });

            return NextResponse.json({ bookings: guestRows });
          }

          if (guestError) {
            const guestCode = typeof guestError.code === "string" ? guestError.code : undefined;
            const message = stringifyError(guestError);
            const isMissingFunction =
              guestCode === "PGRST100" || guestCode === "42883" || message.includes("get_guest_bookings");

            if (!isMissingFunction) {
              console.error("[bookings][GET][guest-lookup] rpc failed", message);
            }
          }
        } catch (guestError) {
          console.error("[bookings][GET][guest-lookup] unexpected error", stringifyError(guestError));
        }
      }
    }

    const bookings = await fetchBookingsForContact(supabase, targetRestaurantId, email, phone);

    void recordObservabilityEvent({
      source: "api.bookings",
      eventType: "guest_lookup.allowed",
      context: {
        restaurant_id: targetRestaurantId,
        ip_scope: anonymizeIp(clientIp),
        matched: bookings.length > 0,
        count: bookings.length,
        policy_enabled: shouldUseGuestLookupPolicy,
        lookup_strategy: shouldUseGuestLookupPolicy ? "legacy-fallback" : "legacy",
        rate_source: rateResult.source,
      },
    });

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
  const clientIp = extractClientIp(req);

  // Rate limiting for booking creation
  const rateResult = await consumeRateLimit({
    identifier: `bookings:create:${restaurantId}:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateResult.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));

    // Log rate limit event
    void recordObservabilityEvent({
      source: "api.bookings",
      eventType: "booking_creation.rate_limited",
      severity: "warning",
      context: {
        restaurant_id: restaurantId,
        ip_scope: anonymizeIp(clientIp),
        reset_at: new Date(rateResult.resetAt).toISOString(),
        limit: rateResult.limit,
        window_ms: 60_000,
        rate_source: rateResult.source,
      },
    });

    return NextResponse.json(
      {
        error: "Too many booking requests. Please try again in a moment.",
        code: "RATE_LIMITED",
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "X-RateLimit-Limit": rateResult.limit.toString(),
          "X-RateLimit-Remaining": rateResult.remaining.toString(),
          "X-RateLimit-Reset": rateResult.resetAt.toString(),
        },
      },
    );
  }

  const idempotencyKey = normalizeIdempotencyKey(req.headers.get("Idempotency-Key"));
  const clientRequestId = coerceUuid(idempotencyKey) ?? randomUUID();
  const userAgent = req.headers.get("user-agent");

  try {
    const supabase = getServiceSupabaseClient();
    const normalizedBookingType = data.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(data.time);

    let startTime = data.time;

    try {
      const schedule = await getRestaurantSchedule(restaurantId, {
        date: data.date,
        client: supabase,
      });

      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
        bookingType: normalizedBookingType,
      });

      startTime = time;
    } catch (validationError) {
      if (validationError instanceof OperatingHoursError) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      throw validationError;
    }

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
          idempotencyKey,
          clientRequestId: existingBooking.client_request_id,
          duplicate: true,
        });
      }
    }

    const loyaltyProgram = await getActiveLoyaltyProgram(supabase, restaurantId);

    const bookingDetails = buildBookingDetails({
      idempotencyKey,
      clientRequestId,
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
          customer_id: customer.id,
          booking_date: data.date,
          start_time: startTime,
          end_time: endTime,
          reference,
          party_size: data.party,
          booking_type: normalizedBookingType,
          seating_preference: data.seating,
          status: "confirmed",
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

    if (!reusedExisting && loyaltyProgram) {
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

      if (loyaltyAward > 0) {
        finalBooking = await updateBookingRecord(supabase, booking.id, {
          loyalty_points_awarded: loyaltyAward,
        });
      }
    }

    if (!reusedExisting) {
      const auditMetadata = {
        restaurant_id: restaurantId,
        customer_id: customer.id,
        reference: finalBooking.reference,
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

    if (!reusedExisting) {
      try {
        await enqueueBookingCreatedSideEffects(
          {
            booking: safeBookingPayload(finalBooking),
            idempotencyKey,
            restaurantId,
          },
          { supabase },
        );
      } catch (jobError: unknown) {
        console.error("[bookings][POST][side-effects]", stringifyError(jobError));
      }
    }

    // Generate confirmation token for guest access to confirmation page
    let confirmationToken: string | null = null;
    if (!reusedExisting) {
      try {
        confirmationToken = generateConfirmationToken();
        const tokenExpiry = computeTokenExpiry(1); // 1 hour expiry

        await attachTokenToBooking(finalBooking.id, confirmationToken, tokenExpiry);
      } catch (tokenError: unknown) {
        console.error("[bookings][POST][confirmation-token]", stringifyError(tokenError));
        // Non-fatal: booking still succeeded, just no token for guest confirmation
        confirmationToken = null;
      }
    }

    return NextResponse.json(
      {
        booking: finalBooking,
        confirmationToken,
        loyaltyPointsAwarded: loyaltyAward,
        bookings,
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
      customerName: null as BookingDTO["customerName"],
      customerEmail: null as BookingDTO["customerEmail"],
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
