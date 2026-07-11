import { z } from 'zod';

import { MAX_ONLINE_PARTY_SIZE } from '@/lib/bookings/partySize';
import { BOOKING_TYPES } from '@/server/bookings';
import {
  CUSTOMER_PHONE_LENGTH_MAX,
  CUSTOMER_PHONE_LENGTH_MIN,
  isUKPhone,
} from '@reserve/shared/validation';

const bookingRouteBaseQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
});

export const contactBookingLookupQuerySchema = bookingRouteBaseQuerySchema.extend({
  email: z.string().email(),
  phone: z
    .string()
    .min(CUSTOMER_PHONE_LENGTH_MIN)
    .max(CUSTOMER_PHONE_LENGTH_MAX)
    .refine((value) => isUKPhone(value), {
      message: 'Please enter a valid UK phone number.',
    }),
});

const bookingTypeSchema = z.enum(BOOKING_TYPES);
const bookingSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export const DEFAULT_SEATING_PREFERENCE = 'any';

const explicitBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

export const bookingCreateRequestSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  restaurantSlug: z.string().regex(bookingSlugPattern).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1).max(MAX_ONLINE_PARTY_SIZE),
  bookingType: bookingTypeSchema,
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z
    .string()
    .min(CUSTOMER_PHONE_LENGTH_MIN)
    .max(CUSTOMER_PHONE_LENGTH_MAX)
    .refine((value) => isUKPhone(value), {
      message: 'Please enter a valid UK phone number.',
    }),
  marketingOptIn: explicitBooleanSchema.optional().default(false),
  whatsappOptIn: explicitBooleanSchema.optional().default(false),
});

export type ContactBookingLookupQuery = z.infer<typeof contactBookingLookupQuerySchema>;
export type BookingCreateRequest = z.infer<typeof bookingCreateRequestSchema>;
