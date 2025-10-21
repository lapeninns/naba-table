import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";
import { generateUniqueBookingReference, insertBookingRecord } from "@/server/bookings";
import type { Database } from "@/types/supabase";
import {
  CapacityError,
  type BookingResult,
  type CreateBookingParams,
  type BookingErrorDetails,
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

async function findBookingByIdempotency(
  supabase: DbClient,
  restaurantId: string,
  idempotencyKey: string,
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new CapacityError(`Failed to lookup existing booking: ${error.message}`, "INTERNAL_ERROR");
  }

  return data;
}

export async function createBookingWithCapacityCheck(
  params: CreateBookingParams,
  client?: DbClient,
): Promise<BookingResult> {
  const supabase = client ?? getServiceSupabaseClient();

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

  if (params.idempotencyKey) {
    const existing = await findBookingByIdempotency(supabase, params.restaurantId, params.idempotencyKey);
    if (existing) {
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.creation.idempotent",
        severity: "info",
        context: {
          restaurantId: params.restaurantId,
          bookingId: existing.id,
        },
      });

      return {
        success: true,
        duplicate: true,
        booking: existing as any,
        message: "Booking already exists (idempotency)",
      };
    }
  }

  try {
    const reference = await generateUniqueBookingReference(supabase);
    const clientRequestId = params.clientRequestId ?? randomUUID();

    const booking = await insertBookingRecord(supabase, {
      restaurant_id: params.restaurantId,
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
      customer_id: params.customerId,
      auth_user_id: params.authUserId ?? null,
      client_request_id: clientRequestId,
      idempotency_key: params.idempotencyKey ?? null,
      details: null,
    });

    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.success",
      severity: "info",
      context: {
        restaurantId: params.restaurantId,
        bookingId: booking.id,
      },
    });

    return {
      success: true,
      duplicate: false,
      booking,
      message: "Booking created successfully",
    };
  } catch (error) {
    const details: BookingErrorDetails | undefined = error instanceof CapacityError ? error.details : undefined;

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

export function isRetryableBookingError(_result: BookingResult): boolean {
  return false;
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
