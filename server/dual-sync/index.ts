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
export * from './scheduling';
export * from './flag';
export {
  getDualSyncDbClient,
  type DualSyncDbClient,
  type DualSyncFieldStateRow,
  type DualSyncSnapshotRunRow,
  type DualSyncOutboundCandidateRow,
  type DualSyncPublishOperationRow,
} from './db';
