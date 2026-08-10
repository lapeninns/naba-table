import { DateTime } from 'luxon';

export const RETENTION_ACTIONS = [
  'delete',
  'scrub',
  'stop_persisting',
  'metadata_only',
  'external_gate',
] as const;

export type RetentionAction = (typeof RETENTION_ACTIONS)[number];

export type RetentionStoreResult = {
  readonly storeKey: string;
  readonly action: RetentionAction;
  readonly matchedCount: number;
  readonly mutatedCount: number;
  readonly oldestExpiresAt: string | null;
  readonly moreLikely: boolean;
};

export type RetentionScope = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

export type RetentionRun = {
  readonly now: string;
  readonly limit: number;
  readonly timeBudgetMs: number;
  readonly scope?: RetentionScope;
};

export interface ContentRetentionPort {
  census(input: RetentionRun): Promise<readonly RetentionStoreResult[]>;
  purge(input: RetentionRun): Promise<readonly RetentionStoreResult[]>;
}

export type RunContentRetentionInput = {
  readonly port: ContentRetentionPort;
  readonly now: Date;
  readonly dryRun: boolean;
  readonly limit?: number;
  readonly timeBudgetMs?: number;
  readonly scope?: RetentionScope;
};

export type ContentRetentionSummary = {
  readonly dryRun: boolean;
  readonly runAt: string;
  readonly limit: number;
  readonly totals: { readonly matched: number; readonly mutated: number };
  readonly oldestOutstandingAgeMs: number | null;
  readonly level: 'healthy' | 'warning' | 'page';
  readonly moreLikely: boolean;
  readonly stores: readonly RetentionStoreResult[];
};

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5_000;
const DEFAULT_TIME_BUDGET_MS = 20_000;
const WARNING_AGE_MS = 12 * 60 * 60 * 1_000;
const PAGE_AGE_MS = 24 * 60 * 60 * 1_000;

function boundedPositive(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return fallback;
  return Math.min(Math.trunc(value ?? fallback), maximum);
}

function oldestAge(results: readonly RetentionStoreResult[], nowMs: number): number | null {
  const timestamps = results
    .map((result) => result.oldestExpiresAt)
    .filter((value): value is string => value !== null)
    .map((value) => DateTime.fromISO(value, { setZone: true }).toMillis())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return Math.max(0, nowMs - Math.min(...timestamps));
}

export async function runContentRetention(
  input: RunContentRetentionInput,
): Promise<ContentRetentionSummary> {
  const run: RetentionRun = {
    now: input.now.toISOString(),
    limit: boundedPositive(input.limit, DEFAULT_LIMIT, MAX_LIMIT),
    timeBudgetMs: boundedPositive(input.timeBudgetMs, DEFAULT_TIME_BUDGET_MS, 60_000),
    ...(input.scope ? { scope: input.scope } : {}),
  };
  const stores = input.dryRun ? await input.port.census(run) : await input.port.purge(run);
  const age = oldestAge(stores, input.now.getTime());
  const level =
    age !== null && age >= PAGE_AGE_MS
      ? 'page'
      : age !== null && age >= WARNING_AGE_MS
        ? 'warning'
        : 'healthy';
  return {
    dryRun: input.dryRun,
    runAt: run.now,
    limit: run.limit,
    totals: {
      matched: stores.reduce((sum, item) => sum + item.matchedCount, 0),
      mutated: stores.reduce((sum, item) => sum + item.mutatedCount, 0),
    },
    oldestOutstandingAgeMs: age,
    level,
    moreLikely: stores.some((item) => item.moreLikely),
    stores,
  };
}

export function scrubMixedFields(
  row: Readonly<Record<string, unknown>>,
  googleFields: readonly string[],
): Readonly<Record<string, unknown>> {
  const scrubbed = { ...row };
  for (const field of googleFields) {
    if (Object.hasOwn(scrubbed, field)) scrubbed[field] = null;
  }
  return scrubbed;
}
