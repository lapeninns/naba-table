import { z } from 'zod';

export const accountDeviceKindSchema = z.enum(['desktop', 'mobile', 'tablet', 'unknown']);
export const accountAssuranceLevelSchema = z.enum(['aal1', 'aal2', 'aal3']);

const nullableShortText = z.string().max(100).nullable();

export const accountSessionHeartbeatSchema = z.object({
  deviceId: z.string().uuid().nullable().optional(),
  timeZone: z.string().trim().min(1).max(100).nullable().optional(),
  locale: z.string().trim().min(1).max(35).nullable().optional(),
});

export const accountDeviceRenameSchema = z.object({
  deviceId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
});

export const accountSessionSchema = z.object({
  id: z.string().uuid(),
  signedInAt: z.string().datetime({ offset: true }),
  lastActiveAt: z.string().datetime({ offset: true }),
  signedOutAt: z.string().datetime({ offset: true }).nullable(),
  refreshedAt: z.string().datetime({ offset: true }).nullable(),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  ipAddress: z.string().nullable(),
  assuranceLevel: accountAssuranceLevelSchema.nullable(),
  approximateLocation: z
    .object({
      city: nullableShortText,
      region: nullableShortText,
      countryCode: z.string().length(2).nullable(),
    })
    .nullable(),
  isActive: z.boolean(),
  isCurrent: z.boolean(),
  device: z.object({
    id: z.string().uuid().nullable(),
    name: z.string().nullable(),
    firstSeenAt: z.string().datetime({ offset: true }).nullable(),
    sessionCount: z.number().int().nonnegative(),
    timeZone: nullableShortText,
    locale: z.string().max(35).nullable(),
    kind: accountDeviceKindSchema,
    browser: z.string(),
    operatingSystem: z.string(),
    label: z.string(),
  }),
});

export const accountSessionsResponseSchema = z.object({
  sessions: z.array(accountSessionSchema),
});

export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountSessionsResponse = z.infer<typeof accountSessionsResponseSchema>;
export type AccountSessionHeartbeat = z.infer<typeof accountSessionHeartbeatSchema>;
