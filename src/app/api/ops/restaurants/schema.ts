import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INTERVAL_SCHEMA = z.number().int().min(1).max(180);
const DURATION_SCHEMA = z.number().int().min(15).max(300);

const optionalLogoUrlSchema = z
  .preprocess((value) => {
    if (typeof value !== 'string') {
      return value === undefined ? undefined : value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().url('Logo URL must be a valid absolute URL').nullable())
  .optional();

export const listRestaurantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sort: z.enum(['name', 'created_at']).default('name'),
});

export type ListRestaurantsQuery = z.infer<typeof listRestaurantsQuerySchema>;

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  timezone: z.string().trim().min(1, 'Timezone is required'),
  capacity: z.number().int().positive().nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .nullable()
    .optional()
    .transform((val) => val || null),
  contactPhone: z
    .string()
    .trim()
    .min(5, 'Phone number must be at least 5 characters')
    .nullable()
    .optional()
    .transform((val) => val || null),
  address: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
  googleMapUrl: z
    .string()
    .trim()
    .url('Google Map link must be a valid URL')
    .nullable()
    .optional()
    .transform((val) => val || null),
  bookingPolicy: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
  emailSendReminder24h: z.boolean().optional(),
  emailSendReminderShort: z.boolean().optional(),
  emailSendReviewRequest: z.boolean().optional(),
  logoUrl: optionalLogoUrlSchema,
  reservationIntervalMinutes: INTERVAL_SCHEMA.optional(),
  reservationDefaultDurationMinutes: DURATION_SCHEMA.optional(),
  reservationLastSeatingBufferMinutes: DURATION_SCHEMA.optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  timezone: z.string().trim().min(1, 'Timezone is required').optional(),
  capacity: z.number().int().positive().nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .nullable()
    .optional()
    .transform((val) => val || null),
  contactPhone: z
    .string()
    .trim()
    .min(5, 'Phone number must be at least 5 characters')
    .nullable()
    .optional()
    .transform((val) => val || null),
  address: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
  googleMapUrl: z
    .string()
    .trim()
    .url('Google Map link must be a valid URL')
    .nullable()
    .optional()
    .transform((val) => val || null),
  bookingPolicy: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((val) => val || null),
  emailSendReminder24h: z.boolean().optional(),
  emailSendReminderShort: z.boolean().optional(),
  emailSendReviewRequest: z.boolean().optional(),
  logoUrl: optionalLogoUrlSchema,
  reservationIntervalMinutes: INTERVAL_SCHEMA.optional(),
  reservationDefaultDurationMinutes: DURATION_SCHEMA.optional(),
  reservationLastSeatingBufferMinutes: DURATION_SCHEMA.optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

export type RestaurantDTO = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  googleMapUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  createdAt: string;
  updatedAt: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
};

export type RestaurantsListResponse = {
  items: RestaurantDTO[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};

export type RestaurantResponse = {
  restaurant: RestaurantDTO;
};

export type DeleteRestaurantResponse = {
  success: true;
};
