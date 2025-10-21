import type { BookingType } from "@/lib/enums";
import type {
  BookingRecord as CapacityBookingRecord,
  BookingResult as CapacityBookingResult,
  BookingErrorCode as CapacityErrorCode,
} from "@/server/capacity";
import type { RestaurantSchedule } from "@/server/restaurants/schedule";

export type BookingErrorCode =
  | "PAST_TIME"
  | "CLOSED_DATE"
  | "OUTSIDE_HOURS"
  | "SERVICE_PERIOD"
  | "CAPACITY_EXCEEDED"
  | "INVALID_DURATION"
  | "LEAD_TIME"
  | "MISSING_OVERRIDE"
  | "UNKNOWN";

export type BookingErrorSeverity = "error" | "warning";

export interface BookingError {
  code: BookingErrorCode;
  message: string;
  detail?: Record<string, unknown>;
  severity?: BookingErrorSeverity;
  overridable?: boolean;
}

export interface BookingValidationResponse {
  ok: boolean;
  issues: BookingError[];
  overridden?: boolean;
  overrideCodes?: BookingErrorCode[];
  normalizedStart?: string;
  normalizedEnd?: string;
  metadata?: Record<string, unknown>;
}

export interface BookingInput {
  restaurantId: string;
  serviceId: string;
  partySize: number;
  start: string; // ISO string, interpreted in restaurant TZ
  durationMinutes: number;
  bookingType?: BookingType;
  seatingPreference?: string | null;
  customerName?: string | null;
  notes?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  marketingOptIn?: boolean;
  source?: string | null;
  idempotencyKey?: string | null;
  loyaltyPointsAwarded?: number | null;
  bookingId?: string;
  override?: OverrideRequest | null;
}

export interface BookingPatchInput extends Omit<BookingInput, "start" | "durationMinutes" | "serviceId" | "restaurantId"> {
  start?: string;
  durationMinutes?: number;
  serviceId?: string;
}

export interface OverrideRequest {
  apply: boolean;
  reason?: string | null;
}

export interface ValidationContext {
  actorId: string;
  actorRoles: string[];
  actorCapabilities?: string[];
  tz: string;
  flags: {
    bookingPastTimeBlocking: boolean;
    bookingPastTimeGraceMinutes?: number;
    unified: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface ValidationSuccessMetadata {
  schedule: RestaurantSchedule;
  normalizedStart: string; // ISO string in restaurant TZ
  normalizedEnd: string; // ISO string in restaurant TZ
  bookingDate: string; // YYYY-MM-DD in restaurant TZ
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  bookingType: BookingType;
  overrideApplied: boolean;
  overrideCodes: BookingErrorCode[];
  evaluatedAt: string;
}

export interface ValidationFailureMetadata {
  overrideAttempted: boolean;
}

export type ValidationMetadata = ValidationSuccessMetadata | ValidationFailureMetadata;

export interface ValidationResult {
  response: BookingValidationResponse;
  metadata: ValidationMetadata;
}

export interface CapacityCheckInput {
  restaurantId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
  bookingId?: string;
}

export interface CapacityCheckResult {
  ok: boolean;
  errorCode?: BookingErrorCode;
  detail?: Record<string, unknown>;
}

export interface CapacityCommitInput extends CapacityCheckInput {
  bookingType: BookingType;
  seatingPreference?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  marketingOptIn?: boolean;
  source?: string | null;
  loyaltyPointsAwarded?: number | null;
  idempotencyKey?: string | null;
  authUserId?: string | null;
  clientRequestId?: string | null;
}

export interface CapacityCommitResult {
  success: boolean;
  booking?: CapacityBookingRecord;
  duplicate?: boolean;
  error?: BookingErrorCode;
  details?: Record<string, unknown>;
  originalResult?: CapacityBookingResult;
}

export interface BookingCommitSuccess {
  booking: CapacityBookingRecord;
  response: BookingValidationResponse & { ok: true };
  duplicate?: boolean;
}

export interface CapacityService {
  checkAvailability(input: CapacityCheckInput): Promise<CapacityCheckResult>;
  createBooking(input: CapacityCommitInput): Promise<CapacityCommitResult>;
  updateBooking(input: CapacityCommitInput & { bookingId: string }): Promise<CapacityCommitResult>;
}

export interface ScheduleRepository {
  getSchedule(params: { restaurantId: string; date: string }): Promise<RestaurantSchedule>;
}

export interface TimeProvider {
  now(tz?: string): Date;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function mapCapacityErrorCode(code: CapacityErrorCode | undefined): BookingErrorCode {
  switch (code) {
    case "CAPACITY_EXCEEDED":
    case "BOOKING_CONFLICT":
      return "CAPACITY_EXCEEDED";
    case "OPERATING_HOURS_CLOSED":
      return "OUTSIDE_HOURS";
    case "PAST_TIME_BLOCKED":
      return "PAST_TIME";
    case "INVALID_PARAMS":
      return "UNKNOWN";
    case "INTERNAL_ERROR":
    default:
      return "UNKNOWN";
  }
}
