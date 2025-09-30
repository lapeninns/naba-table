import { z } from "zod";

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export const profileNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be 80 characters or fewer");

export const profileImageUrlSchema = z
  .string()
  .trim()
  .max(2048, "Image URL is too long")
  .refine((value) => isHttpsUrl(value), {
    message: "Image must be an https URL",
  })
  .refine((value) => /^https:\/\/\S+$/.test(value), {
    message: "Image URL cannot contain spaces",
  });

export const profilePhoneSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || /^[+\d()\s-]+$/.test(value), {
    message: "Phone can only include digits, spaces, +, -, and parentheses",
  })
  .refine((value) => {
    if (value.length === 0) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 20;
  }, {
    message: "Phone must include between 7 and 20 digits",
  });

export const profileUpdateSchema = z
  .object({
    name: z.union([profileNameSchema, z.literal(""), z.null()]).optional(),
    phone: z.union([profilePhoneSchema, z.literal(""), z.null()]).optional(),
    image: z.union([profileImageUrlSchema, z.literal(""), z.null()]).optional(),
  })
  .strict()
  .transform((value) => {
    const normalized: { name?: string | null; phone?: string | null; image?: string | null } = {};

    if (Object.prototype.hasOwnProperty.call(value, "name")) {
      const rawName = value.name;
      if (rawName === null || rawName === undefined || rawName === "") {
        normalized.name = null;
      } else {
        normalized.name = profileNameSchema.parse(rawName);
      }
    }

    if (Object.prototype.hasOwnProperty.call(value, "phone")) {
      const rawPhone = value.phone;
      if (rawPhone === null || rawPhone === undefined || rawPhone === "") {
        normalized.phone = null;
      } else {
        normalized.phone = profilePhoneSchema.parse(rawPhone);
      }
    }

    if (Object.prototype.hasOwnProperty.call(value, "image")) {
      const rawImage = value.image;
      if (rawImage === null || rawImage === undefined || rawImage === "") {
        normalized.image = null;
      } else {
        normalized.image = profileImageUrlSchema.parse(rawImage);
      }
    }

    return normalized;
  });

export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;

const profilePhoneValueSchema = profilePhoneSchema.refine((value) => value.length > 0, {
  message: "Phone must include between 7 and 20 digits",
});

export const profileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(80).nullable(),
  phone: profilePhoneValueSchema.nullable(),
  image: z.string().url().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const profileUploadResponseSchema = z.object({
  path: z.string(),
  url: z.string().url(),
  cacheKey: z.string(),
});

export type ProfileUploadResponse = z.infer<typeof profileUploadResponseSchema>;
