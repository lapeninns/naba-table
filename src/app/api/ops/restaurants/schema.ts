import { z } from 'zod';

import {
  buildRestaurantEmailTemplateVariantSignature,
  getUnknownRestaurantEmailTemplateTokens,
  MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS,
  RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS,
  RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS,
} from '@/lib/restaurants/email-templates';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const E164_REGEX = /^\+[1-9][0-9]{6,14}$/;
const INTERVAL_SCHEMA = z
  .number()
  .int()
  .min(RESERVATION_INTERVAL_MIN)
  .max(RESERVATION_INTERVAL_MAX);
const DURATION_SCHEMA = z.number().int().min(15).max(300);
const GRACE_SCHEMA = z.number().int().min(0).max(120);
const SCRIPT_DELIMITER_REGEX = /<\s*\/?\s*script\b/i;

function hasUnsafeControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0 && code <= 8) ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      return true;
    }
  }
  return false;
}

// triage-042: restaurant name is a single-line field whose value flows into the email From
// display name. Reject ALL control characters (incl. TAB/CR/LF, which the shared
// hasUnsafeControlCharacter intentionally allows for multi-line template bodies).
function hasLineBreakOrControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function normalizeNullableSafeUrl(
  value: unknown,
  sanitizer: (value: string | null | undefined) => string | null,
) {
  if (typeof value !== 'string') {
    return value === undefined ? undefined : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return sanitizer(trimmed) ?? trimmed;
}

function googleUrlSchema(
  sanitizer: (value: string | null | undefined) => string | null,
  message: string,
) {
  return z
    .preprocess(
      (value) => normalizeNullableSafeUrl(value, sanitizer),
      z
        .string()
        .max(2048)
        .refine((value) => sanitizer(value) === value, message)
        .nullable(),
    )
    .optional();
}

function plainTextSchema(schema: z.ZodString, fieldLabel: string) {
  return schema
    .refine((value) => !SCRIPT_DELIMITER_REGEX.test(value), {
      message: `${fieldLabel} cannot contain script markup`,
    })
    .refine((value) => !hasUnsafeControlCharacter(value), {
      message: `${fieldLabel} cannot contain control characters`,
    });
}

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
  name: z
    .string()
    .trim()
    .min(1, 'Restaurant name is required')
    .refine((value) => !hasLineBreakOrControlCharacter(value), {
      message: 'Restaurant name cannot contain line breaks or control characters',
    }),
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
  businessDescription: z
    .string()
    .trim()
    .max(4096, 'Business description must be 4096 characters or fewer')
    .nullable()
    .optional()
    .transform((val) => val || null),
  managerDailySummaryEnabled: z.boolean().optional(),
  managerWhatsappEnabled: z.boolean().optional(),
  managerNotificationPhone: z
    .string()
    .trim()
    .regex(E164_REGEX, 'Manager notification phone must be in E.164 format')
    .nullable()
    .optional()
    .transform((val) => val || null),
  googleMapUrl: googleUrlSchema(
    safeGoogleMapsUrl,
    'Google Map link must be an HTTPS Google Maps URL',
  ),
  googleReviewUrl: googleUrlSchema(
    safeGoogleReviewUrl,
    'Google review link must be an HTTPS Google review URL',
  ),
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
  reservationLifecycleGraceMinutes: GRACE_SCHEMA.optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Restaurant name is required')
    .refine((value) => !hasLineBreakOrControlCharacter(value), {
      message: 'Restaurant name cannot contain line breaks or control characters',
    })
    .optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1, 'Timezone is required').optional(),
  capacity: z.number().int().positive().nullable().optional(),
  contactEmail: z
    .string()
    .trim()
    .regex(EMAIL_REGEX, 'Invalid email format')
    .nullable()
    .transform((val) => val || null)
    .optional(),
  contactPhone: z
    .string()
    .trim()
    .min(5, 'Phone number must be at least 5 characters')
    .nullable()
    .transform((val) => val || null)
    .optional(),
  address: z
    .string()
    .trim()
    .nullable()
    .transform((val) => val || null)
    .optional(),
  businessDescription: z
    .string()
    .trim()
    .max(4096, 'Business description must be 4096 characters or fewer')
    .nullable()
    .transform((val) => val || null)
    .optional(),
  managerDailySummaryEnabled: z.boolean().optional(),
  managerWhatsappEnabled: z.boolean().optional(),
  managerNotificationPhone: z
    .string()
    .trim()
    .regex(E164_REGEX, 'Manager notification phone must be in E.164 format')
    .nullable()
    .transform((val) => val || null)
    .optional(),
  googleMapUrl: googleUrlSchema(
    safeGoogleMapsUrl,
    'Google Map link must be an HTTPS Google Maps URL',
  ),
  googleReviewUrl: googleUrlSchema(
    safeGoogleReviewUrl,
    'Google review link must be an HTTPS Google review URL',
  ),
  bookingPolicy: z
    .string()
    .trim()
    .nullable()
    .transform((val) => val || null)
    .optional(),
  emailSendReminder24h: z.boolean().optional(),
  emailSendReminderShort: z.boolean().optional(),
  emailSendReviewRequest: z.boolean().optional(),
  logoUrl: optionalLogoUrlSchema,
  reservationIntervalMinutes: INTERVAL_SCHEMA.optional(),
  reservationDefaultDurationMinutes: DURATION_SCHEMA.optional(),
  reservationLastSeatingBufferMinutes: DURATION_SCHEMA.optional(),
  reservationLifecycleGraceMinutes: GRACE_SCHEMA.optional(),
  managerName: z
    .string()
    .trim()
    .max(80, 'Manager name must be 80 characters or fewer')
    .refine((value) => !hasLineBreakOrControlCharacter(value), {
      message: 'Manager name cannot contain line breaks or control characters',
    })
    .nullable()
    .transform((val) => val || null)
    .optional(),
});

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

export type RestaurantDTO = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  managerDailySummaryEnabled: boolean;
  managerWhatsappEnabled: boolean;
  managerName: string | null;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
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

export const restaurantEmailTemplateKeySchema = z.enum(RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS);
export const restaurantEmailTemplateGroupKeySchema = z.enum(
  RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS,
);

const emailTemplateTextSchema = plainTextSchema(z.string().trim().min(1).max(280), 'Message body');
const emailTemplateSupportTextSchema = z.string().trim().max(180);
const emailTemplateHeadlineSchema = plainTextSchema(z.string().trim().min(1).max(140), 'Headline');
const emailTemplateSubjectSchema = plainTextSchema(z.string().trim().min(1).max(140), 'Subject');
const emailTemplatePreheaderSchema = z.string().trim().min(1).max(180);

function addUnknownTokenIssues(
  text: string,
  fieldLabel: string,
  ctx: z.RefinementCtx,
  path: (string | number)[],
) {
  const unknownTokens = getUnknownRestaurantEmailTemplateTokens(text);
  if (unknownTokens.length === 0) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `${fieldLabel} contains unknown variables: ${unknownTokens.map((token) => `{{${token}}}`).join(', ')}`,
    path,
  });
}

const emailTemplateVariantSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  subject: emailTemplateSubjectSchema,
  preheader: emailTemplatePreheaderSchema,
  headline: emailTemplateHeadlineSchema,
  intro: emailTemplateTextSchema,
  cue: emailTemplateSupportTextSchema.optional().transform((val) => val ?? ''),
  ask: emailTemplateSupportTextSchema.optional().transform((val) => val ?? ''),
  ctaLabel: plainTextSchema(z.string().trim().min(1).max(60), 'CTA label'),
  isActive: z.boolean(),
  order: z
    .number()
    .int()
    .min(0)
    .max(MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS - 1),
});

export const updateRestaurantEmailTemplateSchema = z.object({
  variants: z
    .array(emailTemplateVariantSchema)
    .min(1, 'At least one variant is required')
    .max(
      MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS,
      `You can save up to ${MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS} variants`,
    )
    .superRefine((variants, ctx) => {
      const ids = new Set<string>();
      const orders = new Set<number>();
      const activeSignatures = new Map<string, string>();
      let activeCount = 0;

      for (const [index, variant] of variants.entries()) {
        if (ids.has(variant.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Variant id "${variant.id}" must be unique`,
            path: [index, 'id'],
          });
        }
        ids.add(variant.id);

        if (orders.has(variant.order)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Variant order "${variant.order}" must be unique`,
            path: [index, 'order'],
          });
        }
        orders.add(variant.order);

        addUnknownTokenIssues(variant.subject, 'Subject', ctx, [index, 'subject']);
        addUnknownTokenIssues(variant.preheader, 'Preheader', ctx, [index, 'preheader']);
        addUnknownTokenIssues(variant.headline, 'Headline', ctx, [index, 'headline']);
        addUnknownTokenIssues(variant.intro, 'Message body', ctx, [index, 'intro']);
        addUnknownTokenIssues(variant.cue, 'Cue', ctx, [index, 'cue']);
        addUnknownTokenIssues(variant.ask, 'Ask', ctx, [index, 'ask']);
        addUnknownTokenIssues(variant.ctaLabel, 'CTA label', ctx, [index, 'ctaLabel']);

        if (variant.isActive) {
          activeCount += 1;
          const signature = buildRestaurantEmailTemplateVariantSignature(variant);
          const existingVariantName = activeSignatures.get(signature);
          if (existingVariantName) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Active variants "${existingVariantName}" and "${variant.name}" have identical delivery copy. Change the content or pause one variant.`,
              path: [index],
            });
          } else {
            activeSignatures.set(signature, variant.name);
          }
        }
      }

      if (activeCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one active variant is required',
        });
      }
    }),
});

export const previewRestaurantEmailTemplateSchema = z.object({
  preferredVariantId: z.string().trim().min(1).max(120).optional(),
  variants: updateRestaurantEmailTemplateSchema.shape.variants.optional(),
});

export const sendRestaurantEmailTemplateTestSchema = previewRestaurantEmailTemplateSchema.extend({
  toEmail: z.string().trim().regex(EMAIL_REGEX, 'Invalid email format'),
});

export type UpdateRestaurantEmailTemplateInput = z.infer<
  typeof updateRestaurantEmailTemplateSchema
>;
export type PreviewRestaurantEmailTemplateInput = z.infer<
  typeof previewRestaurantEmailTemplateSchema
>;
export type SendRestaurantEmailTemplateTestInput = z.infer<
  typeof sendRestaurantEmailTemplateTestSchema
>;

export type RestaurantEmailTemplateVariantDTO = z.infer<typeof emailTemplateVariantSchema>;

export type RestaurantEmailTemplateDTO = {
  key: z.infer<typeof restaurantEmailTemplateKeySchema>;
  title: string;
  description: string;
  groupKey: z.infer<typeof restaurantEmailTemplateGroupKeySchema>;
  supportsCtaLabel: boolean;
  availableVariables: string[];
  recommendedVariables: string[];
  authoringHints: string[];
  status: 'default' | 'custom';
  activeVariantCount: number;
  variants: RestaurantEmailTemplateVariantDTO[];
  defaultVariants: RestaurantEmailTemplateVariantDTO[];
};

export type RestaurantEmailTemplateGroupDTO = {
  key: z.infer<typeof restaurantEmailTemplateGroupKeySchema>;
  title: string;
  description: string;
  templates: RestaurantEmailTemplateDTO[];
};

export type RestaurantEmailTemplatesResponse = {
  restaurantId: string;
  canEdit: boolean;
  groups: RestaurantEmailTemplateGroupDTO[];
};

export type RestaurantEmailTemplateResponse = {
  restaurantId: string;
  canEdit: boolean;
  template: RestaurantEmailTemplateDTO;
};

export type RestaurantEmailTemplatePreviewResponse = {
  restaurantId: string;
  preview: {
    templateKey: z.infer<typeof restaurantEmailTemplateKeySchema>;
    selectedVariantId: string;
    selectedVariantName: string;
    preheader: string;
    headline: string;
    intro: string;
    cue: string;
    ask: string;
    ctaLabel: string;
    ctaUrl: string;
    subject: string;
    html: string;
    text: string;
  };
};

export type SendRestaurantEmailTemplateTestResponse = {
  ok: true;
  restaurantId: string;
  provider: 'resend' | 'mock';
  messageId: string;
  preview: RestaurantEmailTemplatePreviewResponse['preview'];
};
