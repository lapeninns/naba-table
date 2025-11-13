import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { AssignmentCoordinator } from "@/server/assignments";
import { disableAssignmentPipelineRuntime, isAssignmentPipelineSchemaError } from "@/server/assignments/runtime-guard";
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
import { buildInlineLastResult } from "@/server/capacity/auto-assign-last-result";
import { classifyPlannerReason } from "@/server/capacity/planner-reason";
import { recordPlannerQuoteTelemetry } from "@/server/capacity/planner-telemetry";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import { isAssignmentPipelineV3Enabled } from "@/server/feature-flags";
import { enqueueBookingCreatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { getActiveLoyaltyProgram, calculateLoyaltyAward, applyLoyaltyAward } from "@/server/loyalty";
import { recordObservabilityEvent } from "@/server/observability";
import { getRestaurantBySlug } from "@/server/restaurants/getRestaurantBySlug";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { computeGuestLookupHash } from "@/server/security/guest-lookup";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { anonymizeIp, extractClientIp } from "@/server/security/request";
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getServiceSupabaseClient,
  getTenantServiceSupabaseClient,
} from "@/server/supabase";

import type { AssignmentCoordinatorResult } from "@/server/assignments";
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
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

const bookingSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  restaurantSlug: z.string().regex(slugPattern).optional(),
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

let inlineAssignmentCoordinatorInstance: AssignmentCoordinator | null | undefined;
function getInlineAssignmentCoordinator(): AssignmentCoordinator | null {
  if (inlineAssignmentCoordinatorInstance !== undefined) {
    return inlineAssignmentCoordinatorInstance;
  }
  try {
    inlineAssignmentCoordinatorInstance = new AssignmentCoordinator();
  } catch (error) {
    inlineAssignmentCoordinatorInstance = null;
    console.warn("[bookings][inline-auto-assign] coordinator unavailable, falling back to legacy flow", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return inlineAssignmentCoordinatorInstance;
}

function normalizeIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceUuid(value: string | null): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

type RestaurantResolutionResult =
  | { ok: true; restaurantId: string; source: "payload" | "slug" | "default" }
  | { ok: false; status: number; code: string; error: string };

async function resolveRestaurantId(options: {
  restaurantId?: string | null;
  restaurantSlug?: string | null;
}): Promise<RestaurantResolutionResult> {
  const slug = options.restaurantSlug?.trim().toLowerCase();
  if (slug) {
    try {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant?.id) {
        return { ok: true, restaurantId: restaurant.id, source: "slug" };
      }
      return {
        ok: false,
        status: 404,
        code: "RESTAURANT_NOT_FOUND",
        error: "Restaurant not found",
      };
    } catch (error) {
      console.error("[bookings][POST][slug-lookup]", stringifyError(error));
      return {
        ok: false,
        status: 500,
        code: "RESTAURANT_LOOKUP_FAILED",
        error: "Unable to resolve restaurant",
      };
    }
  }

  const directId = options.restaurantId?.trim();
  if (directId) {
    return { ok: true, restaurantId: directId, source: "payload" };
  }

  const fallbackId = await getDefaultRestaurantId();
  try {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", fallbackId)
      .maybeSingle();

    if (error) {
      console.error("[bookings][POST][default-restaurant]", stringifyError(error));
      return {
        ok: false,
        status: 500,
        code: "RESTAURANT_LOOKUP_FAILED",
        error: "Unable to resolve restaurant",
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        status: 404,
        code: "RESTAURANT_NOT_FOUND",
        error: "Restaurant not found",
      };
    }

    return { ok: true, restaurantId: data.id, source: "default" };
  } catch (error) {
    console.error("[bookings][POST][default-restaurant]", stringifyError(error));
    return {
      ok: false,
      status: 500,
      code: "RESTAURANT_LOOKUP_FAILED",
      error: "Unable to resolve restaurant",
    };
  }
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
    const tenantServiceClient = getTenantServiceSupabaseClient(targetRestaurantId);
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

    const bookings = await fetchBookingsForContact(tenantServiceClient, targetRestaurantId, email, phone);

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
  const restaurantResolution = await resolveRestaurantId({
    restaurantId: data.restaurantId,
    restaurantSlug: data.restaurantSlug,
  });

  if (!restaurantResolution.ok) {
    return NextResponse.json(
      { error: restaurantResolution.error, code: restaurantResolution.code },
      { status: restaurantResolution.status },
    );
  }

  const restaurantId = restaurantResolution.restaurantId;
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

    // Attempt inline auto-assign AFTER sending the initial created email so
    // guests first receive a "request received". If assignment succeeds, we
    // flip status to confirmed and send the confirmation email.
    if (!reusedExisting && env.featureFlags.autoAssignOnBooking) {
      const inlineTimeoutMs = env.featureFlags.inlineAutoAssignTimeoutMs ?? 4000;
      const inlineAttemptId = randomUUID();
      let inlineAttemptStartedAt = 0;
      const inlinePlannerStrategy = { requireAdjacency: null, maxTables: null };
      const inlinePlannerTrigger = "inline_creation";
      const inlineEmailVariant = "standard";
      let inlineTimeoutPersisted = false;
      const persistInlinePlanResult = async (params: {
        success: boolean;
        reason: string | null;
        durationMs: number;
        alternates?: number;
        emailSent: boolean;
        emailVariant: "standard" | "modified" | null;
      }) => {
        const inlineResult = buildInlineLastResult({
          durationMs: params.durationMs,
          success: params.success,
          reason: params.reason,
          strategy: inlinePlannerStrategy,
          trigger: inlinePlannerTrigger,
          alternates: params.alternates,
          attemptId: inlineAttemptId,
          emailSent: params.emailSent,
          emailVariant: params.emailVariant,
        });
        try {
          finalBooking = await updateBookingRecord(supabase, finalBooking.id, {
            auto_assign_last_result: inlineResult,
          });
        } catch (updateError) {
          console.warn("[bookings][POST][inline-auto-assign] persist inline result failed", {
            bookingId: finalBooking.id,
            error: stringifyError(updateError),
          });
        }
      };
      try {
        const { CancellableAutoAssign } = await import("@/server/booking/auto-assign/cancellable-auto-assign");
        const inlineIdempotencyKey = finalBooking.auto_assign_idempotency_key ?? `api-${finalBooking.id}`;
        let assignmentPipelineEnabled = isAssignmentPipelineV3Enabled();
        let inlineCoordinator = assignmentPipelineEnabled ? getInlineAssignmentCoordinator() : null;
        const autoAssign = new CancellableAutoAssign(inlineTimeoutMs);
        inlineAttemptStartedAt = Date.now();

        console.info("[bookings][POST][inline-auto-assign] start", {
          bookingId: finalBooking.id,
          attemptId: inlineAttemptId,
          timeoutMs: inlineTimeoutMs,
        });

        const handleInlineTimeout = async () => {
          const elapsedMs = inlineAttemptStartedAt > 0 ? Date.now() - inlineAttemptStartedAt : undefined;
          await recordObservabilityEvent({
            source: "bookings.inline_auto_assign",
            eventType: "inline_auto_assign.timeout",
            restaurantId,
            bookingId: finalBooking.id,
            context: {
              timeoutMs: inlineTimeoutMs,
              elapsedMs,
              attemptId: inlineAttemptId,
            },
            severity: "warning",
          });
          await persistInlinePlanResult({
            success: false,
            reason: "INLINE_TIMEOUT",
            durationMs: elapsedMs ?? inlineTimeoutMs,
            alternates: 0,
            emailSent: false,
            emailVariant: inlineEmailVariant,
          });
          inlineTimeoutPersisted = true;
        };

        const handleCoordinatorOutcome = async (result: AssignmentCoordinatorResult): Promise<void> => {
          const durationMs = inlineAttemptStartedAt > 0 ? Date.now() - inlineAttemptStartedAt : 0;
          if (result.outcome === "confirmed") {
            const { data: reloaded } = await supabase
              .from("bookings")
              .select("*")
              .eq("id", finalBooking.id)
              .maybeSingle();
            if (reloaded) {
              finalBooking = reloaded as BookingRecord;
            }
            try {
              await sendBookingConfirmationEmail(finalBooking);
            } catch (mailError) {
              console.error("[bookings][POST][inline-confirm-email]", mailError);
            }

            await persistInlinePlanResult({
              success: true,
              reason: null,
              alternates: 0,
              durationMs,
              emailSent: true,
              emailVariant: inlineEmailVariant,
            });

            await recordObservabilityEvent({
              source: "bookings.inline_auto_assign",
              eventType: "inline_auto_assign.confirm_succeeded",
              restaurantId,
              bookingId: finalBooking.id,
              context: {
                attemptId: inlineAttemptId,
                holdId: result.holdId,
                durationMs,
                mode: "coordinator",
              },
            });

            await recordObservabilityEvent({
              source: "bookings.inline_auto_assign",
              eventType: "inline_auto_assign.succeeded",
              restaurantId,
              bookingId: finalBooking.id,
              context: {
                holdId: result.holdId,
                idempotencyKey: inlineIdempotencyKey,
                attemptId: inlineAttemptId,
                durationMs,
                mode: "coordinator",
              },
            });
            return;
          }

          const failureReason = result.reason ?? result.outcome;
          await persistInlinePlanResult({
            success: false,
            reason: failureReason,
            durationMs,
            alternates: 0,
            emailSent: false,
            emailVariant: inlineEmailVariant,
          });

          await recordObservabilityEvent({
            source: "bookings.inline_auto_assign",
            eventType: `inline_auto_assign.coordinator_${result.outcome}`,
            restaurantId,
            bookingId: finalBooking.id,
            context: {
              attemptId: inlineAttemptId,
              reason: failureReason,
              ...(result.outcome === "retry" ? { delay_ms: result.delayMs } : {}),
            },
            severity: result.outcome === "retry" ? "warning" : undefined,
          });
        };

        if (assignmentPipelineEnabled && inlineCoordinator) {
          try {
            await autoAssign.runWithTimeout(
              async (_signal) => {
                const coordinatorResult = await inlineCoordinator!.processBooking(
                  finalBooking.id,
                  inlinePlannerTrigger,
                );
                await handleCoordinatorOutcome(coordinatorResult);
              },
              handleInlineTimeout,
            );
            return;
          } catch (coordinatorError) {
            if (coordinatorError instanceof Error && coordinatorError.name === "AbortError") {
              throw coordinatorError;
            }
            if (isAssignmentPipelineSchemaError(coordinatorError)) {
              disableAssignmentPipelineRuntime("schema_incompatible", coordinatorError);
              assignmentPipelineEnabled = false;
              inlineCoordinator = null;
              console.warn(
                "[bookings][POST][inline-auto-assign] coordinator schema error, falling back to legacy planner",
                {
                  bookingId: finalBooking.id,
                },
              );
            } else {
              throw coordinatorError;
            }
          }
        }

        if (assignmentPipelineEnabled && !inlineCoordinator) {
          console.warn("[bookings][POST][inline-auto-assign] coordinator unavailable, using legacy planner");
        }

        {
          const { quoteTablesForBooking, atomicConfirmAndTransition } = await import("@/server/capacity/tables");
          await autoAssign.runWithTimeout(
            async (signal) => {
              const quoteStartedAt = Date.now();
              let quoteDurationMs = 0;
              let quote: Awaited<ReturnType<typeof quoteTablesForBooking>> | null = null;
              try {
                quote = await quoteTablesForBooking({
                  bookingId: finalBooking.id,
                  createdBy: "api-booking",
                  holdTtlSeconds: 120,
                  signal,
                });
                quoteDurationMs = Date.now() - quoteStartedAt;
                const classification = classifyPlannerReason(quote?.reason ?? null);
                await recordPlannerQuoteTelemetry({
                  restaurantId,
                bookingId: finalBooking.id,
                durationMs: quoteDurationMs,
                success: Boolean(quote?.hold),
                reason: quote?.reason ?? null,
                reasonCode: classification.code,
                reasonCategory: classification.category,
                strategy: inlinePlannerStrategy,
                trigger: inlinePlannerTrigger,
                attemptIndex: 0,
                internalStats: quote?.plannerStats ?? null,
                extraContext: { attemptId: inlineAttemptId },
              });
            } catch (quoteError) {
              quoteDurationMs = Date.now() - quoteStartedAt;
              const inlineQuoteErrorReason =
                quoteError instanceof Error && quoteError.name ? quoteError.name : "QUOTE_ERROR";
              const classification = classifyPlannerReason(inlineQuoteErrorReason);
              await persistInlinePlanResult({
                success: false,
                reason: inlineQuoteErrorReason,
                durationMs: quoteDurationMs,
                alternates: 0,
                emailSent: false,
                emailVariant: inlineEmailVariant,
              });
              await recordPlannerQuoteTelemetry({
                restaurantId,
                bookingId: finalBooking.id,
                durationMs: quoteDurationMs,
                success: false,
                reason: inlineQuoteErrorReason,
                reasonCode: classification.code,
                reasonCategory: classification.category,
                strategy: inlinePlannerStrategy,
                trigger: inlinePlannerTrigger,
                attemptIndex: 0,
                errorMessage: stringifyError(quoteError),
                severity: "warning",
                extraContext: { attemptId: inlineAttemptId },
              });
              console.error("[bookings][POST][inline-auto-assign] quote error", {
                bookingId: finalBooking.id,
                attemptId: inlineAttemptId,
                durationMs: quoteDurationMs,
                error: stringifyError(quoteError),
              });
              await recordObservabilityEvent({
                source: "bookings.inline_auto_assign",
                eventType: "inline_auto_assign.quote_error",
                restaurantId,
                bookingId: finalBooking.id,
                context: {
                  durationMs: quoteDurationMs,
                  attemptId: inlineAttemptId,
                },
                severity: "warning",
              });
              throw quoteError;
            }

            console.info("[bookings][POST][inline-auto-assign] quote result", {
              bookingId: finalBooking.id,
              attemptId: inlineAttemptId,
              durationMs: quoteDurationMs,
              hasHold: Boolean(quote?.hold),
              reason: quote?.reason ?? null,
              alternates: quote?.alternates?.length ?? 0,
            });

            await recordObservabilityEvent({
              source: "bookings.inline_auto_assign",
              eventType: "inline_auto_assign.quote_result",
              restaurantId,
              bookingId: finalBooking.id,
              context: {
                durationMs: quoteDurationMs,
                hasHold: Boolean(quote?.hold),
                attemptId: inlineAttemptId,
                reason: quote?.reason ?? null,
                alternates: quote?.alternates?.length ?? 0,
              },
            });

            if (!quote?.hold) {
              await persistInlinePlanResult({
                success: false,
                reason: quote?.reason ?? null,
                alternates: quote?.alternates?.length ?? 0,
                durationMs: quoteDurationMs,
                emailSent: false,
                emailVariant: inlineEmailVariant,
              });
              console.warn("[bookings][POST][inline-auto-assign] hold not available", {
                bookingId: finalBooking.id,
                reason: quote?.reason ?? "NO_HOLD",
                alternates: quote?.alternates?.length ?? 0,
                attemptId: inlineAttemptId,
                durationMs: quoteDurationMs,
              });
              await recordObservabilityEvent({
                source: "bookings.inline_auto_assign",
                eventType: "inline_auto_assign.no_hold",
                restaurantId,
                bookingId: finalBooking.id,
                context: {
                  reason: quote?.reason ?? "NO_HOLD",
                  alternates: quote?.alternates?.length ?? 0,
                  durationMs: quoteDurationMs,
                  attemptId: inlineAttemptId,
                },
                severity: "info",
              });
              return;
            }

            const confirmStartedAt = Date.now();
            try {
              await atomicConfirmAndTransition({
                bookingId: finalBooking.id,
                holdId: quote.hold.id,
                idempotencyKey: inlineIdempotencyKey,
                assignedBy: null,
                historyReason: "api_inline_auto_assign",
                historyMetadata: { source: "api-inline", holdId: quote.hold.id },
                signal,
              });
            } catch (confirmError) {
              const confirmDurationMs = Date.now() - confirmStartedAt;
              console.error("[bookings][POST][inline-auto-assign] confirm error", {
                bookingId: finalBooking.id,
                attemptId: inlineAttemptId,
                holdId: quote.hold.id,
                durationMs: confirmDurationMs,
                error: stringifyError(confirmError),
              });
              await recordObservabilityEvent({
                source: "bookings.inline_auto_assign",
                eventType: "inline_auto_assign.confirm_failed",
                restaurantId,
                bookingId: finalBooking.id,
                context: {
                  attemptId: inlineAttemptId,
                  holdId: quote.hold.id,
                  durationMs: confirmDurationMs,
                },
                severity: "error",
              });
              throw confirmError;
            }

            const confirmDurationMs = Date.now() - confirmStartedAt;
            console.info("[bookings][POST][inline-auto-assign] confirm completed", {
              bookingId: finalBooking.id,
              attemptId: inlineAttemptId,
              holdId: quote.hold.id,
              durationMs: confirmDurationMs,
            });

            await recordObservabilityEvent({
              source: "bookings.inline_auto_assign",
              eventType: "inline_auto_assign.confirm_succeeded",
              restaurantId,
              bookingId: finalBooking.id,
              context: {
                attemptId: inlineAttemptId,
                holdId: quote.hold.id,
                durationMs: confirmDurationMs,
              },
            });

            const { data: reloaded } = await supabase
              .from("bookings")
              .select("*")
              .eq("id", finalBooking.id)
              .maybeSingle();

            if (reloaded) {
              finalBooking = reloaded as BookingRecord;
              try {
                await sendBookingConfirmationEmail(finalBooking);
              } catch (mailError) {
                console.error("[bookings][POST][inline-confirm-email]", mailError);
              }
            }

            await persistInlinePlanResult({
              success: true,
              reason: quote.reason ?? null,
              alternates: quote?.alternates?.length ?? 0,
              durationMs: quoteDurationMs,
              emailSent: true,
              emailVariant: inlineEmailVariant,
            });

            await recordObservabilityEvent({
              source: "bookings.inline_auto_assign",
              eventType: "inline_auto_assign.succeeded",
              restaurantId,
              bookingId: finalBooking.id,
              context: {
                holdId: quote.hold.id,
                idempotencyKey: inlineIdempotencyKey,
                attemptId: inlineAttemptId,
                quoteDurationMs,
                confirmDurationMs,
              },
            });
          },
            handleInlineTimeout,
          );
        }
      } catch (inlineError) {
        if (inlineError instanceof Error && inlineError.name === "AbortError") {
          const durationMs = inlineAttemptStartedAt > 0 ? Date.now() - inlineAttemptStartedAt : undefined;
          console.warn("[bookings][POST][inline-auto-assign] aborted", {
            bookingId: finalBooking.id,
            durationMs,
            timeoutMs: inlineTimeoutMs,
            attemptId: inlineAttemptId,
          });
          if (!inlineTimeoutPersisted) {
            await persistInlinePlanResult({
              success: false,
              reason: "INLINE_TIMEOUT",
              durationMs: durationMs ?? inlineTimeoutMs,
              alternates: 0,
              emailSent: false,
              emailVariant: inlineEmailVariant,
            });
            inlineTimeoutPersisted = true;
          }
          await recordObservabilityEvent({
            source: "bookings.inline_auto_assign",
            eventType: "inline_auto_assign.operation_aborted",
            restaurantId,
            bookingId: finalBooking.id,
            context: {
              attemptId: inlineAttemptId,
              durationMs,
              timeoutMs: inlineTimeoutMs,
            },
            severity: "warning",
          });
        } else {
          console.warn("[bookings][POST][inline-auto-assign] failed", { error: stringifyError(inlineError) });
        }
      }
    }

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

      // If inline attempt did not confirm and retries are configured, run background job
      try {
        if (env.featureFlags.autoAssignOnBooking && finalBooking.status !== 'confirmed') {
          const { autoAssignAndConfirmIfPossible } = await import("@/server/jobs/auto-assign");
          // Always schedule a background attempt at least once
          void autoAssignAndConfirmIfPossible(finalBooking.id);
        }
      } catch (autoError: unknown) {
        console.error("[bookings][POST][auto-assign]", stringifyError(autoError));
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
