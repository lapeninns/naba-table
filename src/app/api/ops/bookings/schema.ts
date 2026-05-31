import { z } from 'zod';

import { isEmail, isUKPhone } from '@reserve/shared/validation';

const POSTGREST_FILTER_CONTROL_CHARS = /[",()]/;

const explicitBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

const optionalEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((value) => !value || isEmail(value), {
        message: 'Please enter a valid email address.',
      })
      .refine((value) => !value || !POSTGREST_FILTER_CONTROL_CHARS.test(value), {
        message: 'Please enter a valid email address.',
      })
      .transform((value) => (value ? value : null)),
    z.null().transform((): null => null),
  ])
  .optional()
  .transform((value) => (value === undefined ? null : value));

const optionalPhoneSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((value) => !value || isUKPhone(value), {
        message: 'Please enter a valid phone number.',
      })
      .transform((value) => (value ? value : null)),
    z.null().transform((): null => null),
  ])
  .optional()
  .transform((value) => (value === undefined ? null : value));

const overrideSchema = z
  .object({
    apply: z.boolean(),
    reason: z
      .string()
      .trim()
      .max(500, { message: 'Override reason must be 500 characters or fewer.' })
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.apply) {
      const reason = value.reason?.trim() ?? '';
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Override reason must be at least 3 characters when applying override.',
        });
      }
    }
  });

export const opsWalkInBookingSchema = z
  .object({
    restaurantId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    party: z.number().int().min(1),
    bookingType: z.enum(['lunch', 'dinner']),
    seating: z.string().min(1),
    notes: z.string().max(500).optional().nullable(),
    name: z.string().min(2).max(120),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    marketingOptIn: explicitBooleanSchema.optional().default(false),
    override: overrideSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // At least one contact method (email or phone) is required
    const hasEmail =
      data.email !== null && data.email !== undefined && data.email.trim().length > 0;
    const hasPhone =
      data.phone !== null && data.phone !== undefined && data.phone.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      // Add error to both fields so the UI can highlight them
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Please provide at least one contact method (email or phone).',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Please provide at least one contact method (email or phone).',
      });
    }
  });

export type OpsWalkInBookingPayload = z.infer<typeof opsWalkInBookingSchema>;
