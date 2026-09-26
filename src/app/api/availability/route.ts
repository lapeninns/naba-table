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

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { firstString, safeBool } from '@/lib/api/query-params';
import { HttpError } from '@/lib/http/errors';
import { logger, sanitizeLogText } from '@/lib/logger';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import { checkSlotAvailability, findAlternativeSlots } from '@/server/capacity';
import { recordObservabilityEvent } from '@/server/observability';
import { getActiveRestaurantId } from '@/server/restaurants/getActiveRestaurantId';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { extractClientIp, anonymizeIp } from '@/server/security/request';
import { getDefaultRestaurantId, MissingRestaurantContextError } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/availability';

// =====================================================
// Request Validation
// =====================================================

const availabilityQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  partySize: z.coerce.number().int().min(1).max(50, 'Party size must be between 1 and 50'),
  seating: z.enum(['any', 'indoor', 'outdoor', 'bar', 'window', 'quiet', 'booth']).optional(),
  includeAlternatives: z.boolean().default(false),
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
      restaurantId: firstString(searchParams, 'restaurantId'),
      date: firstString(searchParams, 'date'),
      time: firstString(searchParams, 'time'),
      partySize: firstString(searchParams, 'partySize'),
      seating: firstString(searchParams, 'seating'),
      includeAlternatives: safeBool(searchParams, 'includeAlternatives', false),
    };

    const parsed = availabilityQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      restaurantId: rawRestaurantId,
      date,
      time,
      partySize,
      seating,
      includeAlternatives,
    } = parsed.data;

    const preflightRateLimit = await requireApiRateLimit({
      request: req,
      scope: 'availability:public',
      tenantId: rawRestaurantId ?? 'default',
      limit: 30,
      windowMs: 60_000,
      message: 'Too many availability requests. Please try again in a moment.',
    });
    if (preflightRateLimit) {
      return preflightRateLimit;
    }

    const resolvedRestaurantId = rawRestaurantId
      ? await getActiveRestaurantId(rawRestaurantId)
      : await getDefaultRestaurantId().catch((error) => {
          if (error instanceof MissingRestaurantContextError) {
            throw new HttpError({
              message: 'restaurantId is required',
              status: 400,
              code: 'RESTAURANT_REQUIRED',
            });
          }
          throw error;
        });

    if (!resolvedRestaurantId) {
      throw new HttpError({
        message: 'Restaurant not found',
        status: 404,
        code: 'RESTAURANT_NOT_FOUND',
      });
    }

    const restaurantId = resolvedRestaurantId;

    // =====================================================
    // Step 2: Rate Limiting
    // =====================================================

    const clientIp = extractClientIp(req);
    const tenantRateLimit = await requireApiRateLimit({
      request: req,
      scope: 'availability:tenant',
      tenantId: restaurantId,
      limit: 20,
      windowMs: 60_000,
      message: 'Too many availability requests. Please try again in a moment.',
    });

    if (tenantRateLimit) {
      void recordObservabilityEvent({
        source: 'api.availability',
        eventType: 'availability_check.rate_limited',
        severity: 'warning',
        context: {
          restaurant_id: restaurantId,
          ip_scope: anonymizeIp(clientIp),
        },
      });
      return tenantRateLimit;
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
      let alternativeCount = 0;
      if (includeAlternatives && !result.available) {
        const altSlots = await findAlternativeSlots({
          restaurantId,
          date,
          partySize,
          preferredTime: time,
          maxAlternatives: 5,
          searchWindowMinutes: 120,
        });

        alternatives = altSlots.map((slot) => ({
          time: slot.time,
          available: slot.available,
        }));
        alternativeCount = alternatives.length;
      }

      // Log check
      void recordObservabilityEvent({
        source: 'api.availability',
        eventType: 'availability.check.specific_time',
        severity: 'info',
        context: {
          restaurantId,
          date,
          time,
          partySize,
          available: result.available,
          utilizationPercent: result.metadata.utilizationPercent,
        },
      });

      captureRestaurantServerEvent('availability_slots_loaded', {
        restaurantId,
        props: {
          available: result.available,
          slotCount: alternativeCount,
          source: 'api',
        },
      });
      if (!result.available) {
        captureRestaurantServerEvent('availability_no_slots_shown', {
          restaurantId,
          props: { source: 'api' },
        });
      }

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
          },
          alternatives,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
            'X-Available': result.available.toString(),
          },
        },
      );
    }

    // =====================================================
    // Step 4: Check All Day Availability (no specific time)
    // =====================================================

    // For "all day" queries, we could generate common time slots
    // For now, return error asking for specific time
    return NextResponse.json(
      {
        error: 'Time parameter required',
        message: 'Please specify a time parameter (HH:MM format) to check availability',
        hint: 'Example: ?restaurantId=uuid&date=2025-10-20&time=19:00&partySize=4',
      },
      { status: 400 },
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
    if (error instanceof HttpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    logger.error('[availability][GET] Unexpected error', { route: ROUTE, error });

    void recordObservabilityEvent({
      source: 'api.availability',
      eventType: 'availability.check.failure',
      severity: 'error',
      context: {
        error: sanitizeLogText(error instanceof Error ? error.message : String(error)),
      },
    });

    captureRestaurantServerEvent('availability_request_failed', {
      props: { source: 'api', path: '/api/availability' },
    });
    captureServerException(error, {
      properties: { source: 'api', path: '/api/availability' },
    });

    return NextResponse.json(
      {
        error: 'Failed to check availability',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 },
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
