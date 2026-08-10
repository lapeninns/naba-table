import { z } from 'zod';

const resourceName = z.string().trim().min(1).max(500);
const pageToken = z.string().max(4096).optional();

export const googleAccountListSchema = z
  .object({
    accounts: z
      .array(z.object({ name: resourceName, accountName: z.string().optional() }).passthrough())
      .optional(),
    nextPageToken: pageToken,
  })
  .passthrough();

export const googleLocationMetadataSchema = z
  .object({
    placeId: z.string().optional(),
    canHaveFoodMenus: z.boolean().optional(),
  })
  .passthrough();

export const googleLocationSchema = z
  .object({
    name: resourceName,
    title: z.string().optional(),
    languageCode: z.string().optional(),
    storefrontAddress: z.record(z.string(), z.unknown()).optional(),
    phoneNumbers: z.record(z.string(), z.unknown()).optional(),
    categories: z.record(z.string(), z.unknown()).optional(),
    metadata: googleLocationMetadataSchema.optional(),
    profile: z.record(z.string(), z.unknown()).optional(),
    regularHours: z.record(z.string(), z.unknown()).optional(),
    specialHours: z.record(z.string(), z.unknown()).optional(),
    moreHours: z.array(z.record(z.string(), z.unknown())).optional(),
    serviceItems: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const googleLocationListSchema = z
  .object({
    locations: z.array(googleLocationSchema).optional(),
    nextPageToken: pageToken,
  })
  .passthrough();

export const googleAttributesSchema = z
  .object({
    name: resourceName.optional(),
    attributes: z.array(z.object({ name: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough();

const moneySchema = z
  .object({
    currencyCode: z.string().length(3),
    units: z
      .string()
      .regex(/^-?\d+$/)
      .optional(),
    nanos: z.number().int().min(-999_999_999).max(999_999_999).optional(),
  })
  .strict();

const foodItemSchema = z
  .object({
    labels: z
      .array(
        z
          .object({
            displayName: z.string().trim().min(1).max(140),
            languageCode: z.string().min(2).max(35),
          })
          .passthrough(),
      )
      .min(1),
    attributes: z.object({ price: moneySchema.optional() }).passthrough().optional(),
  })
  .passthrough();

const foodSectionSchema = z
  .object({
    labels: z
      .array(
        z
          .object({
            displayName: z.string().trim().min(1).max(140),
            languageCode: z.string().min(2).max(35),
          })
          .passthrough(),
      )
      .min(1),
    items: z.array(foodItemSchema).optional(),
  })
  .passthrough();

export const googleFoodMenusSchema = z
  .object({
    name: resourceName,
    menus: z.array(
      z
        .object({
          labels: z
            .array(
              z
                .object({
                  displayName: z.string().trim().min(1).max(140),
                  languageCode: z.string().min(2).max(35),
                })
                .passthrough(),
            )
            .min(1),
          sections: z.array(foodSectionSchema),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const googleTokenSuccessSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive().optional(),
    refresh_token: z.string().min(1).optional(),
    scope: z.string().optional(),
    token_type: z.string().optional(),
    id_token: z.string().min(1).optional(),
  })
  .passthrough();

export const googleTokenErrorSchema = z
  .object({
    error: z.string().min(1),
    error_description: z.string().optional(),
  })
  .passthrough();

export const googleNotificationSettingSchema = z
  .object({
    name: resourceName.optional(),
    pubsubTopic: z.string().optional(),
    notificationTypes: z.array(z.string()).optional(),
  })
  .passthrough();
