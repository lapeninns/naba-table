import { z } from 'zod';

import { GitShaSchema, IsoTimestampSchema, NonNegativeIntSchema } from './primitives';
import { rejectCredentialLikeKeys, uniqueStrings } from './validation';

export const MAX_READINESS_DEPENDENCIES = 16;

export const READINESS_STATES = ['ready', 'degraded', 'unavailable'] as const;
export const DEPENDENCY_STATES = ['ok', 'degraded', 'down', 'unknown'] as const;

export const SERVICE_IDS = [
  'web',
  'booking-short-links',
  'email-queue-gateway',
  'sms-summary-gateway',
] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const ReadinessDependencySchema = z.strictObject({
  name: z.string().min(1).max(64),
  status: z.enum(DEPENDENCY_STATES),
  latencyMs: NonNegativeIntSchema.optional(),
});

/**
 * Body returned by `/api/readiness`-style endpoints once MONITORING_TOKEN has
 * been presented. Bounded so a misbehaving service cannot flood monitoring.
 */
export const ReadinessResponseSchema = z
  .strictObject({
    revision: GitShaSchema,
    service: z.enum(SERVICE_IDS),
    buildId: z.string().min(1).max(128).optional(),
    status: z.enum(READINESS_STATES),
    checkedAt: IsoTimestampSchema,
    dependencies: z.array(ReadinessDependencySchema).max(MAX_READINESS_DEPENDENCIES),
  })
  .superRefine((response, ctx) => {
    const names = response.dependencies.map((dependency) => dependency.name);
    if (!uniqueStrings(names)) {
      ctx.addIssue({ code: 'custom', path: ['dependencies'], message: 'duplicate dependency' });
    }
    const worst = response.dependencies.some((dependency) => dependency.status === 'down');
    if (worst && response.status === 'ready') {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'a service with a down dependency cannot report ready',
      });
    }
  })
  .superRefine(rejectCredentialLikeKeys);
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;
