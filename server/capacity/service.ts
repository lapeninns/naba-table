/**
 * Capacity & Availability Engine - Core Service
 * Story 2: Availability Checking and Slot Management
 * 
 * This service provides real-time capacity checking by:
 * 1. Querying capacity rules (max covers, max parties)
 * 2. Counting existing bookings in the same period
 * 3. Calculating utilization and availability
 * 4. Suggesting alternative time slots when unavailable
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
  getServicePeriodsWithCapacity,
  type ServicePeriodWithCapacity,
} from "@/server/ops/capacity";
import type {
  AvailabilityCheckParams,
  AvailabilityResult,
  AlternativeSlotParams,
  TimeSlot,
  CapacityMetadata,
} from "./types";

type DbClient = SupabaseClient<Database, "public", any>;

// =====================================================
// Constants
// =====================================================

const CANCELLED_STATUSES = ["cancelled", "no_show"] as const;
const DEFAULT_MAX_ALTERNATIVES = 5;
const DEFAULT_SEARCH_WINDOW_MINUTES = 120; // ±2 hours
const TIME_INTERVALS_MINUTES = [15, 30, 60, 120]; // Check these intervals

// =====================================================
// Helper Functions
// =====================================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to HH:MM
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Match a booking time to a service period
 */
function matchTimeToPeriod(
  timeStr: string,
  periods: ServicePeriodWithCapacity[]
): ServicePeriodWithCapacity | null {
  const timeMinutes = parseTime(timeStr);
  if (timeMinutes === null) return null;

  for (const period of periods) {
    const periodStart = parseTime(period.startTime);
    const periodEnd = parseTime(period.endTime);

    if (periodStart === null || periodEnd === null) continue;

    // Handle periods that cross midnight
    const isInRange =
      periodEnd > periodStart
        ? timeMinutes >= periodStart && timeMinutes < periodEnd
        : timeMinutes >= periodStart || timeMinutes < periodEnd;

    if (isInRange) {
      return period;
    }
  }

  return null;
}

/**
 * Generate time slots around a preferred time
 */
function generateAlternativeTimes(
  preferredTime: string,
  windowMinutes: number
): string[] {
  const preferredMinutes = parseTime(preferredTime);
  if (preferredMinutes === null) return [];

  const alternatives: string[] = [];

  // Generate slots at different intervals
  for (const interval of TIME_INTERVALS_MINUTES) {
    if (interval > windowMinutes) break;

    // Before preferred time
    const beforeMinutes = preferredMinutes - interval;
    if (beforeMinutes >= 0) {
      alternatives.push(formatTime(beforeMinutes));
    }

    // After preferred time
    const afterMinutes = preferredMinutes + interval;
    if (afterMinutes < 24 * 60) {
      alternatives.push(formatTime(afterMinutes));
    }
  }

  // Remove duplicates and sort by proximity to preferred time
  const uniqueTimes = Array.from(new Set(alternatives));
  return uniqueTimes.sort((a, b) => {
    const aDiff = Math.abs(parseTime(a)! - preferredMinutes);
    const bDiff = Math.abs(parseTime(b)! - preferredMinutes);
    return aDiff - bDiff;
  });
}

// =====================================================
// Main Service Functions
// =====================================================

/**
 * Check availability for a specific time slot
 * 
 * @param params - Restaurant, date, time, party size
 * @param client - Optional Supabase client (defaults to service client)
 * @returns Availability result with metadata
 * 
 * @example
 * ```typescript
 * const result = await checkSlotAvailability({
 *   restaurantId: 'uuid',
 *   date: '2025-10-20',
 *   time: '19:00',
 *   partySize: 4
 * });
 * 
 * if (result.available) {
 *   console.log('Available! Utilization:', result.metadata.utilizationPercent);
 * } else {
 *   console.log('Full. Try:', result.alternatives);
 * }
 * ```
 */
export async function checkSlotAvailability(
  params: AvailabilityCheckParams,
  client?: DbClient
): Promise<AvailabilityResult> {
  const supabase = client ?? getServiceSupabaseClient();
  const { restaurantId, date, time, partySize } = params;

  // =====================================================
  // Step 1: Get service periods with capacity rules
  // =====================================================
  const periods = await getServicePeriodsWithCapacity(restaurantId, date, supabase);

  // Find the period that contains this time
  const matchedPeriod = matchTimeToPeriod(time, periods);

  // Default capacity if no period matched or no rules configured
  const maxCovers = matchedPeriod?.maxCovers ?? null;
  const maxParties = matchedPeriod?.maxParties ?? null;

  // If no capacity rules, assume unlimited (backward compatible)
  if (maxCovers === null && maxParties === null) {
    return {
      available: true,
      metadata: {
        servicePeriod: matchedPeriod?.periodName,
        maxCovers: null,
        bookedCovers: 0,
        availableCovers: 999999,
        utilizationPercent: 0,
      },
    };
  }

  // =====================================================
  // Step 2: Count existing bookings in same period
  // =====================================================
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("party_size")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", date)
    .not("status", "in", `(${CANCELLED_STATUSES.join(",")})`)
    .gte("start_time", matchedPeriod?.startTime ?? "00:00")
    .lt("start_time", matchedPeriod?.endTime ?? "23:59");

  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
  }

  const bookedCovers = bookings?.reduce((sum, b) => sum + b.party_size, 0) ?? 0;
  const bookedParties = bookings?.length ?? 0;

  // =====================================================
  // Step 3: Calculate availability
  // =====================================================
  const availableCovers = maxCovers ? maxCovers - bookedCovers : 999999;
  const utilizationPercent = maxCovers
    ? Math.round((bookedCovers / maxCovers) * 100)
    : 0;

  const metadata: CapacityMetadata = {
    servicePeriod: matchedPeriod?.periodName,
    maxCovers,
    bookedCovers,
    availableCovers,
    utilizationPercent,
    maxParties,
    bookedParties,
  };

  // =====================================================
  // Step 4: Check if requested party fits
  // =====================================================
  
  // Check covers limit
  if (maxCovers !== null && bookedCovers + partySize > maxCovers) {
    return {
      available: false,
      reason: `Maximum capacity of ${maxCovers} covers exceeded. Currently booked: ${bookedCovers}, Requested: ${partySize}`,
      metadata,
    };
  }

  // Check parties limit
  if (maxParties !== null && bookedParties + 1 > maxParties) {
    return {
      available: false,
      reason: `Maximum of ${maxParties} bookings exceeded for this period. Currently booked: ${bookedParties}`,
      metadata,
    };
  }

  // =====================================================
  // Step 5: Return success
  // =====================================================
  return {
    available: true,
    metadata,
  };
}

/**
 * Find alternative time slots when preferred time is unavailable
 * 
 * @param params - Search parameters
 * @param client - Optional Supabase client
 * @returns Array of time slots with availability status
 * 
 * @example
 * ```typescript
 * const alternatives = await findAlternativeSlots({
 *   restaurantId: 'uuid',
 *   date: '2025-10-20',
 *   partySize: 4,
 *   preferredTime: '19:00',
 *   maxAlternatives: 5
 * });
 * 
 * alternatives.forEach(slot => {
 *   console.log(`${slot.time}: ${slot.available ? 'Available' : 'Full'} (${slot.utilizationPercent}%)`);
 * });
 * ```
 */
export async function findAlternativeSlots(
  params: AlternativeSlotParams,
  client?: DbClient
): Promise<TimeSlot[]> {
  const {
    restaurantId,
    date,
    partySize,
    preferredTime,
    maxAlternatives = DEFAULT_MAX_ALTERNATIVES,
    searchWindowMinutes = DEFAULT_SEARCH_WINDOW_MINUTES,
  } = params;

  // Generate candidate times
  const candidateTimes = generateAlternativeTimes(preferredTime, searchWindowMinutes);

  // Check availability for each candidate
  const slotsWithAvailability = await Promise.all(
    candidateTimes.map(async (time) => {
      const result = await checkSlotAvailability(
        { restaurantId, date, time, partySize },
        client
      );

      return {
        time,
        available: result.available,
        utilizationPercent: result.metadata.utilizationPercent,
        bookedCovers: result.metadata.bookedCovers,
        maxCovers: result.metadata.maxCovers ?? undefined,
      };
    })
  );

  // Filter to available slots and limit to maxAlternatives
  const availableSlots = slotsWithAvailability
    .filter((slot) => slot.available)
    .slice(0, maxAlternatives);

  return availableSlots;
}

/**
 * Calculate period capacity utilization (wrapper for ops/capacity.ts)
 * 
 * Reuses existing calculateCapacityUtilization from ops/capacity.ts
 * This is here for consistency in the capacity service API.
 */
export { calculateCapacityUtilization } from "@/server/ops/capacity";

/**
 * Get service periods with capacity (wrapper for ops/capacity.ts)
 */
export { getServicePeriodsWithCapacity } from "@/server/ops/capacity";
