import type {
  DualSyncPublishBatch,
  DualSyncPublishOperation,
  DualSyncPublishOperationGroup,
  DualSyncSectionKey,
} from '../types';

export interface DualSyncPublishJobRollup {
  readonly publishJobId: string;
  readonly restaurantId: string;
  /** Earliest `created_at` across the job's operations. */
  readonly startedAt: string;
  /**
   * Latest `finished_at` across the job's operations, or `null` if any
   * operation is still pending / running.
   */
  readonly finishedAt: string | null;
  readonly totalOperations: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  /** Other statuses (`pending`, `running`, `retrying`). */
  readonly otherCount: number;
  /** De-duped list of section keys touched by the job. */
  readonly sections: ReadonlyArray<DualSyncSectionKey>;
  /** De-duped list of error codes from failed operations. */
  readonly errorCodes: ReadonlyArray<string>;
  /** Direction breakdown - convenience for the UI. */
  readonly importCount: number;
  readonly exportCount: number;
}

export interface DualSyncPublishJobDetail {
  readonly rollup: DualSyncPublishJobRollup;
  readonly batch: DualSyncPublishBatch | null;
  readonly operationGroups: ReadonlyArray<DualSyncPublishOperationGroup>;
  readonly operations: ReadonlyArray<DualSyncPublishOperation>;
}

/**
 * Group a flat list of operations by `publishJobId` and return one
 * rollup per job. Output is ordered by `startedAt` descending.
 *
 * The caller is responsible for fetching enough history to capture
 * complete jobs - partial jobs (where some operations are outside the
 * fetched window) will rollup with whatever rows are present.
 */
export function summarizeOperationsByJob(
  operations: ReadonlyArray<DualSyncPublishOperation>,
): ReadonlyArray<DualSyncPublishJobRollup> {
  const byJob = new Map<string, DualSyncPublishOperation[]>();
  for (const op of operations) {
    const arr = byJob.get(op.publishJobId) ?? [];
    arr.push(op);
    byJob.set(op.publishJobId, arr);
  }

  const rollups: DualSyncPublishJobRollup[] = [];
  for (const [jobId, ops] of byJob.entries()) {
    if (ops.length === 0) continue;
    let startedAt = ops[0]!.createdAt;
    let finishedAtCandidate: string | null = ops[0]!.finishedAt;
    let allFinished = ops[0]!.finishedAt !== null;
    let succeededCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let otherCount = 0;
    let importCount = 0;
    let exportCount = 0;
    const sectionSet = new Set<DualSyncSectionKey>();
    const errorCodeSet = new Set<string>();

    for (const op of ops) {
      if (op.createdAt < startedAt) startedAt = op.createdAt;
      if (op.finishedAt === null) {
        allFinished = false;
      } else if (finishedAtCandidate === null || op.finishedAt > finishedAtCandidate) {
        finishedAtCandidate = op.finishedAt;
      }
      switch (op.status) {
        case 'succeeded':
          succeededCount += 1;
          break;
        case 'failed':
          failedCount += 1;
          if (op.errorCode) errorCodeSet.add(op.errorCode);
          break;
        case 'skipped':
          skippedCount += 1;
          break;
        default:
          otherCount += 1;
      }
      if (op.direction === 'import_from_google') importCount += 1;
      else exportCount += 1;
      sectionSet.add(op.sectionKey);
    }

    rollups.push({
      publishJobId: jobId,
      restaurantId: ops[0]!.restaurantId,
      startedAt,
      finishedAt: allFinished ? finishedAtCandidate : null,
      totalOperations: ops.length,
      succeededCount,
      failedCount,
      skippedCount,
      otherCount,
      sections: Array.from(sectionSet),
      errorCodes: Array.from(errorCodeSet),
      importCount,
      exportCount,
    });
  }

  return rollups.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
