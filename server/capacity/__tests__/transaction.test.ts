/**
 * Unit Tests: BookingTransactionService
 * Story 2: RPC Wrapper and Retry Logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBookingWithCapacityCheck,
  retryWithBackoff,
  isRetryableBookingError,
  getBookingErrorMessage,
} from "../transaction";
import type { CreateBookingParams, BookingResult } from "../types";

// =====================================================
// Mock Dependencies
// =====================================================

const mockSupabase = {
  rpc: vi.fn(),
};

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => mockSupabase,
}));

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock("../metrics", () => ({
  recordCapacityMetric: vi.fn(),
}));

import { recordCapacityMetric } from "../metrics";
import { recordObservabilityEvent } from "@/server/observability";

// =====================================================
// Test Data
// =====================================================

const mockBookingParams: CreateBookingParams = {
  restaurantId: "restaurant-1",
  customerId: "customer-1",
  bookingDate: "2025-10-20",
  startTime: "19:00",
  endTime: "21:00",
  partySize: 4,
  bookingType: "dinner",
  customerName: "Test Customer",
  customerEmail: "test@example.com",
  customerPhone: "+1234567890",
  seatingPreference: "any",
  idempotencyKey: "test-key-123",
};

const mockSuccessResponse = {
  success: true,
  duplicate: false,
  booking: {
    id: "booking-1",
    reference: "ABC123XYZ9",
    restaurant_id: "restaurant-1",
    customer_id: "customer-1",
    booking_date: "2025-10-20",
    start_time: "19:00",
    party_size: 4,
    status: "confirmed",
  },
  capacity: {
    servicePeriod: "Dinner Service",
    maxCovers: 40,
    bookedCovers: 24,
    availableCovers: 16,
    utilizationPercent: 60,
  },
  message: "Booking created successfully",
};

const mockCapacityExceededResponse = {
  success: false,
  error: "CAPACITY_EXCEEDED",
  message: "Maximum capacity of 40 covers exceeded",
  details: {
    maxCovers: 40,
    bookedCovers: 38,
    requestedCovers: 4,
    availableCovers: 2,
  },
};

const mockConflictResponse = {
  success: false,
  error: "BOOKING_CONFLICT",
  message: "Concurrent booking conflict detected. Please retry.",
  retryable: true,
};

// =====================================================
// Tests: createBookingWithCapacityCheck
// =====================================================

describe("createBookingWithCapacityCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create booking successfully", async () => {
    // Setup
    mockSupabase.rpc.mockResolvedValue({
      data: mockSuccessResponse,
      error: null,
    });

    // Execute
    const result = await createBookingWithCapacityCheck(mockBookingParams);

    // Assert
    expect(result.success).toBe(true);
    expect(result.booking?.id).toBe("booking-1");
    expect(result.booking?.reference).toBe("ABC123XYZ9");
    expect(result.capacity?.utilizationPercent).toBe(60);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "create_booking_with_capacity_check",
      expect.objectContaining({
        p_restaurant_id: "restaurant-1",
        p_party_size: 4,
      })
    );
    expect(recordCapacityMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        bookingDate: "2025-10-20",
        startTime: "19:00",
        metric: "success",
      })
    );
  });

  it("should handle capacity exceeded error", async () => {
    // Setup
    mockSupabase.rpc.mockResolvedValue({
      data: mockCapacityExceededResponse,
      error: null,
    });

    // Execute
    const result = await createBookingWithCapacityCheck(mockBookingParams);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("CAPACITY_EXCEEDED");
    expect(result.message).toContain("Maximum capacity");
    expect(result.details?.availableCovers).toBe(2);
    expect(recordCapacityMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        metric: "capacity_exceeded",
      })
    );
  });

  it("should handle booking conflict error", async () => {
    // Setup
    mockSupabase.rpc.mockResolvedValue({
      data: mockConflictResponse,
      error: null,
    });

    // Execute
    const result = await createBookingWithCapacityCheck(mockBookingParams);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBe("BOOKING_CONFLICT");
    expect(result.retryable).toBe(true);
    expect(recordCapacityMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        metric: "conflict",
      })
    );
    expect(recordObservabilityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "booking.booking_conflict",
      })
    );
  });

  it("should throw CapacityError after retry exhaustion", async () => {
    mockSupabase.rpc.mockRejectedValue(new Error("serialization failure"));

    await expect(
      createBookingWithCapacityCheck(
        mockBookingParams,
        undefined,
        { maxRetries: 1, initialDelayMs: 5, backoffMultiplier: 1 }
      )
    ).rejects.toThrowError("Failed to create booking");
  });

  it("should handle duplicate booking (idempotency)", async () => {
    // Setup
    const duplicateResponse = {
      ...mockSuccessResponse,
      duplicate: true,
      message: "Booking already exists (idempotency)",
    };
    
    mockSupabase.rpc.mockResolvedValue({
      data: duplicateResponse,
      error: null,
    });

    // Execute
    const result = await createBookingWithCapacityCheck(mockBookingParams);

    // Assert
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
  });

  it("should retry on transient errors", async () => {
    // Setup - fail twice, then succeed
    mockSupabase.rpc
      .mockRejectedValueOnce(new Error("serialization failure"))
      .mockRejectedValueOnce(new Error("deadlock detected"))
      .mockResolvedValueOnce({
        data: mockSuccessResponse,
        error: null,
      });

    // Execute
    const result = await createBookingWithCapacityCheck(
      mockBookingParams,
      undefined,
      { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1 }
    );

    // Assert
    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries exhausted", async () => {
    // Setup - always fail
    mockSupabase.rpc.mockRejectedValue(new Error("serialization failure"));

    // Execute & Assert
    await expect(
      createBookingWithCapacityCheck(
        mockBookingParams,
        undefined,
        { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1 }
      )
    ).rejects.toThrow("Failed to create booking");

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should not retry on non-retryable errors", async () => {
    // Setup - non-retryable error
    mockSupabase.rpc.mockRejectedValue(new Error("Invalid input"));

    // Execute & Assert
    await expect(
      createBookingWithCapacityCheck(mockBookingParams)
    ).rejects.toThrow();

    // Should only be called once (no retries)
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });
});

// =====================================================
// Tests: retryWithBackoff
// =====================================================

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      backoffMultiplier: 2,
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry with exponential backoff", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("serialization failure"))
      .mockRejectedValueOnce(new Error("serialization failure"))
      .mockResolvedValueOnce("success");

    const startTime = Date.now();
    
    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      initialDelayMs: 50,
      backoffMultiplier: 2,
    });

    const elapsed = Date.now() - startTime;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
    
    // Should have delays: 50ms (1st retry) + 100ms (2nd retry) ≈ 150ms
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("serialization failure"));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelayMs: 10,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow("serialization failure");

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid input"));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow("Invalid input");

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it("should identify retryable PostgreSQL errors", async () => {
    const errors = [
      { code: "40001", message: "serialization failure" },
      { code: "40P01", message: "deadlock detected" },
      { code: "55P03", message: "lock not available" },
      { message: "could not serialize access" },
    ];

    for (const error of errors) {
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("success");

      await retryWithBackoff(fn, {
        maxRetries: 1,
        initialDelayMs: 1,
        backoffMultiplier: 1,
      });

      expect(fn).toHaveBeenCalledTimes(2); // Retried once
      vi.clearAllMocks();
    }
  });
});

// =====================================================
// Tests: Helper Functions
// =====================================================

describe("isRetryableBookingError", () => {
  it("should identify retryable errors", () => {
    const retryableResult: BookingResult = {
      success: false,
      error: "BOOKING_CONFLICT",
      retryable: true,
    };

    expect(isRetryableBookingError(retryableResult)).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const nonRetryableResult: BookingResult = {
      success: false,
      error: "CAPACITY_EXCEEDED",
      retryable: false,
    };

    expect(isRetryableBookingError(nonRetryableResult)).toBe(false);
  });

  it("should handle BOOKING_CONFLICT as retryable", () => {
    const conflictResult: BookingResult = {
      success: false,
      error: "BOOKING_CONFLICT",
      // retryable not explicitly set
    };

    expect(isRetryableBookingError(conflictResult)).toBe(true);
  });
});

describe("getBookingErrorMessage", () => {
  it("should return success message for successful booking", () => {
    const result: BookingResult = {
      success: true,
      booking: {} as any,
    };

    expect(getBookingErrorMessage(result)).toBe("Booking created successfully");
  });

  it("should format capacity exceeded message with details", () => {
    const result: BookingResult = {
      success: false,
      error: "CAPACITY_EXCEEDED",
      details: {
        availableCovers: 2,
        requestedCovers: 4,
      },
    };

    const message = getBookingErrorMessage(result);
    expect(message).toContain("Only 2 seats available");
    expect(message).toContain("You requested 4");
  });

  it("should return generic message for capacity exceeded without details", () => {
    const result: BookingResult = {
      success: false,
      error: "CAPACITY_EXCEEDED",
      message: "Custom error message",
    };

    expect(getBookingErrorMessage(result)).toBe("Custom error message");
  });

  it("should return conflict message", () => {
    const result: BookingResult = {
      success: false,
      error: "BOOKING_CONFLICT",
    };

    expect(getBookingErrorMessage(result)).toBe(
      "This time slot was just booked. Please try again."
    );
  });

  it("should use result message as fallback", () => {
    const result: BookingResult = {
      success: false,
      error: "INTERNAL_ERROR",
      message: "Something went wrong",
    };

    expect(getBookingErrorMessage(result)).toBe("Something went wrong");
  });
});
