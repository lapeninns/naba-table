import { z } from "zod";

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createRestaurantSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be 120 characters or fewer")
    .transform((value) => value.trim()),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(63, "Slug must be 63 characters or fewer")
    .regex(slugPattern, "Slug may only contain lowercase letters, numbers, and hyphens")
    .transform((value) => value.trim()),
  timezone: z
    .string()
    .min(1, "Timezone is required")
    .transform((value) => value.trim()),
  contactEmail: z
    .string()
    .transform((value) => value.trim())
    .optional()
    .refine((value) => !value || /.+@.+\..+/.test(value), "Use a valid email address")
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  contactPhone: z
    .string()
    .transform((value) => value.trim())
    .optional()
    .refine((value) => !value || (value.length >= 7 && value.length <= 32), "Phone must be between 7 and 32 characters")
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  address: z
    .string()
    .transform((value) => value.trim())
    .optional()
    .refine((value) => !value || value.length <= 500, "Address must be 500 characters or fewer")
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type CreateRestaurantPayload = z.infer<typeof createRestaurantSchema>;
