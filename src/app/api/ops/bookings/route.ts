import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { deriveEndTime, fetchBookingsForContact, generateUniqueBookingReference, inferMealTypeFromTime, insertBookingRecord } from "@/server/bookings";
import { normalizeEmail, upsertCustomer } from "@/server/customers";
import { enqueueBookingCreatedSideEffects, safeBookingPayload } from "@/server/jobs/booking-side-effects";
import { recordObservabilityEvent } from "@/server/observability";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { anonymizeIp, extractClientIp } from "@/server/security/request";
import { fetchUserMemberships, requireMembershipForRestaurant } from "@/server/team/access";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { PastBookingError, assertBookingNotInPast, canOverridePastBooking } from "@/server/bookings/pastTimeValidation";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import type { BookingRecord } from "@/server/bookings";
import type { Json, Tables } from "@/types/supabase";
import type { RestaurantRole } from "@/lib/owner/auth/roles";
import { opsWalkInBookingSchema, type OpsWalkInBookingPayload } from "./schema";

const OPS_CHANNEL = "ops.walkin";
const SYSTEM_SOURCE = "system";

type BookingPayload = OpsWalkInBookingPayload;

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

function buildRequestDetails(params: {
  idempotencyKey: string | null;
  clientRequestId: string;
  userAgent: string | null;
  staffId: string;
  staffEmail: string | null;
  emailProvided: boolean;
  phoneProvided: boolean;
  emailValue: string;
  phoneValue: string;
}): Record<string, unknown> {
  return {
    channel: OPS_CHANNEL,
    request: {
      idempotency_key: params.idempotencyKey,
      client_request_id: params.clientRequestId,
      user_agent: params.userAgent ?? null,
    },
    staff: {
      id: params.staffId,
      email: params.staffEmail,
    },
    created_by: SYSTEM_SOURCE,
    provided_contact: {
      email: params.emailProvided,
      phone: params.phoneProvided,
      email_value: params.emailValue || null,
      phone_value: params.phoneValue || null,
    },
  } as const;
}

function ensureFallbackContact(value: string | null | undefined, clientRequestId: string, kind: "email" | "phone"): string {
  const trimmed = (value ?? "").trim();
  if (trimmed) {
    return trimmed;
  }

  const slug = clientRequestId.replace(/[^a-z0-9]/gi, "").slice(0, 24) || randomUUID();
  if (kind === "email") {
    return `walkin+${slug}@system.local`;
  }
  return `000-${slug}`;
}

const OPS_BOOKING_STATUSES = [
  "pending",
  "pending_allocation",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;

function sanitizeSearchTerm(input: string): string {
  return input.replace(/([\\%_])/g, '\\$1');
}

const opsBookingsQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  status: z.enum(OPS_BOOKING_STATUSES).optional(),
  statuses: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return [] as typeof OPS_BOOKING_STATUSES[number][];
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is typeof OPS_BOOKING_STATUSES[number] =>
          OPS_BOOKING_STATUSES.includes(entry as (typeof OPS_BOOKING_STATUSES)[number]),
        );
    }),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  query: z
    .string()
    .trim()
    .max(80)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional(),
});

type OpsBookingRow = Pick<
  Tables<"bookings">,
  "id" | "start_at" | "end_at" | "booking_date" | "start_time" | "end_time" | "party_size" | "status" | "notes" | "restaurant_id" | "customer_name" | "customer_email" | "customer_phone"
> & {
  restaurants?: { name: string | null } | { name: string | null }[] | null;
};

type BookingDTO = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  partySize: number;
  startIso: string;
  endIso: string;
  status: OpsBookingRow["status"];
  notes?: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

type PageResponse = {
  items: BookingDTO[];
  pageInfo: PageInfo;
};

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

function deriveFallbackIso(date: string | null | undefined, time: string | null | undefined): string {
  if (!date || !time) return "";
  const candidate = new Date(`${date}T${time}`);
  if (Number.isNaN(candidate.getTime())) {
    return "";
  }
  return candidate.toISOString();
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings][GET] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const clientIp = extractClientIp(req);
  const listRateResult = await consumeRateLimit({
    identifier: `ops:bookings:get:${user.id}`,
    limit: 120,
    windowMs: 60_000,
  });

  if (!listRateResult.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((listRateResult.resetAt - Date.now()) / 1000));
    void recordObservabilityEvent({
      source: "api.ops",
      eventType: "ops_bookings.rate_limited",
      severity: "warning",
      context: {
        action: "list",
        staff_id: user.id,
        ip_scope: anonymizeIp(clientIp),
        limit: listRateResult.limit,
        reset_at: new Date(listRateResult.resetAt).toISOString(),
        rate_source: listRateResult.source,
      },
    });

    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED", retryAfter: retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      },
    );
  }

  const rawParams = {
    restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    statuses: req.nextUrl.searchParams.get("statuses") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
    sort: req.nextUrl.searchParams.get("sort") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    query: req.nextUrl.searchParams.get("query") ?? undefined,
  };

  const parsed = opsBookingsQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    console.error("[ops/bookings][GET] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify memberships" }, { status: 500 });
  }

  if (memberships.length === 0) {
    const empty: PageResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let targetRestaurantId = params.restaurantId;

  if (targetRestaurantId) {
    const allowed = membershipIds.includes(targetRestaurantId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    targetRestaurantId = membershipIds[0] ?? null;
  }

  if (!targetRestaurantId) {
    const empty: PageResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const offset = (params.page - 1) * params.pageSize;
  const serviceSupabase = getServiceSupabaseClient();

  let query = serviceSupabase
    .from("bookings")
    .select(
      "id, start_at, end_at, booking_date, start_time, end_time, party_size, status, notes, restaurant_id, customer_name, customer_email, customer_phone, restaurants(name)",
      { count: "exact" },
    )
    .eq("restaurant_id", targetRestaurantId);

  if (params.statuses.length > 0) {
    query = query.in("status", params.statuses);
  } else if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.from) {
    query = query.gte("start_at", params.from);
  }

  if (params.to) {
    query = query.lt("start_at", params.to);
  }

  query = query.order("start_at", { ascending: params.sort === "asc" });

  if (params.query) {
    const escaped = sanitizeSearchTerm(params.query);
    const pattern = `%${escaped}%`;
    query = query.or(`customer_name.ilike.${pattern},customer_email.ilike.${pattern}`);
  }

  const { data, error, count } = await query.range(offset, offset + params.pageSize - 1);

  if (error) {
    console.error("[ops/bookings][GET] query failed", error);
    return NextResponse.json({ error: "Unable to fetch bookings" }, { status: 500 });
  }

  const rows: OpsBookingRow[] = (data ?? []) as OpsBookingRow[];

  const items: BookingDTO[] = rows.map((row) => {
    const restaurantRelation = Array.isArray(row.restaurants)
      ? row.restaurants[0] ?? null
      : row.restaurants ?? null;
    const startIso = toIsoString(row.start_at) || deriveFallbackIso(row.booking_date, row.start_time);
    const endIso = toIsoString(row.end_at) || deriveFallbackIso(row.booking_date, row.end_time);
    const rawPhone = typeof row.customer_phone === "string" ? row.customer_phone.trim() : "";
    const customerPhone = rawPhone.length > 0 ? rawPhone : null;

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: restaurantRelation?.name ?? "",
      partySize: row.party_size,
      startIso,
      endIso,
      status: row.status,
      notes: row.notes ?? null,
      customerName: row.customer_name ?? null,
      customerEmail: row.customer_email ?? null,
      customerPhone,
    };
  });

  const total = count ?? items.length;
  const hasNext = offset + items.length < total;

  const response: PageResponse = {
    items,
    pageInfo: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasNext,
    },
  };

  void recordObservabilityEvent({
    source: "api.ops",
    eventType: "ops_bookings.list",
    context: {
      staff_id: user.id,
      restaurant_id: params.restaurantId ?? null,
      result_count: items.length,
      rate_source: listRateResult.source,
    },
  });

  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/bookings] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let payload: BookingPayload;
  try {
    const parsed = opsWalkInBookingSchema.parse(await req.json());
    payload = parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const clientIp = extractClientIp(req);
  const createRateResult = await consumeRateLimit({
    identifier: `ops:bookings:create:${user.id}:${payload.restaurantId}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!createRateResult.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((createRateResult.resetAt - Date.now()) / 1000));
    void recordObservabilityEvent({
      source: "api.ops",
      eventType: "ops_bookings.rate_limited",
      severity: "warning",
      context: {
        action: "create",
        staff_id: user.id,
        restaurant_id: payload.restaurantId,
        ip_scope: anonymizeIp(clientIp),
        limit: createRateResult.limit,
        reset_at: new Date(createRateResult.resetAt).toISOString(),
        rate_source: createRateResult.source,
      },
    });

    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED", retryAfter: retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      },
    );
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: payload.restaurantId });
  } catch (error) {
    console.error("[ops/bookings] membership validation failed", error);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = getServiceSupabaseClient();
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const normalizedIdempotencyKey = typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0 ? idempotencyKey.trim() : null;
  const clientRequestId = normalizedIdempotencyKey && /^[0-9a-f-]{36}$/i.test(normalizedIdempotencyKey)
    ? normalizedIdempotencyKey
    : randomUUID();
  const userAgent = req.headers.get("user-agent");

  const startTime = payload.time;
  const bookingType = payload.bookingType === "drinks" ? "drinks" : inferMealTypeFromTime(startTime);
  const endTime = deriveEndTime(startTime, bookingType);

  // Validate booking is not in the past (if feature flag enabled)
  if (env.featureFlags.bookingPastTimeBlocking) {
    const allowPastParam = req.nextUrl.searchParams.get("allow_past");
    const allowOverride = allowPastParam === "true";

    // Get user's role for the restaurant
    const memberships = await fetchUserMemberships(user.id, service);
    const membership = memberships.find(m => m.restaurant_id === payload.restaurantId);
    const userRole = membership?.role as RestaurantRole | null;

    try {
      const schedule = await getRestaurantSchedule(payload.restaurantId, {
        date: payload.date,
        client: service,
      });

      assertBookingNotInPast(
        schedule.timezone,
        payload.date,
        startTime,
        {
          graceMinutes: env.featureFlags.bookingPastTimeGraceMinutes,
          allowOverride,
          actorRole: userRole,
        }
      );

      // Log successful override if admin used it
      if (allowOverride && canOverridePastBooking(userRole)) {
        void recordObservabilityEvent({
          source: "api.ops.bookings",
          eventType: "booking.past_time.override",
          severity: "info",
          context: {
            restaurantId: payload.restaurantId,
            endpoint: "ops.bookings.create",
            actorId: user.id,
            actorEmail: user.email,
            actorRole: userRole,
            timezone: schedule.timezone,
            bookingDate: payload.date,
            bookingTime: startTime,
          },
        });
      }
    } catch (pastTimeError) {
      if (pastTimeError instanceof PastBookingError) {
        // Log blocked attempt
        void recordObservabilityEvent({
          source: "api.ops.bookings",
          eventType: "booking.past_time.blocked",
          severity: "warning",
          context: {
            restaurantId: payload.restaurantId,
            endpoint: "ops.bookings.create",
            actorId: user.id,
            actorEmail: user.email,
            actorRole: userRole,
            ipScope: anonymizeIp(clientIp),
            overrideAttempted: allowOverride,
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

  const customerEmailForRecord = (payload.email ?? "").trim();
  const customerPhoneForRecord = (payload.phone ?? "").trim();
  const emailProvided = customerEmailForRecord.length > 0;
  const phoneProvided = customerPhoneForRecord.length > 0;

  const fallbackEmail = ensureFallbackContact(payload.email, clientRequestId, "email");
  const fallbackPhone = ensureFallbackContact(payload.phone, clientRequestId, "phone");

  const customer = await upsertCustomer(service, {
    restaurantId: payload.restaurantId,
    email: fallbackEmail,
    phone: fallbackPhone,
    name: payload.name,
    marketingOptIn: payload.marketingOptIn ?? false,
  });

  if (normalizedIdempotencyKey) {
    const { data: existing, error: existingError } = await service
      .from("bookings")
      .select("*")
      .eq("restaurant_id", payload.restaurantId)
      .eq("idempotency_key", normalizedIdempotencyKey)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("[ops/bookings] idempotency lookup failed", existingError.message);
      return NextResponse.json({ error: "Unable to verify idempotency" }, { status: 500 });
    }

    if (existing) {
      const bookings = await fetchBookingsForContact(service, payload.restaurantId, fallbackEmail, fallbackPhone);
      return NextResponse.json({
        booking: existing,
        bookings,
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId: (existing as BookingRecord).client_request_id,
        duplicate: true,
      });
    }
  }

  let booking: BookingRecord | null = null;
  let reference = "";

  for (let attempt = 0; attempt < 5 && !booking; attempt += 1) {
    reference = await generateUniqueBookingReference(service);

    try {
      const details = buildRequestDetails({
        idempotencyKey: normalizedIdempotencyKey,
        clientRequestId,
        userAgent,
        staffId: user.id,
        staffEmail: user.email ?? null,
        emailProvided,
        phoneProvided,
        emailValue: emailProvided ? customerEmailForRecord : "",
        phoneValue: phoneProvided ? customerPhoneForRecord : "",
      });

      booking = await insertBookingRecord(service, {
        restaurant_id: payload.restaurantId,
        customer_id: customer.id,
        booking_date: payload.date,
        start_time: startTime,
        end_time: endTime,
        reference,
        party_size: payload.party,
        booking_type: bookingType,
        seating_preference: payload.seating as BookingRecord["seating_preference"],
        status: "confirmed",
        customer_name: payload.name,
        customer_email: emailProvided ? normalizeEmail(customerEmailForRecord) : "",
        customer_phone: phoneProvided ? payload.phone!.trim() : "",
        notes: payload.notes ?? null,
        marketing_opt_in: payload.marketingOptIn ?? false,
        source: SYSTEM_SOURCE,
        client_request_id: clientRequestId,
        idempotency_key: normalizedIdempotencyKey ?? null,
        details: details as Json,
      });
    } catch (error: unknown) {
      const { code, message } = extractPostgrestError(error);
      const isUniqueViolation = code === "23505" || (message ? /duplicate key value/i.test(message) : false);

      if (!isUniqueViolation) {
        console.error("[ops/bookings] insert failed", error);
        return NextResponse.json({ error: "Unable to create booking" }, { status: 500 });
      }

      const constraintMessage = message ?? "";
      const duplicateReference = /bookings_reference/i.test(constraintMessage);
      const idempotencyConflict =
        /bookings_idem_unique_per_restaurant/i.test(constraintMessage) ||
        /bookings_client_request_unique/i.test(constraintMessage);

      if (idempotencyConflict) {
        const { data: existing } = await service
          .from("bookings")
          .select("*")
          .eq("restaurant_id", payload.restaurantId)
          .eq("client_request_id", clientRequestId)
          .maybeSingle();

        if (existing) {
          booking = existing as BookingRecord;
          break;
        }

        return NextResponse.json({ error: "Duplicate request" }, { status: 409 });
      }

      if (!duplicateReference) {
        console.error("[ops/bookings] insert conflict", error);
        return NextResponse.json({ error: "Unable to create booking" }, { status: 500 });
      }
    }
  }

  if (!booking) {
    return NextResponse.json({ error: "Unable to allocate booking reference" }, { status: 500 });
  }

  const bookings = await fetchBookingsForContact(service, payload.restaurantId, fallbackEmail, fallbackPhone);

  await enqueueBookingCreatedSideEffects({
    booking: safeBookingPayload(booking),
    idempotencyKey: normalizedIdempotencyKey,
    restaurantId: payload.restaurantId,
  });

  const responseBody = {
    booking,
    bookings,
    idempotencyKey: normalizedIdempotencyKey,
    clientRequestId,
  };

  void recordObservabilityEvent({
    source: "api.ops",
    eventType: "ops_bookings.create",
    context: {
      staff_id: user.id,
      restaurant_id: payload.restaurantId,
      booking_id: booking.id,
      rate_source: createRateResult.source,
    },
  });

  return NextResponse.json(responseBody, { status: 201 });
}
