/**
 * Capacity & Availability Engine - Type Definitions
 * Story 2: Service Layer Types
 */

import type { Database } from "@/types/supabase";

// =====================================================
// Availability Check Types
// =====================================================

export type AvailabilityCheckParams = {
  restaurantId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  partySize: number;
  seatingPreference?: string;
};

export type AvailabilityResult = {
  available: boolean;
  reason?: string;
  alternatives?: TimeSlot[];
  metadata: CapacityMetadata;
};

export type TimeSlot = {
  time: string; // HH:MM
  available: boolean;
  utilizationPercent: number;
  bookedCovers?: number;
  maxCovers?: number;
};

export type CapacityMetadata = {
  servicePeriod?: string;
  maxCovers: number | null;
  bookedCovers: number;
  availableCovers: number;
  utilizationPercent: number;
  maxParties?: number | null;
  bookedParties?: number;
};

// =====================================================
// Alternative Slot Search Types
// =====================================================

export type AlternativeSlotParams = {
  restaurantId: string;
  date: string;
  partySize: number;
  preferredTime: string;
  maxAlternatives?: number; // Default: 5
  searchWindowMinutes?: number; // Default: 120 (±2 hours)
};

// =====================================================
// Booking Transaction Types
// =====================================================

export type CreateBookingParams = {
  restaurantId: string;
  customerId: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  partySize: number;
  bookingType: Database["public"]["Enums"]["booking_type"];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  seatingPreference: Database["public"]["Enums"]["seating_preference_type"];
  notes?: string | null;
  marketingOptIn?: boolean;
  idempotencyKey?: string | null;
  source?: string;
  authUserId?: string | null;
  clientRequestId?: string | null;
  loyaltyPointsAwarded?: number;
};

export type BookingResult = {
  success: boolean;
  duplicate?: boolean;
  booking?: BookingRecord;
  capacity?: CapacityInfo;
  error?: BookingErrorCode;
  message?: string;
  details?: BookingErrorDetails;
  retryable?: boolean;
};

export type BookingErrorCode =
  | "CAPACITY_EXCEEDED"
  | "BOOKING_CONFLICT"
  | "INTERNAL_ERROR"
  | "OPERATING_HOURS_CLOSED"
  | "PAST_TIME_BLOCKED"
  | "INVALID_PARAMS";

export type BookingErrorDetails = {
  maxCovers?: number;
  bookedCovers?: number;
  requestedCovers?: number;
  availableCovers?: number;
  servicePeriod?: string;
  maxParties?: number;
  bookedParties?: number;
  availableParties?: number;
  sqlstate?: string;
  sqlerrm?: string;
};

export type CapacityInfo = {
  servicePeriod?: string;
  maxCovers: number;
  bookedCovers: number;
  availableCovers: number;
  utilizationPercent: number;
};

// =====================================================
// Database RPC Response Types
// =====================================================

export type RpcBookingResponse = {
  success: boolean;
  duplicate?: boolean;
  booking?: Record<string, any>; // Full booking record as JSONB
  capacity?: CapacityInfo;
  error?: BookingErrorCode;
  message?: string;
  details?: BookingErrorDetails;
  retryable?: boolean;
};

// =====================================================
// Booking Record Type (from database)
// =====================================================

export type BookingRecord = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  party_size: number;
  booking_type: string;
  seating_preference: string;
  status: string;
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes?: string | null;
  marketing_opt_in: boolean;
  loyalty_points_awarded?: number;
  source?: string;
  auth_user_id?: string | null;
  idempotency_key?: string | null;
  details?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

// =====================================================
// Service Period Types (reused from ops/capacity.ts)
// =====================================================

export type ServicePeriodWithCapacity = {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  maxCovers: number | null;
  maxParties: number | null;
  dayOfWeek: number | null;
};

export type PeriodUtilization = {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  bookedCovers: number;
  bookedParties: number;
  maxCovers: number | null;
  maxParties: number | null;
  utilizationPercentage: number;
  isOverbooked: boolean;
};

// =====================================================
// Retry Configuration
// =====================================================

export type RetryConfig = {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number; // e.g., 2 for exponential backoff
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2,
};

// =====================================================
// Error Classes
// =====================================================

export class CapacityError extends Error {
  constructor(
    message: string,
    public code: BookingErrorCode,
    public details?: BookingErrorDetails
  ) {
    super(message);
    this.name = "CapacityError";
  }
}

export class BookingConflictError extends CapacityError {
  constructor(message: string, details?: BookingErrorDetails) {
    super(message, "BOOKING_CONFLICT", details);
    this.name = "BookingConflictError";
  }
}

export class CapacityExceededError extends CapacityError {
  constructor(message: string, details?: BookingErrorDetails) {
    super(message, "CAPACITY_EXCEEDED", details);
    this.name = "CapacityExceededError";
  }
}
