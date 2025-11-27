import { z } from "zod";

import { isEmail, isUKPhone } from "@reserve/shared/validation";

const optionalEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .refine((value) => !value || isEmail(value), {
        message: "Please enter a valid email address.",
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
        message: "Please enter a valid phone number.",
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
      .max(500, { message: "Override reason must be 500 characters or fewer." })
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.apply) {
      const reason = value.reason?.trim() ?? "";
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Override reason must be at least 3 characters when applying override.",
        });
      }
    }
  });

export const opsWalkInBookingSchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party: z.number().int().min(1),
  bookingType: z.enum(["breakfast", "lunch", "dinner", "drinks"]),
  seating: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  name: z.string().min(2).max(120),
  email: optionalEmailSchema,
  phone: optionalPhoneSchema,
  marketingOptIn: z.coerce.boolean().optional().default(false),
  override: overrideSchema.optional(),
});

export type OpsWalkInBookingPayload = z.infer<typeof opsWalkInBookingSchema>;
