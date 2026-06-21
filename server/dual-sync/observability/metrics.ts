import { listRecentOperationsForRestaurant } from '../publish/operations';
import { listRecentDualSyncJobs } from '../queue';

import type { DualSyncJob, DualSyncPublishOperation } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export type DualSyncOperationalAlertCode =
  | 'QUEUE_BACKLOG'
  | 'DEAD_LETTER_JOBS'
  | 'QUOTA_LIMITED'
  | 'REAUTH_REQUIRED'
  | 'STALE_DECISIONS'
  | 'PARTIAL_PUBLISH_FAILURES';

export interface DualSyncOperationalAlert {
  readonly code: DualSyncOperationalAlertCode;
  readonly severity: 'warning' | 'critical';
  readonly message: string;
  readonly count: number;
}

export interface DualSyncOperationalMetrics {
  readonly restaurantId: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly jobCounts: Readonly<Record<string, number>>;
  readonly operationCounts: Readonly<Record<string, number>>;
  readonly failureCounts: Readonly<Record<string, number>>;
  readonly queueBacklog: number;
  readonly deadLetterJobs: number;
  readonly partialPublishFailures: number;
  readonly alerts: ReadonlyArray<DualSyncOperationalAlert>;
}

export interface DualSyncOperationalMetricThresholds {
  readonly queueBacklogWarning: number;
  readonly deadLetterCritical: number;
  readonly quotaLimitedWarning: number;
  readonly reauthRequiredCritical: number;
  readonly staleDecisionWarning: number;
  readonly partialPublishWarning: number;
}

const DEFAULT_THRESHOLDS: DualSyncOperationalMetricThresholds = {
  queueBacklogWarning: 10,
  deadLetterCritical: 1,
  quotaLimitedWarning: 3,
  reauthRequiredCritical: 1,
  staleDecisionWarning: 3,
  partialPublishWarning: 1,
};

function increment(counts: Record<string, number>, key: string | null | undefined): void {
  if (!key) return;
  counts[key] = (counts[key] ?? 0) + 1;
}

function countPartialPublishFailures(operations: ReadonlyArray<DualSyncPublishOperation>): number {
  const byJob = new Map<string, { succeeded: number; failed: number }>();
  for (const operation of operations) {
    const current = byJob.get(operation.publishJobId) ?? { succeeded: 0, failed: 0 };
    if (operation.status === 'succeeded') current.succeeded += 1;
    if (operation.status === 'failed') current.failed += 1;
    byJob.set(operation.publishJobId, current);
  }
  return [...byJob.values()].filter((counts) => counts.succeeded > 0 && counts.failed > 0).length;
}

function alertIf(input: {
  readonly alerts: DualSyncOperationalAlert[];
  readonly code: DualSyncOperationalAlertCode;
  readonly severity: DualSyncOperationalAlert['severity'];
  readonly count: number;
  readonly threshold: number;
  readonly message: string;
}): void {
  if (input.count < input.threshold) return;
  input.alerts.push({
    code: input.code,
    severity: input.severity,
    count: input.count,
    message: input.message,
  });
}

export function summarizeDualSyncOperationalMetrics(input: {
  readonly restaurantId: string;
  readonly jobs: ReadonlyArray<DualSyncJob>;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly thresholds?: Partial<DualSyncOperationalMetricThresholds>;
}): DualSyncOperationalMetrics {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const jobCounts: Record<string, number> = {};
  const operationCounts: Record<string, number> = {};
  const failureCounts: Record<string, number> = {};

  for (const job of input.jobs) {
    increment(jobCounts, job.status);
    increment(failureCounts, job.lastErrorCode);
  }
  for (const operation of input.operations) {
    increment(operationCounts, operation.status);
    increment(failureCounts, operation.errorCode);
  }

  const queueBacklog = (jobCounts.queued ?? 0) + (jobCounts.retrying ?? 0);
  const deadLetterJobs = jobCounts.dead_letter ?? 0;
  const partialPublishFailures = countPartialPublishFailures(input.operations);
  const alerts: DualSyncOperationalAlert[] = [];

  alertIf({
    alerts,
    code: 'QUEUE_BACKLOG',
    severity: 'warning',
    count: queueBacklog,
    threshold: thresholds.queueBacklogWarning,
    message: 'Dual-sync queue backlog is above the warning threshold.',
  });
  alertIf({
    alerts,
    code: 'DEAD_LETTER_JOBS',
    severity: 'critical',
    count: deadLetterJobs,
    threshold: thresholds.deadLetterCritical,
    message: 'Dual-sync has dead-letter jobs requiring operator recovery.',
  });
  alertIf({
    alerts,
    code: 'QUOTA_LIMITED',
    severity: 'warning',
    count: failureCounts.QUOTA_LIMITED ?? 0,
    threshold: thresholds.quotaLimitedWarning,
    message: 'Google edit quota failures are above the warning threshold.',
  });
  alertIf({
    alerts,
    code: 'REAUTH_REQUIRED',
    severity: 'critical',
    count: failureCounts.REAUTH_REQUIRED ?? 0,
    threshold: thresholds.reauthRequiredCritical,
    message: 'Google reauth failures require reconnecting the Business Profile.',
  });
  alertIf({
    alerts,
    code: 'STALE_DECISIONS',
    severity: 'warning',
    count: (failureCounts.CORE_DRIFT ?? 0) + (failureCounts.GBP_DRIFT ?? 0),
    threshold: thresholds.staleDecisionWarning,
    message: 'Stale dual-sync decisions are above the warning threshold.',
  });
  alertIf({
    alerts,
    code: 'PARTIAL_PUBLISH_FAILURES',
    severity: 'warning',
    count: partialPublishFailures,
    threshold: thresholds.partialPublishWarning,
    message: 'At least one publish job has mixed succeeded and failed operations.',
  });

  return {
    restaurantId: input.restaurantId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    jobCounts,
    operationCounts,
    failureCounts,
    queueBacklog,
    deadLetterJobs,
    partialPublishFailures,
    alerts,
  };
}

export async function loadDualSyncOperationalMetrics(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly now?: Date;
  readonly windowMs?: number;
  readonly limit?: number;
  readonly thresholds?: Partial<DualSyncOperationalMetricThresholds>;
}): Promise<DualSyncOperationalMetrics> {
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs).toISOString();
  const windowEnd = now.toISOString();
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500);

  const [jobs, operations] = await Promise.all([
    listRecentDualSyncJobs({
      client: input.client,
      restaurantId: input.restaurantId,
      limit,
    }),
    listRecentOperationsForRestaurant({
      client: input.client,
      restaurantId: input.restaurantId,
      since: windowStart,
      limit,
    }),
  ]);

  return summarizeDualSyncOperationalMetrics({
    restaurantId: input.restaurantId,
    jobs,
    operations,
    windowStart,
    windowEnd,
    thresholds: input.thresholds,
  });
}
