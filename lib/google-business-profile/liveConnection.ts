import { z } from 'zod';

export const gbpRetentionStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), reason: z.null() }),
  z.object({
    status: z.literal('blocked'),
    reason: z.enum(['retention_not_ready', 'readiness_unavailable']),
  }),
]);

export const gbpLiveConnectionSchema = z.object({
  status: z.literal('verified'),
  verifiedAt: z.string().datetime(),
  location: z.object({
    title: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    website: z.string().nullable(),
  }),
  retention: gbpRetentionStatusSchema,
});

export type GbpRetentionStatus = z.infer<typeof gbpRetentionStatusSchema>;
export type GbpLiveConnection = z.infer<typeof gbpLiveConnectionSchema>;
