/**
 * Capacity & Availability Engine - Public API
 * Story 2: Service Layer Exports
 * 
 * Import from this file to use the capacity engine:
 * 
 * @example
 * ```typescript
 * import {
 *   checkSlotAvailability,
 *   createBookingWithCapacityCheck,
 *   findAlternativeSlots,
 * } from '@/server/capacity';
 * 
 * const result = await checkSlotAvailability({
 *   restaurantId: 'uuid',
 *   date: '2025-10-20',
 *   time: '19:00',
 *   partySize: 4
 * });
 * ```
 */

// =====================================================
// Main Services
// =====================================================

export {
  checkSlotAvailability,
  findAlternativeSlots,
  calculateCapacityUtilization,
  getServicePeriodsWithCapacity,
} from "./service";

export {
  createBookingWithCapacityCheck,
  createBookingOrThrow,
  retryWithBackoff,
  isRetryableBookingError,
  getBookingErrorMessage,
} from "./transaction";

export {
  findSuitableTables,
  assignTableToBooking,
  unassignTableFromBooking,
  getBookingTableAssignments,
  autoAssignTables,
  autoAssignTablesForDate,
  isTableAvailable,
} from "./tables";

export {
  defaultVenuePolicy,
  getVenuePolicy,
  whichService,
  bandDuration,
  serviceEnd,
  ServiceNotFoundError,
  ServiceOverrunError,
  PolicyError,
} from "./policy";

export {
  calculateRestaurantCapacityByService,
  calculateCapacityForTables,
  type ServiceCapacitySummary,
  type TableRotationDetail,
} from "./rotations";

export {
  validateBookingWindow,
  type BookingValidationInput,
  type BookingValidationResult,
} from "./validation";

// =====================================================
// Types
// =====================================================

export type {
  // Availability
  AvailabilityCheckParams,
  AvailabilityResult,
  AlternativeSlotParams,
  TimeSlot,
  CapacityMetadata,
  
  // Booking Transaction
  CreateBookingParams,
  BookingResult,
  BookingRecord,
  BookingErrorCode,
  BookingErrorDetails,
  CapacityInfo,
  
  // Service Periods
  ServicePeriodWithCapacity,
  PeriodUtilization,
  
  // Retry
  RetryConfig,
} from "./types";

export type {
  // Tables (v2)
  Table,
  TableMatchParams,
  TableAssignmentMember,
  TableAssignmentGroup,
  AutoAssignResult,
} from "./tables";

export {
  // Error Classes
  CapacityError,
  CapacityExceededError,
  BookingConflictError,
  
  // Constants
  DEFAULT_RETRY_CONFIG,
} from "./types";
