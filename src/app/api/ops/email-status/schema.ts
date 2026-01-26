import { z } from 'zod';

import { EMAIL_DELIVERY_STATUSES } from '@/lib/emails/delivery-status';
import { EMAIL_JOB_TYPES } from '@/lib/queue/email-types';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES } from '@/utils/ops/bookings';

const emailTypeSchema = z.enum(EMAIL_JOB_TYPES);
const viewSchema = z.enum(['queue', 'delivery']).default('queue');
const deliveryStatusSchema = z.enum(EMAIL_DELIVERY_STATUSES);
const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid date' });

export const opsEmailStatusQuerySchema = z.object({
  view: viewSchema,
  restaurantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  windowMinutes: z.coerce.number().int().min(15).max(43200).default(DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES),
  type: emailTypeSchema.optional(),
  status: deliveryStatusSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type OpsEmailStatusQuery = z.infer<typeof opsEmailStatusQuerySchema>;

export function parseOpsEmailStatusQuery(rawParams: Record<string, string | undefined>) {
  return opsEmailStatusQuerySchema.safeParse(rawParams);
}
