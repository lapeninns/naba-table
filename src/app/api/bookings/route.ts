import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
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
  deriveEndTime,
  fetchBookingsForContact,
  buildBookingAuditSnapshot,
  updateBookingRecord,
  inferMealTypeFromTime,
  logAuditEvent,
  calculateDurationMinutes,
  insertBookingRecord,
  generateUniqueBookingReference,
} from "@/server/bookings";
import {
  generateConfirmationToken,
  computeTokenExpiry,
  attachTokenToBooking,
} from "@/server/bookings/confirmation-token";
import { PastBookingError, assertBookingNotInPast } from "@/server/bookings/pastTimeValidation";
import { OperatingHoursError, assertBookingWithinOperatingWindow } from "@/server/bookings/timeValidation";
import { createBookingWithCapacityCheck } from "@/server/capacity";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { enqueueBookingCreatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { getActiveLoyaltyProgram, calculateLoyaltyAward, applyLoyaltyAward } from "@/server/loyalty";
import { recordObservabilityEvent } from "@/server/observability";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { computeGuestLookupHash } from "@/server/security/guest-lookup";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { anonymizeIp, extractClientIp } from "@/server/security/request";
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
} from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";
import type { Json } from "@/types/supabase";
import type { NextRequest} from "next/server";

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

type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

type BookingCreationError = Error & {
  code?: string;
  details?: Json | null;
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
  reservationIntervalMinutes?: number | null;
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

async function recoverBookingRecord(
  client: ReturnType<typeof getServiceSupabaseClient>,
  args: {
    restaurantId: string;
    idempotencyKey: string | null;
    customerId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
  },
): Promise<BookingRecord | null> {
  // 1) Try idempotency key (strongest signal)
  if (args.idempotencyKey) {
    const { data, error } = await client
      .from("bookings")
      .select("*")
      .eq("restaurant_id", args.restaurantId)
      .eq("idempotency_key", args.idempotencyKey)
      .maybeSingle();

    if (!error && data) {
      return data as BookingRecord;
    }
  }

  // 2) Fallback by booking signature
  const { data: sigData, error: sigError } = await client
    .from("bookings")
    .select("*")
    .eq("restaurant_id", args.restaurantId)
    .eq("customer_id", args.customerId)
    .eq("booking_date", args.bookingDate)
    .eq("start_time", args.startTime)
    .eq("end_time", args.endTime)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sigError && sigData) {
    return sigData as BookingRecord;
  }

  return null;
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
    let scheduleTimezone: string | null = null;

    try {
      const schedule = await getRestaurantSchedule(restaurantId, {
        date: data.date,
        client: supabase,
      });

      scheduleTimezone = schedule.timezone;

      const { time } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: data.time,
        bookingType: normalizedBookingType,
      });

      startTime = time;

      // Validate booking is not in the past (if feature flag enabled)
      if (env.featureFlags.bookingPastTimeBlocking) {
        try {
          assertBookingNotInPast(
            schedule.timezone,
            data.date,
            startTime,
            {
              graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
            }
          );
        } catch (pastTimeError) {
          if (pastTimeError instanceof PastBookingError) {
            // Log blocked attempt
            void recordObservabilityEvent({
              source: "api.bookings",
              eventType: "booking.past_time.blocked",
              severity: "warning",
              context: {
                restaurantId,
                endpoint: "bookings.create",
                actorRole: null,
                ipScope: anonymizeIp(clientIp),
                ...pastTimeError.details,
              },
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

    const loyaltyProgram = await getActiveLoyaltyProgram(supabase, restaurantId);
    const estimatedLoyaltyAward = loyaltyProgram
      ? calculateLoyaltyAward(loyaltyProgram, { partySize: data.party })
      : 0;

    const useUnifiedValidation = env.featureFlags.bookingValidationUnified;

    let booking: BookingRecord | undefined;
    let reusedExisting = false;
    if (useUnifiedValidation) {
      const validationService = createBookingValidationService({ client: supabase });

      const bookingInput: BookingInput = {
        restaurantId,
        serviceId: normalizedBookingType,
        bookingType: normalizedBookingType,
        partySize: data.party,
        start: `${data.date}T${startTime}:00`,
        durationMinutes: calculateDurationMinutes(normalizedBookingType),
        seatingPreference: data.seating,
        notes: data.notes ?? null,
        customerId: customer.id,
        customerName: data.name,
        customerEmail: normalizeEmail(data.email),
        customerPhone: data.phone.trim(),
        marketingOptIn: data.marketingOptIn ?? false,
        source: "api",
        idempotencyKey,
      };

      const context = {
        actorId: clientRequestId,
        actorRoles: ["customer"],
        actorCapabilities: [],
        tz: scheduleTimezone ?? "Europe/London",
        flags: {
          bookingPastTimeBlocking: env.featureFlags.bookingPastTimeBlocking ?? false,
          bookingPastTimeGraceMinutes: env.featureFlags.bookingPastTimeGraceMinutes ?? 5,
          unified: true,
        },
        metadata: {
          clientRequestId,
        },
      } satisfies ValidationContext;

      try {
        const commit = await validationService.createWithEnforcement(bookingInput, context);
        booking = commit.booking as BookingRecord;
        reusedExisting = commit.duplicate === true;
      } catch (error) {
        if (error instanceof BookingValidationError) {
          const mapped = mapValidationFailure(error.response);
          return NextResponse.json(mapped.body, withValidationHeaders({ status: mapped.status }));
        }
        throw error;
      }
    } else {
      const bookingResult = await createBookingWithCapacityCheck({
        restaurantId,
        customerId: customer.id,
        bookingDate: data.date,
        startTime,
        endTime,
        partySize: data.party,
        bookingType: normalizedBookingType,
        customerName: data.name,
        customerEmail: normalizeEmail(data.email),
        customerPhone: data.phone.trim(),
        seatingPreference: data.seating,
        notes: data.notes ?? null,
        marketingOptIn: data.marketingOptIn ?? false,
        idempotencyKey,
        source: "api",
        authUserId: null,
        clientRequestId,
      });

      booking = bookingResult.booking as BookingRecord | undefined;

      if (!booking) {
        // Attempt to recover the booking record if the RPC didn't return it
        const recovered = await recoverBookingRecord(supabase, {
          restaurantId,
          idempotencyKey,
          customerId: customer.id,
          bookingDate: data.date,
          startTime,
          endTime,
        });

        if (recovered) {
          booking = recovered;
          void recordObservabilityEvent({
            source: "api.bookings",
            eventType: "booking.create.recovered",
            severity: "warning",
            context: {
              restaurantId,
              idempotencyKey: idempotencyKey ?? undefined,
              method: idempotencyKey ? "idempotency_key" : "signature",
            },
          });
        } else {
          // As a last resort, create the record directly (capacity not enforced here)
          try {
            const reference = await generateUniqueBookingReference(supabase);
            const created = await insertBookingRecord(supabase, {
              restaurant_id: restaurantId,
              customer_id: customer.id,
              booking_date: data.date,
              start_time: startTime,
              end_time: endTime,
              party_size: data.party,
              booking_type: normalizedBookingType,
              seating_preference: data.seating,
              status: "pending",
              reference,
              customer_name: data.name,
              customer_email: normalizeEmail(data.email),
              customer_phone: data.phone.trim(),
              notes: data.notes ?? null,
              marketing_opt_in: data.marketingOptIn ?? false,
              loyalty_points_awarded: 0,
              source: "api",
              client_request_id: clientRequestId,
              idempotency_key: idempotencyKey ?? null,
              details: { fallback: "missing_rpc_booking_record" } as Json,
            });

            booking = created as BookingRecord;
            void recordObservabilityEvent({
              source: "api.bookings",
              eventType: "booking.create.insert_fallback",
              severity: "warning",
              context: {
                restaurantId,
                idempotencyKey: idempotencyKey ?? undefined,
              },
            });
          } catch (createFallbackError) {
            throw new Error(
              `Booking creation succeeded but booking record could not be retrieved or created: ${
                stringifyError(createFallbackError)
              }`,
            );
          }
        }
      }

      reusedExisting = bookingResult.duplicate === true;

      // Enforce default initial status to 'pending' for newly created bookings (RPC may return 'confirmed').
      if (!reusedExisting && booking.status !== "pending") {
        try {
          booking = await updateBookingRecord(supabase, booking.id, { status: "pending" });
        } catch (statusError) {
          console.error("[bookings][POST][status-enforce]", stringifyError(statusError));
        }
      }
    }

    let finalBooking = booking;
    let loyaltyAward = 0;

    if (!reusedExisting && loyaltyProgram) {
      loyaltyAward = estimatedLoyaltyAward;

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

          finalBooking = await updateBookingRecord(supabase, booking.id, {
            loyalty_points_awarded: loyaltyAward,
          });
        } catch (error) {
          console.error("[bookings][POST][loyalty] Failed to record loyalty award", {
            bookingId: booking.id,
            error: stringifyError(error),
          });
          loyaltyAward = 0;

          finalBooking = await updateBookingRecord(supabase, booking.id, {
            loyalty_points_awarded: 0,
          });
        }
      }
    } else {
      const awardedFromRecord = "loyalty_points_awarded" in finalBooking && typeof finalBooking.loyalty_points_awarded === "number"
        ? finalBooking.loyalty_points_awarded
        : (finalBooking as Record<string, unknown>).loyalty_points_awarded;
      loyaltyAward = typeof awardedFromRecord === "number" ? awardedFromRecord : 0;
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

    const responsePayload = {
      booking: finalBooking,
      confirmationToken,
      loyaltyPointsAwarded: loyaltyAward,
      bookings,
      clientRequestId: finalBooking.client_request_id,
      idempotencyKey,
      duplicate: reusedExisting,
      capacity: null,
    };

    const responseInit = useUnifiedValidation
      ? withValidationHeaders({ status: reusedExisting ? 200 : 201 })
      : { status: reusedExisting ? 200 : 201 };

    const res = NextResponse.json(responsePayload, responseInit);
    if (confirmationToken) {
      try {
        // Ephemeral confirmation token cookie for PRG access on /thank-you (no URL leakage)
        res.cookies.set('sr_confirm', confirmationToken, {
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
          path: '/thank-you',
          maxAge: 60 * 60, // 1 hour
        });
      } catch (e) {
        // Non-fatal; continue without cookie
      }
    }
    return res;
  } catch (error: unknown) {
    const message = stringifyError(error);
    const enriched = error as BookingCreationError | undefined;
    const errorCode = enriched?.code;
    const errorDetails = enriched?.details ?? null;

    if (errorDetails) {
      console.error("[bookings][POST][details]", errorDetails);
    }

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
        errorCode,
        details: errorDetails,
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
  let query =
    params.status === "active"
      ? client
          .from("current_bookings")
          .select(
            "id, restaurant_id, start_at, end_at, party_size, status, notes, restaurants(id, name, slug, timezone, reservation_interval_minutes)",
            { count: "exact" },
          )
          .eq("customer_email", email)
      : client
          .from("bookings")
          .select(
            "id, restaurant_id, start_at, end_at, party_size, status, notes, restaurants(id, name, slug, timezone, reservation_interval_minutes)",
            { count: "exact" },
          )
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
    restaurant_id: string | null;
    start_at: string | Date | null;
    end_at: string | Date | null;
    party_size: number;
    status: BookingDTO["status"];
    notes: string | null;
    restaurants:
      | {
          id?: string | null;
          name: string;
          slug?: string | null;
          timezone?: string | null;
          reservation_interval_minutes?: number | null;
        }
      | {
          id?: string | null;
          name: string;
          slug?: string | null;
          timezone?: string | null;
          reservation_interval_minutes?: number | null;
        }[]
      | null;
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
    const interval =
      restaurant && typeof restaurant.reservation_interval_minutes === "number"
        ? restaurant.reservation_interval_minutes
        : null;

    return {
      id: booking.id,
      restaurantId: booking.restaurant_id ?? null,
      restaurantName: restaurant?.name ?? "",
      restaurantSlug: restaurant?.slug ?? null,
      restaurantTimezone: restaurant?.timezone ?? null,
      partySize: booking.party_size,
      startIso: toIsoString(booking.start_at),
      endIso: toIsoString(booking.end_at),
      status: booking.status,
      notes: booking.notes,
      customerName: null as BookingDTO["customerName"],
      customerEmail: null as BookingDTO["customerEmail"],
      reservationIntervalMinutes: interval,
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
