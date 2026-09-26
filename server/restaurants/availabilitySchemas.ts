import { z } from 'zod';

import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { TIME_REGEX, canonicalTime } from '@/server/restaurants/timeNormalization';

/**
 * Request-body schemas for the restaurant availability resources. The per-resource routes
 * (`hours`, `service-periods`, `turn-bands`) and the availability command route validate their
 * bodies with the same schemas, so the command accepts exactly what the single-resource routes do.
 */

const timeSchema = z
  .string()
  .trim()
  .regex(TIME_REGEX)
  .transform((value) => canonicalTime(value));
const notesSchema = z.string().max(250);
const intervalSchema = z.number().int().min(RESERVATION_INTERVAL_MIN).max(RESERVATION_INTERVAL_MAX);
const slotTimesSchema = z.array(timeSchema);

const weeklyEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: z.union([timeSchema, z.null()]).optional(),
    closesAt: z.union([timeSchema, z.null()]).optional(),
    isClosed: z.boolean().optional(),
    notes: notesSchema.nullable().optional(),
    reservationIntervalMinutes: z.union([intervalSchema, z.null()]).optional(),
    reservationSlotTimes: z.union([slotTimesSchema, z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const isClosed = data.isClosed ?? false;
    if (isClosed) {
      return;
    }

    if (!data.opensAt || !data.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'opensAt and closesAt are required when day is not closed',
      });
    }
  });

const overrideSchema = z
  .object({
    id: z.string().uuid().optional(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    opensAt: z.union([timeSchema, z.null()]).optional(),
    closesAt: z.union([timeSchema, z.null()]).optional(),
    isClosed: z.boolean().optional(),
    notes: notesSchema.nullable().optional(),
    reservationIntervalMinutes: z.union([intervalSchema, z.null()]).optional(),
    reservationSlotTimes: z.union([slotTimesSchema, z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const isClosed = data.isClosed ?? false;
    if (isClosed) {
      return;
    }

    if (!data.opensAt || !data.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'opensAt and closesAt are required when override is not closed',
      });
    }
  });

/** PUT /hours body: the full weekly schedule and every special date. */
export const operatingHoursPayloadSchema = z.object({
  weekly: z.array(weeklyEntrySchema),
  overrides: z.array(overrideSchema),
});

/** One service period (meal time) in a PUT /service-periods body. */
export const servicePeriodEntrySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startTime: timeSchema,
  endTime: timeSchema,
  bookingOption: z.string().trim().min(1),
});

/** PUT /service-periods body: the full list of the restaurant's periods. */
export const servicePeriodsPayloadSchema = z.array(servicePeriodEntrySchema);

const turnBandSchema = z.object({
  maxPartySize: z.number().int(),
  durationMinutes: z.number().int(),
});

/** PUT /turn-bands body: table times per party size, keyed by booking option. */
export const turnBandsPayloadSchema = z.record(z.string(), z.array(turnBandSchema));
