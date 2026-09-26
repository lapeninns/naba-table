import { z } from 'zod';

import { occasionAvailabilityRuleSchema } from '@reserve/shared/occasions';

/**
 * Request bodies for the platform-admin booking-type (occasion) routes. Limits match the
 * `booking_occasions` columns: `default_duration_minutes` and `display_order` are smallint.
 */

const labelSchema = z.string().trim().min(1, 'Enter a name.').max(80);
const shortLabelSchema = z.string().trim().max(40);
const descriptionSchema = z.string().trim().max(500).nullable();
const availabilitySchema = z.array(occasionAvailabilityRuleSchema).max(20);
const durationSchema = z.number().int().min(1).max(1440);
const displayOrderSchema = z.number().int().min(0).max(32000);

export const createOccasionBodySchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'Use lowercase letters, numbers, dashes or underscores.'),
  label: labelSchema,
  shortLabel: shortLabelSchema.optional(),
  description: descriptionSchema.optional(),
  availability: availabilitySchema.optional(),
  defaultDurationMinutes: durationSchema.optional(),
  displayOrder: displayOrderSchema.optional(),
  isActive: z.boolean().optional(),
});

export type CreateOccasionBody = z.infer<typeof createOccasionBodySchema>;

export const updateOccasionBodySchema = z.object({
  /** The key is immutable; when sent it must equal the key in the URL. */
  key: z.string().optional(),
  label: labelSchema.optional(),
  shortLabel: shortLabelSchema.optional(),
  description: descriptionSchema.optional(),
  availability: availabilitySchema.optional(),
  defaultDurationMinutes: durationSchema.optional(),
  displayOrder: displayOrderSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateOccasionBody = z.infer<typeof updateOccasionBodySchema>;
