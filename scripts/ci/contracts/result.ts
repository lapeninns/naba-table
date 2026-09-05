import { z } from 'zod';

import {
  AttemptSchema,
  IdentifierSchema,
  IsoTimestampSchema,
  NonNegativeIntSchema,
  RuntimeIdSchema,
  SemverSchema,
  Sha256DigestSchema,
} from './primitives';
import { DedupKeySchema } from './request';
import { rejectCredentialLikeKeys, uniqueStrings } from './validation';

export const CI_RESULT_SCHEMA_VERSION = 1;

export const SUPERVISOR_OUTCOMES = [
  'passed',
  'failed',
  'timed-out',
  'infrastructure-error',
  'cancelled',
] as const;
export type SupervisorOutcome = (typeof SUPERVISOR_OUTCOMES)[number];

export const SUITE_OUTCOMES = ['passed', 'failed', 'timed-out', 'skipped', 'cancelled'] as const;

const PercentSchema = z.number().min(0).max(100);

export const TestInventorySchema = z
  .strictObject({
    discoveredIds: z.array(z.string().min(1)),
    counts: z.strictObject({
      discovered: NonNegativeIntSchema,
      passed: NonNegativeIntSchema,
      failed: NonNegativeIntSchema,
      skipped: NonNegativeIntSchema,
      todo: NonNegativeIntSchema,
    }),
  })
  .superRefine((inventory, ctx) => {
    if (!uniqueStrings(inventory.discoveredIds)) {
      ctx.addIssue({ code: 'custom', path: ['discoveredIds'], message: 'duplicate test ids' });
    }
    if (inventory.counts.discovered !== inventory.discoveredIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['counts', 'discovered'],
        message: 'discovered count must equal discoveredIds length',
      });
    }
    const { passed, failed, skipped, todo, discovered } = inventory.counts;
    if (passed + failed + skipped + todo !== discovered) {
      ctx.addIssue({
        code: 'custom',
        path: ['counts'],
        message: 'passed + failed + skipped + todo must equal discovered',
      });
    }
  });
export type TestInventory = z.infer<typeof TestInventorySchema>;

export const CoverageSummarySchema = z.strictObject({
  lines: PercentSchema,
  branches: PercentSchema,
  functions: PercentSchema,
  statements: PercentSchema,
});

export const SuiteTimingSchema = z.strictObject({
  suiteId: IdentifierSchema,
  outcome: z.enum(SUITE_OUTCOMES),
  durationMs: NonNegativeIntSchema,
  p95BudgetExceeded: z.boolean(),
});

export const CiResultSchema = z
  .strictObject({
    version: z.literal(CI_RESULT_SCHEMA_VERSION),
    dedupKey: DedupKeySchema,
    supervisorOutcome: z.enum(SUPERVISOR_OUTCOMES),
    testInventory: TestInventorySchema,
    /** Null when the profile ran no coverage-producing suite. */
    coverage: CoverageSummarySchema.nullable(),
    runtime: z.strictObject({
      activeRuntime: RuntimeIdSchema,
      nodeVersion: SemverSchema,
      pnpmVersion: SemverSchema,
    }),
    timings: z
      .strictObject({
        startedAt: IsoTimestampSchema,
        finishedAt: IsoTimestampSchema,
        durationMs: NonNegativeIntSchema,
        suites: z.array(SuiteTimingSchema),
      })
      .refine((timings) => Date.parse(timings.finishedAt) >= Date.parse(timings.startedAt), {
        message: 'finishedAt must not precede startedAt',
        path: ['finishedAt'],
      }),
    /** Artifact name -> sha256 digest of the produced evidence file. */
    evidenceDigests: z.record(z.string().min(1), Sha256DigestSchema),
    attempt: AttemptSchema,
  })
  .superRefine((result, ctx) => {
    if (result.supervisorOutcome === 'passed') {
      if (result.testInventory.counts.failed > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['supervisorOutcome'],
          message: 'a passed result cannot report failed tests',
        });
      }
      if (result.testInventory.counts.discovered === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['testInventory', 'counts', 'discovered'],
          message: 'a passed result must have discovered at least one test',
        });
      }
      const failingSuite = result.timings.suites.find(
        (suite) => suite.outcome !== 'passed' && suite.outcome !== 'skipped',
      );
      if (failingSuite) {
        ctx.addIssue({
          code: 'custom',
          path: ['supervisorOutcome'],
          message: `a passed result cannot contain suite ${failingSuite.suiteId} with outcome ${failingSuite.outcome}`,
        });
      }
    }
    const suiteIds = result.timings.suites.map((suite) => suite.suiteId);
    if (!uniqueStrings(suiteIds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['timings', 'suites'],
        message: 'duplicate suite ids in timings',
      });
    }
  })
  .superRefine(rejectCredentialLikeKeys);
export type CiResult = z.infer<typeof CiResultSchema>;
