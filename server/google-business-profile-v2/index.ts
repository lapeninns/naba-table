/**
 * Phase 1 of the GBP Dual-Sync V2 architecture.
 *
 * Public entry point for the V2 server domain. Re-exports types, hashing
 * helpers, and the rollout flag. Phase 2+ modules (snapshots, diff engine,
 * preflight, publish orchestrator) will hang off this barrel.
 */

export * from './types';
export { hashCanonicalJson, hashSectionSnapshots, hashFrozenDecisions } from './hashing';
export { isGbpSyncV2Enabled, type GbpSyncV2FlagInput } from './flag';
export {
  readNabatableSnapshot,
  finalizeSnapshot,
  type ReadNabatableSnapshotInput,
  type NabatableSnapshotResult,
} from './snapshot/nabatable';
export {
  readGoogleSnapshot,
  type ReadGoogleSnapshotInput,
  type GoogleSnapshotResult,
} from './snapshot/google';
export type {
  SyncV2CanonicalSnapshot,
  SyncV2ProfileSectionValue,
  SyncV2OperatingHoursDay,
  SyncV2OperatingHoursSectionValue,
  SyncV2ServicePeriod,
  SyncV2ServicePeriodsSectionValue,
  SyncV2BusinessContextSectionValues,
  SyncV2CategoryValue,
  SyncV2ServiceAreaValue,
  SyncV2AttributeValue,
  SyncV2ServiceItemValue,
} from './snapshot/types';
export { buildSyncV2Diff, type BuildDiffInput, type BuildDiffOutput } from './diff/engine';
