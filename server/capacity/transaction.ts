import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateUniqueBookingReference, insertBookingRecord } from "@/server/bookings";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Json } from "@/types/supabase";
import {
  CapacityError,
  type BookingResult,
  type CreateBookingParams,
  type UpdateBookingParams,
  type BookingErrorDetails,
  type CapacityInfo,
  type BookingRecord,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "./types";

type DbClient = SupabaseClient<Database, "public", any>;

type RetryableError = {
  message?: string;
  code?: string;
};

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as RetryableError;
  const message = record.message?.toLowerCase() ?? "";
  const code = record.code?.toLowerCase() ?? "";

  const retryableCodes = new Set(["40001", "40p01", "55p03"]);
  if (retryableCodes.has(code)) {
    return true;
  }

  return [
    "serialization failure",
    "deadlock detected",
    "could not serialize access",
    "lock not available",
  ].some((pattern) => message.includes(pattern));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: Record<string, unknown>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxRetries || !isRetryableError(error)) {
        break;
      }

      const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.transaction.retry",
        severity: "info",
        context: {
          ...(context ?? {}),
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          delayMs: delay,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

type CapacityRpcPayload = {
  success?: boolean | null;
  duplicate?: boolean | null;
  booking?: Record<string, unknown> | null;
  capacity?: CapacityInfo | null;
  error?: string | null;
  message?: string | null;
  details?: BookingErrorDetails | null;
  retryable?: boolean | null;
};

function normalizeRpcResult(payload: CapacityRpcPayload | null | undefined): BookingResult {
  if (!payload) {
    return {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Capacity RPC returned no payload",
    };
  }

  const success = payload.success === true;
  const booking = payload.booking ? (payload.booking as any) : undefined;
  const capacity = payload.capacity ?? undefined;

  if (success) {
    return {
      success: true,
      duplicate: payload.duplicate ?? false,
      booking,
      capacity,
      message: payload.message ?? undefined,
    };
  }

  return {
    success: false,
    duplicate: payload.duplicate ?? false,
    booking,
    capacity,
    error: (payload.error ?? "INTERNAL_ERROR") as BookingResult["error"],
    message: payload.message ?? undefined,
    details: payload.details ?? undefined,
    retryable: payload.retryable ?? undefined,
  };
}

type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

const MISSING_RPC_ERROR_CODES = new Set(["PGRST202", "PGRST201", "42883", "42P01"]);

function isMissingCapacityRpcError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const code = (error.code ?? "").toUpperCase();
  if (code && MISSING_RPC_ERROR_CODES.has(code)) {
    return true;
  }

  const message = (error.message ?? "").toLowerCase();
  const details = (error.details ?? "").toLowerCase();
  const indicators = [
    "no matches were found in the schema cache",
    "function",
    "does not exist",
  ];

  const hasMissingPattern = (text: string) =>
    indicators.every((indicator) => text.includes(indicator)) ||
    text.includes("missing sql function") ||
    text.includes("function create_booking_with_capacity_check");

  return hasMissingPattern(message) || hasMissingPattern(details);
}

function mergeFallbackDetails(details: CreateBookingParams["details"]): Json {
  const base: Record<string, Json> =
    details && typeof details === "object" && !Array.isArray(details)
      ? { ...(details as Record<string, Json>) }
      : {};

  if (details && (typeof details !== "object" || Array.isArray(details))) {
    base.originalDetails = details;
  }

  if (!("channel" in base)) {
    base.channel = "api.capacity_removed";
  }

  base.fallback = "missing_capacity_rpc";

  return base;
}

async function createBookingWithoutCapacity(
  params: CreateBookingParams,
  supabase: DbClient,
): Promise<BookingResult> {
  if (params.idempotencyKey) {
    const { data: existing, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("restaurant_id", params.restaurantId)
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();

    if (fetchError) {
      throw new CapacityError(
        fetchError.message ?? "Failed to check existing booking for idempotency",
        "INTERNAL_ERROR",
        {
          sqlstate: fetchError.code ?? undefined,
          sqlerrm: fetchError.details ?? undefined,
        },
      );
    }

    if (existing) {
      const booking = existing as BookingRecord;

      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.creation.fallback_duplicate",
        severity: "info",
        context: {
          restaurantId: params.restaurantId,
          bookingId: booking.id,
          idempotencyKey: params.idempotencyKey,
        },
      });

      return {
        success: true,
        duplicate: true,
        booking,
        message: "Booking already exists (idempotency)",
      };
    }
  }

  try {
    const reference = await generateUniqueBookingReference(supabase);
    const clientRequestId = params.clientRequestId ?? randomUUID();
    const booking = await insertBookingRecord(supabase, {
      restaurant_id: params.restaurantId,
      customer_id: params.customerId,
      booking_date: params.bookingDate,
      start_time: params.startTime,
      end_time: params.endTime,
      party_size: params.partySize,
      booking_type: params.bookingType,
      seating_preference: params.seatingPreference,
      status: "confirmed",
      reference,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      notes: params.notes ?? null,
      marketing_opt_in: params.marketingOptIn ?? false,
      loyalty_points_awarded: params.loyaltyPointsAwarded ?? 0,
      source: params.source ?? "api",
      auth_user_id: params.authUserId ?? null,
      client_request_id: clientRequestId,
      idempotency_key: params.idempotencyKey ?? null,
      details: mergeFallbackDetails(params.details),
    });

    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.fallback_success",
      severity: "info",
      context: {
        restaurantId: params.restaurantId,
        bookingId: booking.id,
        idempotencyKey: params.idempotencyKey ?? undefined,
      },
    });

    return {
      success: true,
      duplicate: false,
      booking,
      message: "Booking created without capacity enforcement",
    };
  } catch (error) {
    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.fallback_failure",
      severity: "error",
      context: {
        restaurantId: params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    if (error instanceof CapacityError) {
      throw error;
    }

    throw new CapacityError(
      error instanceof Error ? error.message : "Failed to create booking (fallback)",
      "INTERNAL_ERROR",
    );
  }
}

export async function createBookingWithCapacityCheck(
  params: CreateBookingParams,
  client?: DbClient,
): Promise<BookingResult> {
  const supabase = client ?? getServiceSupabaseClient();

  try {
    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.attempt",
      severity: "info",
      context: {
        restaurantId: params.restaurantId,
        bookingDate: params.bookingDate,
        startTime: params.startTime,
        partySize: params.partySize,
        idempotencyKey: params.idempotencyKey ?? undefined,
      },
    });

    const { data, error } = await supabase.rpc("create_booking_with_capacity_check", {
      p_restaurant_id: params.restaurantId,
      p_customer_id: params.customerId,
      p_booking_date: params.bookingDate,
      p_start_time: params.startTime,
      p_end_time: params.endTime,
      p_party_size: params.partySize,
      p_booking_type: params.bookingType,
      p_customer_name: params.customerName,
      p_customer_email: params.customerEmail,
      p_customer_phone: params.customerPhone,
      p_seating_preference: params.seatingPreference,
      p_notes: params.notes ?? null,
      p_marketing_opt_in: params.marketingOptIn ?? false,
      p_idempotency_key: params.idempotencyKey ?? null,
      p_source: params.source ?? "api",
      p_auth_user_id: params.authUserId ?? null,
      p_client_request_id: params.clientRequestId ?? null,
      p_details: params.details ?? {},
      p_loyalty_points_awarded: params.loyaltyPointsAwarded ?? 0,
    });

    if (error) {
      if (isMissingCapacityRpcError(error)) {
        recordObservabilityEvent({
          source: "capacity.transaction",
          eventType: "booking.creation.rpc_missing",
          severity: "warning",
          context: {
            restaurantId: params.restaurantId,
            bookingDate: params.bookingDate,
            startTime: params.startTime,
            partySize: params.partySize,
            code: error.code ?? undefined,
          },
        });

        return createBookingWithoutCapacity(params, supabase);
      }

      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.creation.rpc_error",
        severity: "error",
        context: {
          restaurantId: params.restaurantId,
          bookingDate: params.bookingDate,
          startTime: params.startTime,
          partySize: params.partySize,
          error: error.message,
          details: error.details ?? undefined,
        },
      });

      throw new CapacityError(
        error.message ?? "Failed to execute capacity RPC",
        "INTERNAL_ERROR",
        {
          sqlstate: error.code ?? undefined,
          sqlerrm: error.details ?? undefined,
        },
      );
    }

    const result = normalizeRpcResult(data as CapacityRpcPayload);

    if (result.success) {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.creation.success",
        severity: "info",
        context: {
          restaurantId: params.restaurantId,
          bookingId: result.booking ? (result.booking as any).id : undefined,
          duplicate: result.duplicate ?? false,
          capacity: result.capacity ?? undefined,
        },
      });
    } else {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.creation.failure",
        severity: result.error === "CAPACITY_EXCEEDED" ? "warning" : "error",
        context: {
          restaurantId: params.restaurantId,
          bookingDate: params.bookingDate,
          startTime: params.startTime,
          partySize: params.partySize,
          error: result.error ?? "UNKNOWN",
          message: result.message ?? undefined,
          details: result.details ?? undefined,
        },
      });
    }

    return result;
  } catch (error) {
    if (error instanceof CapacityError) {
      throw error;
    }

    const details: BookingErrorDetails | undefined =
      error && typeof error === "object" && "details" in (error as Record<string, unknown>)
        ? ((error as Record<string, unknown>).details as BookingErrorDetails | undefined)
        : undefined;

    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.failure",
      severity: "error",
      context: {
        restaurantId: params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw new CapacityError(
      error instanceof Error ? error.message : "Failed to create booking",
      "INTERNAL_ERROR",
      details,
    );
  }
}

export async function updateBookingWithCapacityCheck(
  params: UpdateBookingParams,
  client?: DbClient,
): Promise<BookingResult> {
  const supabase = client ?? getServiceSupabaseClient();

  try {
    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.update.attempt",
      severity: "info",
      context: {
        restaurantId: params.restaurantId,
        bookingId: params.bookingId,
        bookingDate: params.bookingDate,
        startTime: params.startTime,
        partySize: params.partySize,
      },
    });

    const { data, error } = await supabase.rpc("update_booking_with_capacity_check", {
      p_booking_id: params.bookingId,
      p_restaurant_id: params.restaurantId,
      p_customer_id: params.customerId,
      p_booking_date: params.bookingDate,
      p_start_time: params.startTime,
      p_end_time: params.endTime,
      p_party_size: params.partySize,
      p_booking_type: params.bookingType,
      p_customer_name: params.customerName,
      p_customer_email: params.customerEmail,
      p_customer_phone: params.customerPhone,
      p_seating_preference: params.seatingPreference,
      p_notes: params.notes ?? null,
      p_marketing_opt_in: params.marketingOptIn ?? false,
      p_auth_user_id: params.authUserId ?? null,
      p_client_request_id: params.clientRequestId ?? null,
      p_details: params.details ?? {},
      p_loyalty_points_awarded: params.loyaltyPointsAwarded ?? 0,
      p_source: params.source ?? "api",
    });

    if (error) {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.update.rpc_error",
        severity: "error",
        context: {
          restaurantId: params.restaurantId,
          bookingId: params.bookingId,
          error: error.message,
          details: error.details ?? undefined,
        },
      });

      throw new CapacityError(
        error.message ?? "Failed to execute capacity update RPC",
        "INTERNAL_ERROR",
        {
          sqlstate: error.code ?? undefined,
          sqlerrm: error.details ?? undefined,
        },
      );
    }

    const result = normalizeRpcResult(data as CapacityRpcPayload);

    if (result.success) {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.update.success",
        severity: "info",
        context: {
          restaurantId: params.restaurantId,
          bookingId: params.bookingId,
          capacity: result.capacity ?? undefined,
        },
      });
    } else {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.update.failure",
        severity: result.error === "CAPACITY_EXCEEDED" ? "warning" : "error",
        context: {
          restaurantId: params.restaurantId,
          bookingId: params.bookingId,
          bookingDate: params.bookingDate,
          startTime: params.startTime,
          partySize: params.partySize,
          error: result.error ?? "UNKNOWN",
          message: result.message ?? undefined,
          details: result.details ?? undefined,
        },
      });
    }

    return result;
  } catch (error) {
    if (error instanceof CapacityError) {
      throw error;
    }

    const details: BookingErrorDetails | undefined =
      error && typeof error === "object" && "details" in (error as Record<string, unknown>)
        ? ((error as Record<string, unknown>).details as BookingErrorDetails | undefined)
        : undefined;

    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.update.failure",
      severity: "error",
      context: {
        restaurantId: params.restaurantId,
        bookingId: params.bookingId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw new CapacityError(
      error instanceof Error ? error.message : "Failed to update booking",
      "INTERNAL_ERROR",
      details,
    );
  }
}

export async function createBookingOrThrow(
  params: CreateBookingParams,
  client?: DbClient,
): Promise<BookingResult> {
  const result = await createBookingWithCapacityCheck(params, client);

  if (result.success) {
    return result;
  }

  const message = result.message ?? "Booking creation failed";
  throw new CapacityError(message, result.error ?? "INTERNAL_ERROR", result.details);
}

export function isRetryableBookingError(result: BookingResult): boolean {
  return result.retryable === true;
}

export function getBookingErrorMessage(result: BookingResult): string {
  if (result.success) {
    return result.message ?? "Booking created successfully";
  }

  if (result.message) {
    return result.message;
  }

  const details = result.details ? JSON.stringify(result.details) : "";
  return details.length > 0 ? `Booking failed: ${details}` : "Booking failed";
}
