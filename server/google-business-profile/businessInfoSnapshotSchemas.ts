import { z } from 'zod';

const text = z.string().optional();
const strings = z.array(z.string()).optional();
const record = z.record(z.string(), z.unknown());
const time = z.union([
  z.string(),
  z.object({
    hours: z.number().int().min(0).max(23).optional(),
    minutes: z.number().int().min(0).max(59).optional(),
  }),
]);
const date = z.object({
  year: z.number().int().optional(),
  month: z.number().int().optional(),
  day: z.number().int().optional(),
});
const period = z.object({
  openDay: text,
  closeDay: text,
  openTime: time.optional(),
  closeTime: time.optional(),
});
const category = z.object({
  name: text,
  displayName: text,
  moreHoursTypes: z
    .array(z.object({ hoursTypeId: text, displayName: text, localizedDisplayName: text }))
    .optional(),
});

export const snapshotLocationSchema = z.object({
  name: z.string().min(1),
  title: z.string().trim().min(1),
  languageCode: text,
  timezone: text,
  timeZone: text,
  storefrontAddress: z
    .object({
      addressLines: strings,
      locality: text,
      administrativeArea: text,
      postalCode: text,
      regionCode: text,
      languageCode: text,
      sublocality: text,
      organization: text,
      recipients: strings,
    })
    .optional(),
  phoneNumbers: z.object({ primaryPhone: text, additionalPhones: strings }).optional(),
  websiteUri: text,
  categories: z
    .object({
      primaryCategory: category.optional(),
      additionalCategories: z.array(category).optional(),
    })
    .optional(),
  regularHours: z.object({ periods: z.array(period).optional() }).optional(),
  specialHours: z
    .object({
      specialHourPeriods: z
        .array(
          z.object({
            startDate: date.optional(),
            endDate: date.optional(),
            openTime: time.optional(),
            closeTime: time.optional(),
            closed: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  moreHours: z
    .array(z.object({ hoursTypeId: text, periods: z.array(period).optional() }))
    .optional(),
  serviceArea: z
    .object({
      businessType: text,
      regionCode: text,
      places: z.object({ placeInfos: z.array(record).optional() }).optional(),
    })
    .optional(),
  latlng: z
    .object({ latitude: z.number().optional(), longitude: z.number().optional() })
    .optional(),
  openInfo: z
    .object({ status: text, canReopen: z.boolean().optional(), openingDate: date.optional() })
    .optional(),
  metadata: z
    .object({
      placeId: text,
      mapsUri: text,
      newReviewUri: text,
      timezone: text,
      timeZone: text,
      canHaveFoodMenus: z.boolean().optional(),
    })
    .optional(),
  profile: z.object({ description: text }).optional(),
  serviceItems: z.array(record).optional(),
});

export const snapshotAttributesSchema = z.object({
  name: text,
  attributes: z
    .array(
      z
        .object({
          name: text,
          attributeId: text,
          displayName: text,
          groupDisplayName: text,
          valueType: text,
          values: z
            .array(
              z.union([
                z.boolean(),
                z.string(),
                z.object({
                  boolValue: z.boolean().optional(),
                  stringValue: text,
                  displayName: text,
                  enumValue: z.object({ displayName: text, value: text }).optional(),
                }),
              ]),
            )
            .optional(),
          repeatedEnumValue: z.object({ setValues: strings, unsetValues: strings }).optional(),
          uriValue: text,
          uriValues: z.array(z.object({ uri: text })).optional(),
          valueMetadata: z
            .array(
              z.object({ value: z.union([z.boolean(), z.string()]).optional(), displayName: text }),
            )
            .optional(),
          displayStrings: z
            .object({ uiText: text, standaloneText: text, negativeText: text })
            .optional(),
        })
        .transform((attribute) => ({
          ...attribute,
          values: attribute.values?.map((value) => {
            if (typeof value === 'boolean') return { boolValue: value };
            if (typeof value === 'string')
              return attribute.valueType === 'ENUM'
                ? { enumValue: { value } }
                : { stringValue: value };
            return value;
          }),
        })),
    )
    .optional(),
});

export const snapshotSupplementSchema = z.object({
  name: text,
  serviceItems: z.array(record).optional(),
});
