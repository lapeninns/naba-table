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

const optionalCreateEmailSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value && !z.string().email().safeParse(value).success) {
      ctx.addIssue({ code: 'custom', message: 'Please enter a valid email address.' });
    }
  })
  .optional()
  .default('');

const optionalCreatePhoneSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!value) return;
    if (
      value.length < CUSTOMER_PHONE_LENGTH_MIN ||
      value.length > CUSTOMER_PHONE_LENGTH_MAX ||
      !isUKPhone(value)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Please enter a valid UK phone number.' });
    }
  })
  .optional()
  .default('');

export const bookingCreateRequestSchema = z
  .object({
    restaurantId: z.string().uuid().optional(),
    restaurantSlug: z.string().regex(bookingSlugPattern).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    party: z.number().int().min(1).max(MAX_ONLINE_PARTY_SIZE),
    bookingType: bookingTypeSchema,
    notes: z.string().max(500).optional().nullable(),
    name: z.string().min(2).max(120),
    email: optionalCreateEmailSchema,
    phone: optionalCreatePhoneSchema,
    marketingOptIn: explicitBooleanSchema.optional().default(false),
    whatsappOptIn: explicitBooleanSchema.optional().default(false),
    sundayRoast: explicitBooleanSchema.optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      const message = 'Add an email address or phone number.';
      ctx.addIssue({ code: 'custom', path: ['email'], message });
      ctx.addIssue({ code: 'custom', path: ['phone'], message });
    }
    if (value.whatsappOptIn && !value.phone) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Add a phone number for WhatsApp updates.',
      });
    }
  });

export type ContactBookingLookupQuery = z.infer<typeof contactBookingLookupQuerySchema>;
export type BookingCreateRequest = z.infer<typeof bookingCreateRequestSchema>;
