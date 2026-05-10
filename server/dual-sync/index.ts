/**
 * Phases 1, 2 & 3a of the unified dual-sync engine.
 *
 * Public barrel for `server/dual-sync/`. Phase 3b will wire concrete
 * import/export ports and HTTP route handlers off this entry point.
 */

export * from './types';
export * from './hashing';
export * from './registry';
export * from './state';
export * from './snapshots';
export * from './outbound';
export * from './core-writes';
export * from './refresh';
export * from './publish';
export * from './queue';
export * from './replay';
export * from './scheduling';
export * from './observability';
export * from './locks';
export * from './flag';
export * from './controls';
export {
  getDualSyncDbClient,
  type DualSyncDbClient,
  type DualSyncFieldStateRow,
  type DualSyncSnapshotRunRow,
  type DualSyncJobRow,
  type DualSyncRestaurantControlRow,
  type DualSyncOutboundCandidateRow,
  type DualSyncPublishBatchRow,
  type DualSyncPublishOperationGroupRow,
  type DualSyncPublishOperationRow,
  type DualSyncLockRow,
} from './db';
