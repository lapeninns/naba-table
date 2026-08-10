import { z } from 'zod';

export const CORE_OUTBOX_TABLES = [
  'restaurant_business_details',
  'restaurant_addresses',
  'restaurant_phone_numbers',
  'restaurant_links',
  'restaurant_categories',
  'restaurant_service_areas',
  'restaurant_hours',
  'restaurant_attributes',
  'restaurant_service_items',
  'restaurants',
  'restaurant_operating_hours',
  'restaurant_service_periods',
] as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const coreOutboxEntrySchema = z
  .object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    sourceTable: z.enum(CORE_OUTBOX_TABLES),
    sourceRowId: z.string().uuid(),
    operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
    changedColumns: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
    beforeHash: sha256Schema.nullable(),
    afterHash: sha256Schema.nullable(),
    idempotencyHash: sha256Schema,
    attemptCount: z.number().int().min(1),
    leaseToken: z.string().uuid(),
  })
  .strict()
  .superRefine((row, context) => {
    if (row.operation === 'INSERT' && row.afterHash === null) {
      context.addIssue({ code: 'custom', message: 'insert_requires_after_hash' });
    }
    if (row.operation === 'DELETE' && row.beforeHash === null) {
      context.addIssue({ code: 'custom', message: 'delete_requires_before_hash' });
    }
  });

export type CoreOutboxEntry = z.infer<typeof coreOutboxEntrySchema>;

export const coreOutboxClaimHandleSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  leaseToken: z.string().uuid(),
});

export type CoreOutboxClaimHandle = z.infer<typeof coreOutboxClaimHandleSchema>;

export interface CoreOutboxClaimInput {
  readonly workerId: string;
  readonly limit: number;
}

export interface CoreOutboxRetryResult {
  readonly deadLetterIds: readonly string[];
}

export interface CoreOutboxCandidateInput {
  readonly restaurantId: string;
  readonly fieldKeys: readonly string[];
}

export interface CoreOutboxPorts {
  readonly claim: (input: CoreOutboxClaimInput) => Promise<readonly unknown[]>;
  readonly complete: (entries: readonly CoreOutboxEntry[], workerId: string) => Promise<void>;
  readonly retry: (
    entries: readonly CoreOutboxClaimHandle[],
    workerId: string,
    errorCode: 'invalid_outbox_schema' | 'candidate_discovery_failed',
  ) => Promise<CoreOutboxRetryResult>;
  readonly isProviderOrigin: (entry: CoreOutboxEntry) => Promise<boolean>;
  readonly discoverCandidates: (input: CoreOutboxCandidateInput) => Promise<readonly string[]>;
  readonly notifyDeadLetters: (ids: readonly string[], errorCode: string) => Promise<void>;
}

export interface ProcessCoreOutboxResult {
  readonly claimed: number;
  readonly completed: number;
  readonly retried: number;
  readonly deadLettered: number;
}

export interface CoreOutboxCensus {
  readonly pending: number;
  readonly claimed: number;
  readonly retryable: number;
  readonly deadLetter: number;
}
