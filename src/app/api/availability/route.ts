/**
 * GET /api/availability - Check booking availability
 * Story 3: New Endpoint for Availability Checking
 * 
 * This endpoint allows guests to check availability before attempting to book.
 * It's used by:
 * - Booking forms to show real-time availability
 * - Calendar/datepicker to show available slots
 * - Alternative time suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkSlotAvailability, findAlternativeSlots } from "@/server/capacity";
import { getDefaultRestaurantId } from "@/server/supabase";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { extractClientIp, anonymizeIp } from "@/server/security/request";
import { recordObservabilityEvent } from "@/server/observability";

// =====================================================
// Request Validation
// =====================================================

const availabilityQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  partySize: z.coerce.number().int().min(1).max(50, "Party size must be between 1 and 50"),
  seating: z.enum(["any", "indoor", "outdoor", "bar", "window", "quiet", "booth"]).optional(),
  includeAlternatives: z.coerce.boolean().default(false),
});

// =====================================================
// Main Handler
// =====================================================

export async function GET(req: NextRequest) {
  try {
    // =====================================================
    // Step 1: Parse and Validate Query Parameters
    // =====================================================
    
    const searchParams = req.nextUrl.searchParams;
    const rawParams = {
      restaurantId: searchParams.get("restaurantId") ?? undefined,
      date: searchParams.get("date"),
      time: searchParams.get("time") ?? undefined,
      partySize: searchParams.get("partySize"),
      seating: searchParams.get("seating") ?? undefined,
      includeAlternatives: searchParams.get("includeAlternatives") ?? "false",
    };

    const parsed = availabilityQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { restaurantId: rawRestaurantId, date, time, partySize, seating, includeAlternatives } = parsed.data;
    const restaurantId = rawRestaurantId ?? await getDefaultRestaurantId();

    // =====================================================
    // Step 2: Rate Limiting
    // =====================================================
    
    const clientIp = extractClientIp(req);
    const rateResult = await consumeRateLimit({
      identifier: `availability:check:${restaurantId}:${clientIp}`,
      limit: 20, // Lower limit than booking creation
      windowMs: 60_000, // 1 minute
    });

    if (!rateResult.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateResult.resetAt - Date.now()) / 1000));

      void recordObservabilityEvent({
        source: "api.availability",
        eventType: "availability_check.rate_limited",
        severity: "warning",
        context: {
          restaurant_id: restaurantId,
          ip_scope: anonymizeIp(clientIp),
          limit: rateResult.limit,
        },
      });

      return NextResponse.json(
        {
          error: "Too many availability requests. Please try again in a moment.",
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
        }
      );
    }

    // =====================================================
    // Step 3: Check Availability
    // =====================================================

    if (time) {
      // Check specific time slot
      const result = await checkSlotAvailability({
        restaurantId,
        date,
        time,
        partySize,
        seatingPreference: seating,
      });

      // Get alternatives if requested and slot is unavailable
      let alternatives = undefined;
      if (includeAlternatives && !result.available) {
        const altSlots = await findAlternativeSlots({
          restaurantId,
          date,
          partySize,
          preferredTime: time,
          maxAlternatives: 5,
          searchWindowMinutes: 120,
        });

        alternatives = altSlots.map(slot => ({
          time: slot.time,
          available: slot.available,
          utilizationPercent: slot.utilizationPercent,
        }));
      }

      // Log check
      void recordObservabilityEvent({
        source: "api.availability",
        eventType: "availability.check.specific_time",
        severity: "info",
        context: {
          restaurantId,
          date,
          time,
          partySize,
          available: result.available,
          utilizationPercent: result.metadata.utilizationPercent,
        },
      });

      return NextResponse.json(
        {
          restaurantId,
          date,
          time,
          partySize,
          available: result.available,
          reason: result.reason,
          metadata: {
            servicePeriod: result.metadata.servicePeriod,
            maxCovers: result.metadata.maxCovers,
            bookedCovers: result.metadata.bookedCovers,
            availableCovers: result.metadata.availableCovers,
            utilizationPercent: result.metadata.utilizationPercent,
            maxParties: result.metadata.maxParties,
            bookedParties: result.metadata.bookedParties,
          },
          alternatives,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
            "X-Available": result.available.toString(),
            "X-Utilization": result.metadata.utilizationPercent.toString(),
          },
        }
      );
    }

    // =====================================================
    // Step 4: Check All Day Availability (no specific time)
    // =====================================================
    
    // For "all day" queries, we could generate common time slots
    // For now, return error asking for specific time
    return NextResponse.json(
      {
        error: "Time parameter required",
        message: "Please specify a time parameter (HH:MM format) to check availability",
        hint: "Example: ?restaurantId=uuid&date=2025-10-20&time=19:00&partySize=4",
      },
      { status: 400 }
    );

    // Future enhancement: Return availability for common time slots
    // const commonTimes = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];
    // const slots = await Promise.all(
    //   commonTimes.map(async (slotTime) => {
    //     const result = await checkSlotAvailability({ restaurantId, date, time: slotTime, partySize });
    //     return {
    //       time: slotTime,
    //       available: result.available,
    //       utilizationPercent: result.metadata.utilizationPercent,
    //     };
    //   })
    // );
    // return NextResponse.json({ restaurantId, date, partySize, slots });

  } catch (error: unknown) {
    console.error("[availability][GET] Unexpected error", { error });

    void recordObservabilityEvent({
      source: "api.availability",
      eventType: "availability.check.failure",
      severity: "error",
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return NextResponse.json(
      {
        error: "Failed to check availability",
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * Usage Examples:
 * 
 * 1. Check specific time:
 *    GET /api/availability?restaurantId=uuid&date=2025-10-20&time=19:00&partySize=4
 * 
 * 2. Check with alternatives:
 *    GET /api/availability?restaurantId=uuid&date=2025-10-20&time=19:00&partySize=4&includeAlternatives=true
 * 
 * 3. Check with seating preference:
 *    GET /api/availability?restaurantId=uuid&date=2025-10-20&time=19:00&partySize=4&seating=window
 * 
 * Response (available):
 * {
 *   "restaurantId": "uuid",
 *   "date": "2025-10-20",
 *   "time": "19:00",
 *   "partySize": 4,
 *   "available": true,
 *   "metadata": {
 *     "servicePeriod": "Dinner Service",
 *     "maxCovers": 80,
 *     "bookedCovers": 48,
 *     "availableCovers": 32,
 *     "utilizationPercent": 60
 *   }
 * }
 * 
 * Response (unavailable with alternatives):
 * {
 *   "restaurantId": "uuid",
 *   "date": "2025-10-20",
 *   "time": "19:00",
 *   "partySize": 4,
 *   "available": false,
 *   "reason": "Maximum capacity of 80 covers exceeded. Currently booked: 80, Requested: 4",
 *   "metadata": { ... },
 *   "alternatives": [
 *     { "time": "18:45", "available": true, "utilizationPercent": 75 },
 *     { "time": "19:15", "available": true, "utilizationPercent": 65 },
 *     { "time": "20:00", "available": true, "utilizationPercent": 70 }
 *   ]
 * }
 */
