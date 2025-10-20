/**
 * Capacity & Availability Engine - Transaction Service
 * Story 2: Race-Safe Booking Creation with Retry Logic
 * 
 * This service wraps the database RPC function for booking creation
 * and provides:
 * 1. Type-safe interface for booking creation
 * 2. Automatic retry on transient failures (serialization, deadlock)
 * 3. Error classification and handling
 * 4. Observability logging
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";
import { recordObservabilityEvent } from "@/server/observability";
import type { CreateBookingParams, BookingResult, BookingErrorDetails, RpcBookingResponse, RetryConfig } from "./types";
import { CapacityError, CapacityExceededError, BookingConflictError, DEFAULT_RETRY_CONFIG } from "./types";
import { recordCapacityMetric } from "./metrics";

type DbClient = SupabaseClient<Database, "public", any>;

// =====================================================
// Retry Helper
// =====================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @param context - Context for logging
 * @returns Result of the function
 * 
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => supabase.rpc('some_function'),
 *   { maxRetries: 3, initialDelayMs: 100, backoffMultiplier: 2 },
 *   { operation: 'create_booking', restaurantId: 'uuid' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: Record<string, any>
): Promise<T> {
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Don't retry if we've exhausted attempts
      if (attempt > config.maxRetries) {
        break;
      }

      // Check if error is retryable
      const isRetryable = isRetryableError(error);
      if (!isRetryable) {
        // Non-retryable error, throw immediately
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

      // Log retry attempt
      recordObservabilityEvent({
        source: "capacity.transaction",
        eventType: "booking.transaction.retry",
        severity: "info",
        context: {
          ...context,
          attempt,
          maxRetries: config.maxRetries,
          delayMs: delay,
          error: (error as Error).message,
        },
      });

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";

  // PostgreSQL error codes for retryable conditions
  const retryableCodes = [
    "40001", // serialization_failure
    "40P01", // deadlock_detected
    "55P03", // lock_not_available
  ];

  // Check SQLSTATE code
  if (retryableCodes.includes(code)) {
    return true;
  }

  // Check error message patterns
  const retryablePatterns = [
    "serialization failure",
    "deadlock detected",
    "could not serialize access",
    "lock not available",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

function normalizeRpcDetails(response: RpcBookingResponse): BookingErrorDetails | undefined {
  const existing = response.details as BookingErrorDetails | undefined;
  if (existing && Object.keys(existing).length > 0) {
    return existing;
  }

  const legacySource = response as Record<string, unknown>;
  const legacy: BookingErrorDetails = {};

  if (typeof legacySource["sqlstate"] === "string" && legacySource["sqlstate"]) {
    legacy.sqlstate = legacySource["sqlstate"] as string;
  }

  if (typeof legacySource["sqlerrm"] === "string" && legacySource["sqlerrm"]) {
    legacy.sqlerrm = legacySource["sqlerrm"] as string;
  }

  if (typeof legacySource["timezone"] === "string" && legacySource["timezone"]) {
    legacy.timezone = legacySource["timezone"] as string;
  }

  if (typeof legacySource["original_timezone"] === "string" && legacySource["original_timezone"]) {
    legacy.originalTimezone = legacySource["original_timezone"] as string;
  }

  return Object.keys(legacy).length > 0 ? legacy : undefined;
}

// =====================================================
// Main Transaction Functions
// =====================================================

/**
 * Create a booking with capacity enforcement
 * 
 * This function:
 * 1. Calls the database RPC function
 * 2. Automatically retries on transient failures
 * 3. Returns a type-safe result
 * 4. Logs observability events
 * 
 * @param params - Booking creation parameters
 * @param client - Optional Supabase client
 * @param retryConfig - Optional retry configuration
 * @returns BookingResult with success/error details
 * 
 * @throws {CapacityExceededError} When capacity is exceeded (non-retryable)
 * @throws {BookingConflictError} When race condition detected (retryable)
 * @throws {CapacityError} For other booking errors
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await createBookingWithCapacityCheck({
 *     restaurantId: 'uuid',
 *     customerId: 'uuid',
 *     bookingDate: '2025-10-20',
 *     startTime: '19:00',
 *     endTime: '21:00',
 *     partySize: 4,
 *     bookingType: 'dinner',
 *     customerName: 'John Doe',
 *     customerEmail: 'john@example.com',
 *     customerPhone: '+1234567890',
 *     seatingPreference: 'any',
 *   });
 * 
 *   if (result.success) {
 *     console.log('Booking created:', result.booking?.reference);
 *     console.log('Capacity:', result.capacity?.utilizationPercent + '%');
 *   } else {
 *     console.error('Booking failed:', result.message);
 *     console.log('Alternatives:', result.details?.alternatives);
 *   }
 * } catch (error) {
 *   if (error instanceof CapacityExceededError) {
 *     console.error('Capacity full:', error.details);
 *   }
 * }
 * ```
 */
export async function createBookingWithCapacityCheck(
  params: CreateBookingParams,
  client?: DbClient,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<BookingResult> {
  const supabase = client ?? getServiceSupabaseClient();

  // Log attempt
  recordObservabilityEvent({
    source: "capacity.transaction",
    eventType: "booking.creation.attempt",
    severity: "info",
    context: {
      restaurantId: params.restaurantId,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      partySize: params.partySize,
      idempotencyKey: params.idempotencyKey,
    },
  });

  // Call RPC with retry logic
  const rpcCall = async () => {
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
      p_details: {},
      p_loyalty_points_awarded: params.loyaltyPointsAwarded ?? 0,
    });

    if (error) {
      throw error;
    }

    return data as RpcBookingResponse;
  };

  let response: RpcBookingResponse;

  try {
    response = await retryWithBackoff(
      rpcCall,
      retryConfig,
      {
        operation: "create_booking_with_capacity_check",
        restaurantId: params.restaurantId,
      }
    );
  } catch (error) {
    // Log failure
    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.failure",
      severity: "error",
      context: {
        restaurantId: params.restaurantId,
        error: (error as Error).message,
      },
    });

    // Re-throw as generic error
    throw new CapacityError(
      `Failed to create booking: ${(error as Error).message}`,
      "INTERNAL_ERROR"
    );
  }

  // =====================================================
  // Process Response
  // =====================================================

  // Handle success
  if (response.success) {
    recordObservabilityEvent({
      source: "capacity.transaction",
      eventType: "booking.creation.success",
      severity: "info",
      context: {
        restaurantId: params.restaurantId,
        bookingId: response.booking?.id,
        duplicate: response.duplicate,
        utilizationPercent: response.capacity?.utilizationPercent,
      },
    });

    void recordCapacityMetric({
      restaurantId: params.restaurantId,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      metric: "success",
    });

    return {
      success: true,
      duplicate: response.duplicate,
      booking: response.booking as any,
      capacity: response.capacity,
      message: response.message,
    };
  }

  // Handle errors
  const errorCode = response.error ?? "INTERNAL_ERROR";
  const errorMessage = response.message ?? "Unknown error";
  const errorDetails = normalizeRpcDetails(response);

  // Log specific error type
  recordObservabilityEvent({
    source: "capacity.transaction",
    eventType: `booking.${errorCode.toLowerCase()}`,
    severity: errorCode === "CAPACITY_EXCEEDED" ? "warning" : "error",
    context: {
      restaurantId: params.restaurantId,
      errorCode,
      details: errorDetails,
    },
  });

  if (errorCode === "CAPACITY_EXCEEDED") {
    void recordCapacityMetric({
      restaurantId: params.restaurantId,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      metric: "capacity_exceeded",
    });
  } else if (errorCode === "BOOKING_CONFLICT") {
    void recordCapacityMetric({
      restaurantId: params.restaurantId,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
      metric: "conflict",
    });
  }

  // Return error result (don't throw, let caller handle)
  return {
    success: false,
    error: errorCode,
    message: errorMessage,
    details: errorDetails,
    retryable: response.retryable ?? false,
  };
}

/**
 * Create a booking and throw on error (alternative API)
 * 
 * Same as createBookingWithCapacityCheck but throws typed errors
 * instead of returning error results.
 * 
 * @param params - Booking creation parameters
 * @param client - Optional Supabase client
 * @param retryConfig - Optional retry configuration
 * @returns BookingResult (only success cases)
 * @throws {CapacityExceededError} When capacity exceeded
 * @throws {BookingConflictError} When race condition
 * @throws {CapacityError} For other errors
 */
export async function createBookingOrThrow(
  params: CreateBookingParams,
  client?: DbClient,
  retryConfig?: RetryConfig
): Promise<BookingResult> {
  const result = await createBookingWithCapacityCheck(params, client, retryConfig);

  if (!result.success) {
    if (result.error === "CAPACITY_EXCEEDED") {
      throw new CapacityExceededError(result.message ?? "Capacity exceeded", result.details);
    }

    if (result.error === "BOOKING_CONFLICT") {
      throw new BookingConflictError(result.message ?? "Booking conflict", result.details);
    }

    throw new CapacityError(
      result.message ?? "Booking failed",
      result.error ?? "INTERNAL_ERROR",
      result.details
    );
  }

  return result;
}

/**
 * Check if a booking result indicates a retryable error
 */
export function isRetryableBookingError(result: BookingResult): boolean {
  return result.retryable === true || result.error === "BOOKING_CONFLICT";
}

/**
 * Extract error details for display to user
 */
export function getBookingErrorMessage(result: BookingResult): string {
  if (result.success) {
    return "Booking created successfully";
  }

  if (result.error === "CAPACITY_EXCEEDED") {
    const details = result.details;
    if (details?.availableCovers !== undefined) {
      return `Only ${details.availableCovers} seats available. You requested ${details.requestedCovers}.`;
    }
    return result.message ?? "No capacity available";
  }

  if (result.error === "BOOKING_CONFLICT") {
    return "This time slot was just booked. Please try again.";
  }

  return result.message ?? "Failed to create booking";
}
